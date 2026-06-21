import { getCollection } from 'astro:content';
import config from './load-config';
import type { ConnectorResult, Project, ProfileFact } from '../types/project';
import { manualToResults } from '../connectors/manual';
import { buildProjects } from './build-projects';
import { getAll } from '../connectors/_registry';
import type { ConnectorManifest } from '../connectors/_define';
import { readSnapshot, writeSnapshot, type ConnectorKey, type SnapshotFile } from './snapshot-store';
import { resolveIconColors } from './icon-color';
import { cacheMediaBatch, getFallbackEvents, makeUrlRewriter } from './media-cache';
import { isRenderable } from './project-renderable';

const FIXTURE_MODE = process.env.CONNECTORS_FIXTURE === '1';
// config.media.cache opts out of the local image/mp4 cache (default ON).
// Off → skip downloads + skip the build-time URL rewrite; the dashboard
// renders upstream URLs verbatim. See projects.config.ts for the doc.
const MEDIA_CACHE_ENABLED = config.media?.cache !== false;

type ConnectorRunResult =
  | { status: 'fresh' | 'cached'; results: ConnectorResult[]; profile?: ProfileFact }
  | { status: 'empty' };

let memo: Promise<Project[]> | null = null;
let lastSnapshot: SnapshotFile | null = null;
let lastProfiles: ProfileFact[] = [];
/** Projects dropped by `isRenderable` (typically a removed Chrome extension /
 *  Play app whose enrichment connector — chromestats / apkpure / appbrain —
 *  couldn't be reached on the build runner). Surfaced via /status.json so the
 *  developer knows they should run a local build to populate the cache. */
let lastHidden: Array<{ id: string; reason: string }> = [];

/** Collect every image / video URL a connector's results + profile reference. */
/** Match `youtubeId()` in media-items.ts. Tiny duplicate so the loader
 *  doesn't depend on a build-time-only Astro module. */
function youtubeIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const m = u.pathname.match(/\/(?:embed|v|shorts)\/([^/?#]+)/);
      if (m && /^[A-Za-z0-9_-]{11}$/.test(m[1])) return m[1];
      const v = u.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    }
    return null;
  } catch {
    return null;
  }
}

