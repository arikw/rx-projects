import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ConnectorResult, Review } from '../../types/project';
import type { ProjectsConfig } from '../../types/config';
import type { ConnectorFetchOpts, ConnectorOutput } from '../_define';
import { defineConnector } from '../_define';
import { loadFixture } from '../../lib/fixtures';
import { readJsonCache, writeJsonCache } from '../../lib/json-cache';
import { detectContentLanguage } from '../../lib/content-language';
import { scrubEmails } from '../../lib/scrub-emails';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const run = promisify(execFile);

const CACHE_PATH = 'generated/.cache/appbrain/data.json';
const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0';

type AppbrainApp = {
  packageName: string;
  title: string;
  url: string;
  description?: string;
  rating?: number;
  ratingCount?: number;
  /** Raw per-star counts [1★,2★,3★,4★,5★]. */
  ratingHistogram?: number[];
  /** Google Play install-tier floor (e.g. "10,000+" → 10000). */
  installs?: number;
  /** First year on Google Play (from firstSeenS). */
  year?: number;
  /** ISO date AppBrain last observed the listing alive (from lastSeenS).
   * For retired apps this is effectively the retirement date; for live apps
   * it's close to today. Feeds the rep's `asOf` so the build reconciler
   * has an end-year signal — without it, retired Play apps showed only the
   * first-released year, no range. */
  lastSeen?: string;
  /** App icon URL (Google-hosted). */
  iconUrl?: string;
  /** Positive review snippets surfaced by AppBrain's `commentInsights`. */
  positiveQuotes?: string[];
  /** Long-form description from the visible page (vs the short
   *  `shortDescription` from the JSONRPC endpoint). Extracted from
   *  the `data-contents` attribute on `#descLink` — the developer's
   *  original Play Store copy preserved by AppBrain. */
  body?: string;
};

type AppbrainCache = { version: 5; _generated: string; apps: Record<string, AppbrainApp> };

const NOTE =
  'Auto-generated AppBrain cache (GetIntelligenceDataRequest + Play tier + long description). Frozen removed apps — fetched once.';

const emptyCache = (): AppbrainCache => ({ version: 5, _generated: NOTE, apps: {} });

// AppBrain is behind Cloudflare, which blocks Node's fetch (undici) regardless
// of headers; curl's TLS handshake passes, so we shell out. Fetch-once cache,
// so curl is only needed the first time per package.
async function curlRun(args: string[]): Promise<string | null> {
  try {
    const { stdout } = await run('curl', args, { maxBuffer: 16 * 1024 * 1024 });
    return stdout || null;
  } catch {
    return null;
  }
}

// `scrubEmails` lives in src/lib/scrub-emails.ts so AppBrain + APKPure
// (and any future body-scraping connector) share the same logic.
// The shared helper reads `config.meta.scrubEmails` /
// `config.meta.contactReplacement` at fetch time.
// (Imported below alongside the rest.)

