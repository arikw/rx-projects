import { getCollection } from 'astro:content';
import config from './load-config';
import type { ConnectorResult, Project, ProfileFact } from '../types/project';
import { manualToResults } from '../connectors/manual';
import { buildProjects } from './build-projects';
import { getAll } from '../connectors/_registry';
import type { ConnectorManifest } from '../connectors/_define';
import { readSnapshot, writeSnapshot, type ConnectorKey, type SnapshotFile } from './snapshot-store';
import { resolveIconColors } from './icon-color';

const FIXTURE_MODE = process.env.CONNECTORS_FIXTURE === '1';

type ConnectorRunResult =
  | { status: 'fresh' | 'cached'; results: ConnectorResult[]; profile?: ProfileFact }
  | { status: 'empty' };

let memo: Promise<Project[]> | null = null;
let lastSnapshot: SnapshotFile | null = null;
let lastProfiles: ProfileFact[] = [];

async function runConnector(
  manifest: ConnectorManifest,
  enabled: boolean,
  snapshot: SnapshotFile,
  now: string,
): Promise<ConnectorRunResult> {
  const key = manifest.key as ConnectorKey;
  if (!enabled) {
    const cached = snapshot.connectors[key];
    return cached ? { status: 'cached', results: cached.results } : { status: 'empty' };
  }
  try {
    const out = await manifest.fetch(config, { fixtureMode: FIXTURE_MODE });
    const results = out.projects ?? [];
    snapshot.connectors[key] = { lastScrapedAt: now, results };
    return { status: 'fresh', results, profile: out.profile };
  } catch (err) {
    console.warn(`[loader] connector "${key}" failed:`, err);
    const cached = snapshot.connectors[key];
    if (cached) {
      console.warn(`[loader] falling back to cached "${key}" data from ${cached.lastScrapedAt}`);
      return { status: 'cached', results: cached.results };
    }
    return { status: 'empty' };
  }
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
  const all = [...connectorResults, ...manualToResults(config), ...manualOrigins()];

  const built = buildProjects(all);

  // Extract a dominant colour for each icon-only card so its backplate
  // reflects the icon. Banner / screenshot+icon stack cards already have
  // foreground art that defines their colour; brand-mark cards have a brand
  // colour. So we only need this for icon-only (no banner, no screenshots).
  const iconUrlsForColor = built
    .filter((p) => p.icon && !p.banner && !(p.screenshots && p.screenshots.length > 0))
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

  // Which slugs have a matching MDX detail page?
  const detailEntries = await getCollection('projects').catch(() => []);
  const detailSlugs = new Set(detailEntries.map((e) => e.id.replace(/\.mdx?$/, '')));
  const featuredSlugs = new Set([
    ...config.featured,
    ...config.manual.filter((m) => m.featured).map((m) => m.slug),
  ]);

  return built.map((p) => ({
    ...p,
    featured: featuredSlugs.has(p.id),
    hasDetail: detailSlugs.has(p.id),
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
