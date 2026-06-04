import type { ConnectorResult, ProfileFact } from '../types/project';
import type { ProjectsConfig } from '../types/config';

/* ─────────────────── shared types (no glob; no cycle) ────────────────────── */

/** Per-fetch options the loader passes down. */
export type ConnectorFetchOpts = {
  fixtureMode?: boolean;
};

/** A connector's output. Project-emitters set `projects`, profile sources
 *  set `profile`, GitHub sets both.
 *
 *  Observability: connectors that hit an upstream they can't reach (CDN
 *  block, network error, parse exhaustion) can signal that the result is
 *  unreliable by setting `ok: false` with a human-readable `error`. The
 *  loader then preserves the snapshot's previous SUCCESSFUL `results`
 *  instead of overwriting them with the failed-run partial, and surfaces
 *  the failure in /data.json. Defaults to ok:true when omitted. */
export type ConnectorOutput = {
  projects?: ConnectorResult[];
  profile?: ProfileFact;
  ok?: boolean;
  error?: string;
};

/** Maps a hostname's URL back to an (origin platform, id). */
export type UrlIdExtractor = {
  hostnames: string[];
  extract: (url: URL) => { platform: string; id: string } | null;
};

/** Brand mark for image-less cards. */
export type BrandMark = {
  /** Raw inline SVG markup. Use `fill="currentColor"` so the container's
   *  color controls the foreground. */
  svg: string;
  tint: string;
  fg: string;
  /** Optional dark-mode override for `tint` — set this when the light-mode
   *  tint is too dark to remain visible against the dark page background
   *  (e.g. GitHub's near-black). Falls back to `tint` when absent. */
  darkTint?: string;
  /** Optional dark-mode override for `fg` — paired with `darkTint`. Falls
   *  back to `fg` when absent. */
  darkFg?: string;
};

/** A canonical-stats metric a connector can populate. Drives the hero
 *  tile sublabels (only source-groups that emit a metric get credited
 *  as contributors). */
export type EmittedMetric =
  | 'stars'
  | 'forks'
  | 'downloads'
  | 'downloadsMonthly'
  | 'installs'
  | 'users'
  | 'rating';

/** What `export default defineConnector(…)` describes. */
export type ConnectorManifest = {
  key: string;
  label?: string;
  mirrorOf?: string;
  sourceGroup?: string;
  brandMark?: BrandMark;
  urlExtractors?: UrlIdExtractor[];
  /** Additional rep.platform strings this connector emits beyond its own key.
   *  e.g. playstore emits rep.platform = 'google-play' (which is also the Play
   *  Store origin id used in manual `origins` config), so it lists
   *  `platformAliases: ['google-play']`. chromestats's mirror rep uses
   *  `platform: 'chrome-stats'`. The registry's platform→source-group table
   *  uses these aliases to route legacy platform strings through the manifest. */
  platformAliases?: string[];
  /** Which canonical-stats fields this connector populates. Lets the hero
   *  tile sublabels list ONLY the source-groups that actually contribute a
   *  given metric (so a chrome+github project doesn't claim "github
   *  installs" in the active-users tile, etc.). Omit when the connector
   *  produces no stats (e.g. data-only profile connectors). */
  emits?: EmittedMetric[];
  defaultConfig?: unknown;
  fetch: (config: ProjectsConfig, opts: ConnectorFetchOpts) => Promise<ConnectorOutput>;
};

/** Identity helper. Lives in its own module so connectors don't accidentally
 *  pull in the registry's glob (which would create a circular import). */
export function defineConnector(m: ConnectorManifest): ConnectorManifest {
  return m;
}
