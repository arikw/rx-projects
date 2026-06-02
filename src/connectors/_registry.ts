import type { BrandMark, ConnectorManifest, EmittedMetric, UrlIdExtractor } from './_define';

/**
 * Connector registry — the single source of truth for which connectors exist,
 * what they emit, and how the system labels / groups / merges them.
 *
 * Connectors live in `src/connectors/<key>/index.ts`, each `export default
 * defineConnector(…)`. The auto-discovery glob picks them up at build time.
 * Everywhere that used to hand-maintain a list (CONNECTORS, BRAND_MARKS,
 * SOURCE_TO_GROUP, …) now reads from getters here.
 *
 * Adding a new connector is one folder: drop a `<key>/index.ts` under
 * `src/connectors/`. No edits to load-projects, build-projects, source-label,
 * ProjectGrid, ProjectCard, or ProjectThumb. See docs/connectors.md.
 */

export type { ConnectorFetchOpts, ConnectorOutput, ConnectorManifest, UrlIdExtractor, BrandMark } from './_define';

const modules = import.meta.glob<{ default: ConnectorManifest }>(
  './*/index.ts',
  { eager: true },
);

const ALL: ConnectorManifest[] = Object.values(modules)
  .map((m) => m.default)
  .filter((m): m is ConnectorManifest => !!m && typeof m === 'object' && typeof m.key === 'string')
  .sort((a, b) => a.key.localeCompare(b.key));

/* ─────────────────── query helpers (everything is derived) ─────────────── */

export function getAll(): ConnectorManifest[] {
  return ALL;
}

export function getByKey(key: string): ConnectorManifest | undefined {
  return ALL.find((m) => m.key === key);
}

/** Origins (no mirrorOf). These are the connectors that "own" their source-group. */
export function getOrigins(): ConnectorManifest[] {
  return ALL.filter((m) => !m.mirrorOf);
}

/** The friendly label for a source — follows mirrorOf chains to the origin. */
export function getLabel(key: string): string {
  const m = getByKey(key);
  if (!m) return key;
  if (m.mirrorOf) return getLabel(m.mirrorOf);
  return m.label ?? key;
}

/** The brand mark for a source — inherited from the origin via mirrorOf. */
export function getBrandMark(key: string): BrandMark | undefined {
  const m = getByKey(key);
  if (!m) return undefined;
  if (m.brandMark) return m.brandMark;
  if (m.mirrorOf) return getBrandMark(m.mirrorOf);
  return undefined;
}

/** The source-group a connector belongs to — follows mirrorOf to the origin
 *  and uses the origin's sourceGroup if set, else the origin's key. */
export function getSourceGroup(key: string): string {
  const m = getByKey(key);
  if (!m) return key;
  if (m.sourceGroup) return m.sourceGroup;
  if (m.mirrorOf) return getSourceGroup(m.mirrorOf);
  return m.key;
}

/** All URL extractors flattened across the registry. */
export function getAllUrlExtractors(): UrlIdExtractor[] {
  return ALL.flatMap((m) => m.urlExtractors ?? []);
}

/** key (and platformAliases) → source-group, derived.
 *  Includes alias entries so legacy rep.platform strings like 'chrome-stats'
 *  or 'google-play' route through the manifest's mirrorOf / sourceGroup chain. */
export function getPlatformToSourceGroup(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of ALL) {
    const group = getSourceGroup(m.key);
    out[m.key] = group;
    for (const alias of m.platformAliases ?? []) out[alias] = group;
  }
  return out;
}

/** key → friendly label, derived. */
export function getSourceLabels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of ALL) out[m.key] = getLabel(m.key);
  return out;
}

/** key → brand mark, derived. */
export function getBrandMarks(): Record<string, BrandMark> {
  const out: Record<string, BrandMark> = {};
  for (const m of ALL) {
    const bm = getBrandMark(m.key);
    if (bm) out[m.key] = bm;
  }
  return out;
}

/** Source-groups whose connectors declare they emit the given canonical-
 *  stats metric. Used by the hero sublabels to credit only the groups that
 *  actually contribute a metric (e.g. a chrome+github project shouldn't
 *  claim "GitHub installs" on the active-users tile). Unregistered source-
 *  keys — typically custom `source` values on manual entries like 'firefox'
 *  or 'math4mobile' — never appear in any manifest, so callers must treat
 *  those as always-allowed (manual reps can carry any stat field). */
export function getSourceGroupsEmitting(metric: EmittedMetric): Set<string> {
  const out = new Set<string>();
  for (const m of ALL) {
    if (m.emits?.includes(metric)) out.add(getSourceGroup(m.key));
  }
  return out;
}

/** All source-groups that any registered connector belongs to — used by
 *  the hero sublabels to distinguish registered groups (filter by
 *  `emits`) from unregistered manual sources (always allowed). */
export function getKnownSourceGroups(): Set<string> {
  const out = new Set<string>();
  for (const m of ALL) out.add(getSourceGroup(m.key));
  return out;
}

/** Default sources record built from manifests — used by load-config.ts to
 *  seed sources.<key> before shallow-merging user overrides. */
export function getDefaultSourcesConfig(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of ALL) out[m.key] = m.defaultConfig;
  return out;
}