/** Google Play install tier, e.g. "10,000+" → 10000 (the honest floor). */
function parseInstalls(bucket: unknown): number | undefined {
  if (typeof bucket !== 'string') return undefined;
  const n = parseInt(bucket.replace(/[,+\s]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

// Primary source: the JSON-RPC intelligence endpoint. Whitelist only the safe
// public fields below — the response also carries officialWebsite and comment
// quotes we deliberately ignore (and notably it has NO developer email).
type Intel = {
  title: string;
  rating?: number;
  ratingCount?: number;
  histogram?: number[];
  description?: string;
  year?: number;
  lastSeen?: string;
  iconUrl?: string;
  positiveQuotes?: string[];
};

async function fetchIntel(pkg: string): Promise<Intel | null> {
  const out = await curlRun([
    '-s',
    '--max-time',
    '25',
    '-X',
    'POST',
    '-H',
    'content-type: application/json',
    '-H',
    'origin: https://www.appbrain.com',
    '-H',
    `referer: https://www.appbrain.com/app/${pkg}`,
    '-A',
    UA,
    '--data-raw',
    JSON.stringify({ packageName: pkg }),
    'https://www.appbrain.com/jsonrpc/GetIntelligenceDataRequest',
  ]);
  if (!out) return null;
  try {
    const d = JSON.parse(out) as Record<string, unknown>;
    if (!d.packageName) return null;
    const histogram = [1, 2, 3, 4, 5].map((i) => Number(d[`ratings${i}`]) || 0);
    const fsRaw = Number(d.firstSeenS);
    const year = Number.isFinite(fsRaw) && fsRaw > 0 ? new Date(fsRaw * 1000).getUTCFullYear() : undefined;
    // lastSeenS = epoch seconds AppBrain last observed the listing alive.
    // For retired apps this is the de-facto removal date; for live apps it's
    // close to today's date. ISO YYYY-MM-DD is the format the build reconciler
    // sorts on for `asOf` / `updatedAt`.
    const lsRaw = Number(d.lastSeenS);
    const lastSeen =
      Number.isFinite(lsRaw) && lsRaw > 0 ? new Date(lsRaw * 1000).toISOString().slice(0, 10) : undefined;
    const ci = d.commentInsights as { positiveQuotes?: unknown } | undefined;
    const rawQuotes = Array.isArray(ci?.positiveQuotes) ? (ci!.positiveQuotes as unknown[]) : [];
    const positiveQuotes = rawQuotes
      .map((q) => (typeof q === 'string' ? scrubEmails(q) : ''))
      .filter((q) => q.length > 0);
    return {
      title: typeof d.name === 'string' && d.name ? d.name : pkg,
      rating: typeof d.rating === 'number' ? Math.round(d.rating * 100) / 100 : undefined,
      ratingCount: typeof d.ratingCount === 'number' ? d.ratingCount : undefined,
      histogram: histogram.some((n) => n > 0) ? histogram : undefined,
      description:
        typeof d.shortDescription === 'string' ? scrubEmails(d.shortDescription) || undefined : undefined,
      year,
      lastSeen,
      iconUrl: typeof d.iconUrl === 'string' ? d.iconUrl : undefined,
      positiveQuotes: positiveQuotes.length ? positiveQuotes : undefined,
    };
  } catch {
    return null;
  }
}

/** The HTML page carries two pieces we need: the Play install tier
 *  (`appData.downloads`) AND the long-form developer description
 *  (in `data-contents` on `#descLink`). We pull both with a single
 *  fetch to halve the per-package CF cost vs separate calls. */
async function fetchPlayPage(pkg: string): Promise<{ installs?: number; body?: string }> {
  const doc = await curlRun([
    '-sL',
    '--max-time',
    '25',
    '-A',
    UA,
    '-H',
    'Accept-Language: en-US,en;q=0.9',
    `https://www.appbrain.com/app/${encodeURIComponent(pkg)}`,
  ]);
  if (!doc) return {};
  let installs: number | undefined;
  const blob = doc.match(/"APP_PAGE_DATA"\s*:\s*(\{.*?\})\};window\.pageDataProto/s);
  if (blob) {
    try {
      const appData = (JSON.parse(blob[1]) as { appData?: { downloads?: unknown } }).appData;
      installs = parseInstalls(appData?.downloads);
    } catch { /* fall through */ }
  }
  // Long description — the user-visible `#descContents` div only carries
  // the first paragraph; `#descLink data-contents` carries the full
  // text with `<br>` separators, kept verbatim from the original Play
  // Store listing.
  let body: string | undefined;
  const descMatch = doc.match(/<a[^>]+id="descLink"[^>]+data-contents="([^"]+)"/);
  if (descMatch) {
    const text = dropEmptyContactLines(scrubEmails(appbrainDescriptionToMarkdown(descMatch[1])));
    if (text.length > 20) body = text;
  }
  return { installs, body };
}

/** After `scrubEmails` removes the email itself, a leading prefix like
 *  "Please submit bugs to" / "Contact us at" / "Email to" remains
 *  pointing at nothing. Strip any line whose contact-verb tail ends
 *  with a "to" / "at" / "via" that has no following word — typical
 *  shape of these orphans. Plain non-contact sentences (e.g. "Walk
 *  to the store") aren't affected because they don't start with a
 *  contact verb. */
function dropEmptyContactLines(s: string): string {
  return s
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !/^(?:please\s+)?(?:contact|email|write|reach\s+out|submit|report|send|reply|message)\b[^.\n]*\b(?:to|at|via)\s*[:.\s]*$/i.test(t);
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Convert AppBrain's `data-contents` attribute (HTML-entity-encoded
 *  text with `<br>` line breaks) into clean markdown. */
function appbrainDescriptionToMarkdown(raw: string): string {
  // Decode the attribute-level encoding first (so &lt;br&gt; → <br>),
  // then convert <br>s to newlines (paragraph break for double-br),
  // then strip any remaining tags and decode body entities.
  const decoded = decodeHtmlEntities(raw);
  const lined = decoded
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(lined).trim();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function scrapeApp(pkg: string): Promise<AppbrainApp | null> {
  const intel = await fetchIntel(pkg);
  if (!intel) return null; // the endpoint is the source of truth
  const page = await fetchPlayPage(pkg);
  return {
    packageName: pkg,
    title: intel.title,
    url: `https://www.appbrain.com/app/${encodeURIComponent(pkg)}`,
    description: intel.description,
    rating: intel.rating,
    ratingCount: intel.ratingCount,
    ratingHistogram: intel.histogram,
    installs: page.installs,
    year: intel.year,
    lastSeen: intel.lastSeen,
    iconUrl: intel.iconUrl,
    positiveQuotes: intel.positiveQuotes,
    body: page.body,
  };
}

export const fetchAppbrainProjects = async (
  config: ProjectsConfig,
  options?: ConnectorFetchOpts,
): Promise<ConnectorOutput> => {
  const packages = config.sources.gplay.packages;
  if (!packages.length) return { projects: [] };

  if (options?.fixtureMode) return { projects: await loadFixture('appbrain') };

  const cache = readJsonCache<AppbrainCache>(CACHE_PATH, emptyCache());
  if (cache.version !== 5 || !cache.apps) Object.assign(cache, emptyCache());
  cache._generated = NOTE;

  // Track fresh-fetch attempts vs failures so we can signal ok:false when
  // Cloudflare blocks every request — same pattern as the apkpure connector.
  let attempted = 0;
  let failed = 0;
  for (const pkg of packages) {
    const existing = cache.apps[pkg];
    // Re-attempt when the cached entry is incomplete: missing `body`
    // is the most common shape, caused by a transient Cloudflare blip
    // during the original fetch. Don't re-attempt entries that already
    // have body (or genuinely have no description on the source page);
    // distinguishing those would require a separate "tried but empty"
    // marker which we don't keep.
    if (existing && existing.body) continue; // frozen, complete
    attempted++;
    const app = await scrapeApp(pkg);
    if (app) {
      // If the new fetch found a body but the existing entry was used
      // for other fields, prefer the merged shape so we don't lose
      // anything (rare — fetch returns a full record).
      cache.apps[pkg] = { ...existing, ...app };
    } else {
      failed++;
      // Keep whatever we had before; don't blank out a partial entry
      // because of a transient failure.
    }
    await sleep(300);
  }
  writeJsonCache(CACHE_PATH, cache);

  const projects = packages
    .map((p) => cache.apps[p])
    .filter((a): a is AppbrainApp => !!a)
    .map<ConnectorResult>((a) => ({
      // AppBrain isn't the origin — it points at the Google Play resource
      // (identity only; the Play listing is dead for removed apps, so the live
      // link lives on the mirror).
      origin: { platform: 'google-play', id: a.packageName },
      // AppBrain's replicated copy of the Play data. installs is the "10,000+"
      // tier (a floor); a manual origin (Play Console) outranks it in reconcile.
      mirror: {
        platform: 'appbrain',
        id: a.packageName,
        url: a.url,
        // `asOf` = the date AppBrain last observed this listing alive
        // (lastSeenS). For retired Play apps this gives the build the
        // end-year signal needed to render `YYYY–YYYY`; for live apps
        // it's close to today's date.
        asOf: a.lastSeen,
        title: a.title,
        description: a.description ?? '',
        body: a.body,
        firstReleased: a.year,
        contentLanguage: detectContentLanguage(a.title) ?? undefined,
        tags: ['android'],
        kind: 'mobile',
        // AppBrain's iconUrl is the Google-hosted square app icon.
        icon: a.iconUrl,
        reviews: a.positiveQuotes?.map<Review>((q) => ({ body: q, source: 'appbrain' })),
        stats: {
          ...(a.installs != null ? { installs: { value: a.installs, exact: false } } : {}),
          ...(a.rating != null && a.ratingCount != null
            ? { rating: { average: a.rating, count: a.ratingCount, histogram: a.ratingHistogram } }
            : {}),
        },
      },
    }));

  // Coverage-based ok — see apkpure/index.ts for the rationale.
  const missing = packages.filter((p) => !cache.apps[p]).length;
  if (projects.length === 0 && packages.length > 0) {
    return {
      projects,
      ok: false,
      error: `no packages returned data (${failed}/${attempted} fresh scrapes failed — likely Cloudflare block)`,
    };
  }
  if (missing > 0) {
    return {
      projects,
      ok: 'partial',
      error: `${missing}/${packages.length} packages missing (${failed}/${attempted} fresh scrapes failed — likely Cloudflare block)`,
    };
  }
  return { projects };
};

/** Manifest — picked up by `_registry.ts` via auto-discovery.
 *  appbrain is a MIRROR of playstore (the Android origin). Inherits the
 *  "Android app" label + the "android" source-group via mirrorOf chain. */
export default defineConnector({
  key: 'appbrain',
  mirrorOf: 'playstore',
  emits: ['installs', 'rating'],
  defaultConfig: { enabled: true },
  fetch: fetchAppbrainProjects,
});