function collectMediaUrls(results: ConnectorResult[], profile?: ProfileFact): string[] {
  const out: string[] = [];
  for (const r of results) {
    for (const rep of [r.origin, r.mirror, r.native]) {
      if (!rep) continue;
      if (rep.banner) out.push(rep.banner);
      if (rep.icon) out.push(rep.icon);
      if (rep.screenshots) out.push(...rep.screenshots);
      if (rep.videos) {
        for (const v of rep.videos) {
          out.push(v);
          // For YouTube video URLs, queue both poster sizes:
          //  - maxresdefault.jpg (1280×720) — preferred for the gallery
          //    thumbnail, only available for HD source videos
          //  - hqdefault.jpg (480×360) — always available; serves as
          //    the fallback when maxres 404s during the build fetch
          // media-items.ts uses lookupCached() at render time to pick
          // whichever one ended up in the url-map.
          const id = youtubeIdFromUrl(v);
          if (id) {
            out.push(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);
            out.push(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
          }
        }
      }
    }
  }
  if (profile?.avatar) out.push(profile.avatar);
  return out;
}

/** Download + persist a connector's media URLs if media caching is on.
 *  No-ops in fixture mode or when config.media.cache is false. */
async function maybeCache(key: ConnectorKey, urls: string[]): Promise<void> {
  if (FIXTURE_MODE || !MEDIA_CACHE_ENABLED) return;
  await cacheMediaBatch(key, urls);
}

async function runConnector(
  manifest: ConnectorManifest,
  enabled: boolean,
  snapshot: SnapshotFile,
  now: string,
): Promise<ConnectorRunResult> {
  const key = manifest.key as ConnectorKey;
  const cached = snapshot.connectors[key];
  if (!enabled) {
    if (cached) await maybeCache(key, collectMediaUrls(cached.results));
    return cached ? { status: 'cached', results: cached.results } : { status: 'empty' };
  }
  // Two failure paths converge: the connector throws OR it explicitly
  // signals { ok: false }. In both cases we preserve the previous successful
  // `results` and `lastScrapedAt` so a transient block doesn't blank out
  // the source — only `lastAttempt` gets refreshed.
  const recordFailure = (error: string): ConnectorRunResult => {
    snapshot.connectors[key] = {
      lastScrapedAt: cached?.lastScrapedAt ?? now,
      results: cached?.results ?? [],
      lastAttempt: { at: now, ok: false, error },
    };
    if (cached) return { status: 'cached', results: cached.results };
    return { status: 'empty' };
  };
  let out;
  try {
    out = await manifest.fetch(config, { fixtureMode: FIXTURE_MODE });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[loader] connector "${key}" threw:`, err);
    const result = recordFailure(msg);
    if (result.status === 'cached') {
      console.warn(`[loader] falling back to cached "${key}" data from ${cached!.lastScrapedAt}`);
      await maybeCache(key, collectMediaUrls(cached!.results));
    }
    return result;
  }
  if (out.ok === false) {
    const msg = out.error ?? 'connector reported ok:false';
    console.warn(`[loader] connector "${key}" reported failure: ${msg}`);
    const result = recordFailure(msg);
    if (result.status === 'cached') {
      console.warn(`[loader] falling back to cached "${key}" data from ${cached!.lastScrapedAt}`);
      await maybeCache(key, collectMediaUrls(cached!.results));
    }
    return result;
  }
  // ok === true OR ok === 'partial': both write fresh results to the
  // snapshot. The granular state ('partial' = incomplete but usable)
  // rides along in `lastAttempt.ok` for surface in /status.json.
  const results = out.projects ?? [];
  const partial = out.ok === 'partial';
  if (partial) {
    console.warn(`[loader] connector "${key}" partial coverage: ${out.error ?? 'some configured ids returned no data'}`);
  }
  snapshot.connectors[key] = {
    lastScrapedAt: now,
    results,
    lastAttempt: {
      at: now,
      ok: partial ? 'partial' : true,
      ...(partial && out.error ? { error: out.error } : {}),
    },
  };
  await maybeCache(key, collectMediaUrls(results, out.profile));
  return { status: 'fresh', results, profile: out.profile };
}

/** Manual authoritative origin facts from config.origins (e.g. Play Console totals). */
function manualOrigins(): ConnectorResult[] {
  const out: ConnectorResult[] = [];
  for (const [resourceId, fact] of Object.entries(config.origins ?? {})) {
    const idx = resourceId.indexOf(':');
    if (idx < 0) continue;
    out.push({
      origin: {
        platform: resourceId.slice(0, idx),
        id: resourceId.slice(idx + 1),
        url: fact.url,
        asOf: fact.asOf,
        firstReleased: fact.firstReleased,
        stats: fact.stats,
        retired: fact.retired,
      },
    });
  }
  return out;
}

async function loadOnce(): Promise<Project[]> {
  const snapshot = readSnapshot();
  const now = new Date().toISOString();

  const manifests = getAll();
  const sourcesCfg = config.sources as unknown as Record<string, { enabled?: boolean }>;
  const results = await Promise.all(
    manifests.map((m) => runConnector(m, sourcesCfg[m.key]?.enabled ?? true, snapshot, now)),
  );
  writeSnapshot(snapshot);
  lastSnapshot = snapshot;
  lastProfiles = results
    .map((r) => (r.status === 'empty' ? undefined : r.profile))
    .filter((p): p is ProfileFact => !!p);

  const connectorResults = results.flatMap((r) => (r.status === 'empty' ? [] : r.results));
  const manualResults = manualToResults(config);
  const all = [...connectorResults, ...manualResults, ...manualOrigins()];

  // Manual entries don't go through runConnector, so cache their media here.
  // Stored under the `manual` connector key like any other source.
  await maybeCache('manual' as ConnectorKey, collectMediaUrls(manualResults));

  const built = buildProjects(all);

  // Apply per-project routeSlug overrides from config.urlSlugs. The map
  // is keyed by project id, value is the slug used in /projects/<slug>/.
  // Default behaviour (no entry in the map) keeps routeSlug = id.
  // Validation: warn at build time if a value collides with an existing
  // id or another override — silent collisions would 404 one of them.
  const overrides = config.urlSlugs ?? {};
  const claimedSlugs = new Set<string>();
  for (const p of built) claimedSlugs.add(p.id);
  for (const [id, override] of Object.entries(overrides)) {
    if (!claimedSlugs.has(override) || override === id) continue;
    console.warn(
      `[load-projects] urlSlugs override "${id}" → "${override}" collides ` +
      `with an existing project id; the override will be ignored.`,
    );
  }
  for (const p of built) {
    const override = overrides[p.id];
    if (override) p.routeSlug = override;
  }

  // Extract a dominant colour for each card that has an icon — the backplate
  // (icon-only frame, screenshot+icon stack) pulls a pastel version of this
  // colour. Banner-only cards skip extraction since the foreground art owns
  // the whole tile and there's no backplate visible.
  const iconUrlsForColor = built
    .filter((p) => p.icon && !p.banner)
    .map((p) => p.icon!);
  if (iconUrlsForColor.length) {
    const colorByUrl = await resolveIconColors(iconUrlsForColor);
    for (const p of built) {
      if (p.icon) {
        const c = colorByUrl.get(p.icon);
        if (c) p.iconColor = c;
      }
    }
  }

  // Surface any /tmp/_cache fallback recoveries — they mean a live fetch
  // failed and we patched the build from a previously-stashed copy.
  const fbEvents = getFallbackEvents();
  if (fbEvents.length) {
    console.warn(
      `[media-cache] ${fbEvents.length} URL(s) recovered from /tmp/_cache fallback:`,
    );
    for (const e of fbEvents) {
      console.warn(`  - [${e.connectorKey}] ${e.url}`);
    }
  }

  // Swap original upstream URLs for local served paths when the media cache
  // has a mapping. Connectors always emit ORIGINAL URLs (so the raw scrape
  // stays diagnosable); the dashboard publishes the local copy only when
  // caching is enabled — otherwise upstream URLs pass through verbatim.
  if (MEDIA_CACHE_ENABLED) {
    const rewrite = makeUrlRewriter(config.deployment.base);
    for (const p of built) {
      if (p.banner) p.banner = rewrite(p.banner);
      if (p.icon) p.icon = rewrite(p.icon);
      if (p.screenshots) p.screenshots = p.screenshots.map((u) => rewrite(u) ?? u);
      if (p.videos) p.videos = p.videos.map((u) => rewrite(u) ?? u);
      // Apply the same rewrite to the platform-tagged screenshot list so
      // the perceptual dedup pass (below) sees local cache paths instead
      // of upstream URLs.
      if (p._sourcedScreenshots) {
        p._sourcedScreenshots = p._sourcedScreenshots.map((s) => ({
          url: rewrite(s.url) ?? s.url,
          platform: s.platform,
        }));
      }
    }
    for (const pf of lastProfiles) {
      if (pf.avatar) pf.avatar = rewrite(pf.avatar);
    }
  }

  // Perceptual cross-source dedup — collapse screenshots that look the
  // same when they came from DIFFERENT connectors (e.g. one image
  // shipped via chromestats AND a manual Wayback entry). Same-source
  // near-duplicates are left alone because the source listed both
  // intentionally. Cheap (~5 ms per uncached image; hash cache makes
  // re-runs free).
  {
    const { dedupAcrossSourcesPerceptually, flushDhashCache } = await import('./perceptual-dedup');
    for (const p of built) {
      if (p._sourcedScreenshots && p._sourcedScreenshots.length >= 2) {
        const after = await dedupAcrossSourcesPerceptually(p._sourcedScreenshots);
        if (after.length !== p._sourcedScreenshots.length) {
          p.screenshots = after.map((s) => s.url);
        }
      }
      // Always strip the internal handoff field — even when we didn't
      // run dedup — so it doesn't leak into `dist/data.json`.
      delete p._sourcedScreenshots;
    }
    flushDhashCache();
  }

  // Populate / refresh the README + CHANGELOG cache for every GitHub-backed
  // project. Three-tier short-circuit (ETag → content-hash → image diff)
  // keeps the steady-state daily build at ~1s for ~30 repos; only a real
  // README change does any image work. Image fetch failures are silent and
  // retried next build, so a flaky CDN doesn't hang the pipeline.
  const { updateReadmeCache: refreshReadme, updateChangelogCache: refreshChangelog } = await import('./readme-cache');
  const githubProjects = built.filter((p) => /github\.com\//.test(p.sourceUrl ?? ''));
  const READMES_CONCURRENT = 5;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(READMES_CONCURRENT, githubProjects.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= githubProjects.length) return;
      const p = githubProjects[i];
      const m = p.sourceUrl!.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!m) continue;
      const owner = m[1];
      const repo = m[2].replace(/\.git$/, '');
      const slug = `${owner}__${repo}`;
      const token = process.env.GITHUB_TOKEN || process.env.GH_API_TOKEN;
      let branch = 'main';
      try {
        const r = await refreshReadme({ owner, repo, slug, githubToken: token });
        // Pick up the resolved branch from the readme-cache meta for the
        // changelog fetch, so it doesn't have to redo the API lookup.
        const { getReadmeMeta } = await import('./readme-cache');
        branch = getReadmeMeta(slug)?.branch ?? branch;
        // Only chase the changelog when the README itself was reachable —
        // a repo that 404s on README isn't going to have a changelog either.
        if (r.kind !== 'gone-404' && r.kind !== 'error') {
          await refreshChangelog({ owner, repo, slug, branch, githubToken: token });
        }
      } catch (err) {
        console.warn(`[readme-cache] ${owner}/${repo} update failed:`, err);
      }
    }
  });
  await Promise.all(workers);

  // Which slugs have any kind of detail content? The dynamic route
  // (src/pages/[slug].astro) picks one of four tiers per slug —
  // MDX override > cached README > screenshot gallery > description-only.
  // hasDetail is true when *any* tier would resolve to content.
  const detailEntries = await getCollection('projects').catch(() => []);
  const mdxDetailSlugs = new Set(detailEntries.map((e) => e.id.replace(/\.mdx?$/, '')));
  const featuredSlugs = new Set([
    ...config.featured,
    ...config.manual.filter((m) => m.featured).map((m) => m.slug),
  ]);

  // Every project gets a detail page now. We previously gated this
  // behind tier criteria (MDX exists / cached README / ≥2 screenshots
  // / ≥40-char description) so a sparse project wouldn't render an
  // empty "page with hero only" — but the hero alone (icon + title +
  // lede + chips + stats sidebar) IS a legitimate page, and having
  // every project routable keeps internal links (card thumb, card
  // title, More projects) consistent.
  //
  // Disk-existence check for cached READMEs stays in the dynamic
  // route — it picks the BEST tier for each project; this flag only
  // controls whether the project IS routable.
  function computeHasDetail(_p: Project): boolean {
    return true;
  }

  // Drop unrenderable stubs (e.g. removed Chrome extensions where chromestats
  // wasn't reachable on the build runner, so the only data we have is the
  // raw extension id). Track them for the /status endpoint so the dev sees
  // a clear signal that a local build is needed to populate the caches.
  const visible: Project[] = [];
  const hidden: Array<{ id: string; reason: string }> = [];
  for (const p of built) {
    if (isRenderable(p)) {
      visible.push(p);
    } else {
      hidden.push({
        id: p.id,
        reason: 'no friendly title — connector enrichment data missing (likely Cloudflare-gated source unreachable on the build runner)',
      });
    }
  }
  lastHidden = hidden;

  return visible.map((p) => ({
    ...p,
    featured: featuredSlugs.has(p.id),
    hasDetail: computeHasDetail(p),
  }));
}

export function loadProjects(): Promise<Project[]> {
  if (!memo) memo = loadOnce();
  return memo;
}

export function getSnapshot(): SnapshotFile | null {
  return lastSnapshot;
}

/** Profile facts emitted by data-only / dual-output connectors during the
 *  current build. Available after loadProjects() resolves. */
export function getProfiles(): ProfileFact[] {
  return lastProfiles;
}

/** Projects dropped by `isRenderable` during the current build. Each entry
 *  has the project id and a short reason. Surfaced via /status.json. */
export function getHidden(): Array<{ id: string; reason: string }> {
  return lastHidden;
}
