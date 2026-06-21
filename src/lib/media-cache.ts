// Download remote images and MP4 videos referenced by connectors into a
// per-connector local cache so the deployed dashboard serves them from its
// own origin (faster, no per-page CDN trips, survives upstream link rot).
//
// Layout:
//   generated/.cache/<connector-key>/url-map.json   — original-URL → served path
//   public/_cache/<connector-key>/<hash>.<ext>      — the cached bytes
//
// The connector's raw cache (data.json) keeps the ORIGINAL upstream URLs —
// this is intentional, so the snapshot stays diagnosable. The builder
// consults the url-map at the end of the load to rewrite Project / ProfileFact
// image URLs to the local served paths.

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { readJsonCache, writeJsonCache } from './json-cache';

const run = promisify(execFile);

const CACHE_ROOT = 'generated/.cache';
const PUBLIC_ROOT = 'public/_cache';
/** Shared subdirectory under PUBLIC_ROOT for YouTube MP4s. ONE file per
 *  video id, reused across every connector that references the same
 *  video and across builds — so a video downloaded once stays
 *  downloaded forever (until you delete it). */
const YOUTUBE_DIR = 'youtube';
/** Fallback root: if a fresh fetch fails (rate limit, network blip),
 *  cacheMedia tries to recover the bytes from here. Populated manually by
 *  whatever process stashed the previous cache state (e.g. a one-off
 *  migration that moved `public/_cache/` aside). Read-only at runtime. */
const FALLBACK_ROOT = '/tmp/_cache';

export type UrlMapFile = {
  version: 1;
  _generated: string;
  /** Original upstream URL → public-relative path (no leading slash, no base).
   *  Example: "_cache/apkpure/a1b2c3d4e5f6.jpg". The builder prepends
   *  `<base>/` when rewriting Project fields. */
  map: Record<string, string>;
};

const NOTE =
  'Auto-generated media URL map. Original upstream URL → local served path. ' +
  'Maintained by src/lib/media-cache.ts. Delete the file to refetch.';

const emptyMap = (): UrlMapFile => ({ version: 1, _generated: NOTE, map: {} });

const mapPathFor = (key: string): string => `${CACHE_ROOT}/${key}/url-map.json`;

export function readUrlMap(key: string): UrlMapFile {
  const m = readJsonCache<UrlMapFile>(mapPathFor(key), emptyMap());
  if (m.version !== 1 || !m.map) Object.assign(m, emptyMap());
  m._generated = NOTE;
  return m;
}

function writeUrlMap(key: string, m: UrlMapFile): void {
  writeJsonCache(mapPathFor(key), m);
}

// Allow-list of content types that are safe and useful to cache locally.
// Anything else (HTML, JSON, opaque CDN responses) falls through to the
// original URL — the dashboard never silently serves the wrong thing.
const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
};

const isAllowed = (ct: string): boolean => ct in MIME_EXT;

function normaliseContentType(raw: string | null): string {
  return (raw ?? '').split(';')[0].trim().toLowerCase();
}

function pickExt(contentType: string, url: string): string | null {
  const fromMime = MIME_EXT[contentType];
  if (fromMime) return fromMime;
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.([a-z0-9]{2,5})$/i);
    if (m) {
      const ext = m[1].toLowerCase();
      if (Object.values(MIME_EXT).includes(ext)) return ext;
    }
  } catch {
    /* malformed URL — fall through to null */
  }
  return null;
}

/** Record of one URL recovered from FALLBACK_ROOT because its live fetch
 *  failed. Used to print a summary at the end of the build. */
export type FallbackEvent = { connectorKey: string; url: string; recoveredFrom: string };
const fallbackEvents: FallbackEvent[] = [];

/** Snapshot of all fallback recoveries collected since the module loaded.
 *  load-projects.ts reads this at the end of a build to emit a summary. */
export function getFallbackEvents(): readonly FallbackEvent[] {
  return fallbackEvents;
}

/** SHA-256 of the URL, first 16 hex chars — used as the filename stem.
 *  URL-addressed (rather than content-addressed) so a stable URL always
 *  resolves to the same filename across rebuilds: clean git diffs when
 *  CI commits `public/_cache/`, no orphaned old-hash files when an
 *  upstream CDN quietly re-compresses an image. */
const urlHashStem = (url: string): string =>
  createHash('sha256').update(url).digest('hex').slice(0, 16);

/** Recover a URL's bytes from a previously-stashed `/tmp/_cache` (manual
 *  migration step or operator-prepared backup) when the live fetch fails.
 *  Copies the old file into `public/_cache/<key>/<urlHash>.<ext>`,
 *  re-using the extension the previous cache picked. Returns the new
 *  served path on success, null otherwise. */
function tryFallbackFromTmp(
  connectorKey: string,
  url: string,
  urlHash: string,
): string | null {
  const oldMapPath = resolve(FALLBACK_ROOT, connectorKey, 'url-map.json');
  if (!existsSync(oldMapPath)) return null;
  let oldMap: UrlMapFile;
  try {
    oldMap = JSON.parse(readFileSync(oldMapPath, 'utf8')) as UrlMapFile;
  } catch {
    return null;
  }
  const oldServed = oldMap.map?.[url];
  if (!oldServed) return null;
  const oldFile = resolve(FALLBACK_ROOT, oldServed.replace(/^_cache\//, ''));
  if (!existsSync(oldFile)) return null;
  const ext = extname(oldFile).slice(1);
  if (!ext) return null;

  const filename = `${urlHash}.${ext}`;
  const newServed = `_cache/${connectorKey}/${filename}`;
  const newDiskPath = resolve(process.cwd(), PUBLIC_ROOT, connectorKey, filename);
  mkdirSync(dirname(newDiskPath), { recursive: true });
  copyFileSync(oldFile, newDiskPath);

  fallbackEvents.push({ connectorKey, url, recoveredFrom: oldFile });
  console.warn(`[media-cache] fetch failed — recovered ${url} from ${oldFile}`);
  return newServed;
}

/** Extract a YouTube video id from a URL across the common shapes:
 *  `youtu.be/<id>`, `youtube.com/watch?v=<id>`, `youtube.com/embed/<id>`,
 *  `youtube.com/shorts/<id>`, plus the `youtube-nocookie.com` mirror.
 *  Returns null for everything else. Kept local (instead of importing
 *  from `media-items.ts`) to avoid a circular dep — media-items
 *  consumes the url-map this module writes. */
function youtubeIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const isYt =
      host === 'youtu.be' ||
      host.endsWith('youtube.com') ||
      host.endsWith('youtube-nocookie.com');
    if (!isYt) return null;
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get('v');
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/^\/(?:embed|v|shorts)\/([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

let ytDlpProbed = false;
let ytDlpReady = false;
/** Probe yt-dlp availability ONCE per build. If it's not installed, all
 *  YouTube URLs fall through to the iframe-embed renderer (the same
 *  behaviour as before this feature was added) — graceful degradation
 *  so the build never breaks on a dev box without yt-dlp installed. */
async function checkYtDlp(): Promise<boolean> {
  if (ytDlpProbed) return ytDlpReady;
  ytDlpProbed = true;
  try {
    await run('yt-dlp', ['--version'], { timeout: 5_000 });
    ytDlpReady = true;
  } catch {
    console.warn(
      '[media-cache] yt-dlp not installed — YouTube videos will render as <iframe> ' +
        'embeds. Install yt-dlp (and ffmpeg) to cache YouTube videos as local MP4.',
    );
    ytDlpReady = false;
  }
  return ytDlpReady;
}

/** Cache a single YouTube video as a local MP4. Shared across all
 *  connectors and all builds — the cached file lives at
 *  `public/_cache/youtube/<videoId>.mp4` regardless of which connector
 *  surfaced the URL. The url-map entry is written into the CALLING
 *  connector's url-map so the rewriter resolves the URL via that
 *  connector's lookup (then `getMergedUrlMap` collapses them all).
 *
 *  IMPORTANT: short-circuits whenever the shared file already exists
 *  on disk — same build (multiple url variants for the same video),
 *  later build (cron committed the bytes back), or other connectors
 *  (chromestats AND extpose both citing the same demo) all skip
 *  yt-dlp and just register the mapping. yt-dlp never runs for a
 *  video we've already got. */
async function cacheYouTubeVideo(
  connectorKey: string,
  url: string,
  ytId: string,
): Promise<string | null> {
  const filename = `${ytId}.mp4`;
  const servedPath = `_cache/${YOUTUBE_DIR}/${filename}`;
  const diskPath = resolve(process.cwd(), PUBLIC_ROOT, YOUTUBE_DIR, filename);

  const registerMapping = (path: string): string => {
    const cache = readUrlMap(connectorKey);
    if (cache.map[url] !== path) {
      cache.map[url] = path;
      writeUrlMap(connectorKey, cache);
    }
    return path;
  };

  // Backward compatibility: if THIS connector's url-map already
  // points the URL at a cached MP4 (from before the shared youtube/
  // directory existed, or from a fresh checkout that brought the
  // committed cache), reuse it. We do NOT want to re-download a
  // video the cron already paid for just because it lives at the
  // old path. Same byte-presence + non-zero-size guard as below.
  {
    const cache = readUrlMap(connectorKey);
    const existing = cache.map[url];
    if (existing) {
      const existingDisk = resolve(
        process.cwd(),
        PUBLIC_ROOT,
        existing.replace(/^_cache\//, ''),
      );
      if (existsSync(existingDisk)) {
        let size = 0;
        try { size = statSync(existingDisk).size; } catch { /* */ }
        if (size > 0) return existing;
      }
    }
  }

  // Shared-dir fast path: if the canonical youtube/<id>.mp4 file is
  // already on disk (downloaded by another connector earlier in this
  // build, or committed by a previous cron run), skip yt-dlp and
  // just register the mapping. Zero-byte sentinels are treated as
  // missing — a previous run's interruption gets a clean retry on
  // the next build.
  if (existsSync(diskPath)) {
    let size = 0;
    try { size = statSync(diskPath).size; } catch { /* */ }
    if (size > 0) return registerMapping(servedPath);
  }

  if (!(await checkYtDlp())) return null;

  mkdirSync(dirname(diskPath), { recursive: true });

  // Canonicalise the URL passed to yt-dlp so noisy player params
  // (?rel=0&autoplay=1&t=42 etc.) can't end up triggering different
  // format negotiations for the same video. We always ask for the
  // plain `watch?v=<id>` URL.
  const canonical = `https://www.youtube.com/watch?v=${ytId}`;

  // Format selector logic, in priority order:
  //   1. A single pre-muxed MP4 ≤ 720p — no ffmpeg needed.
  //   2. Any single MP4 file — covers cases where YouTube only offers
  //      higher-res pre-muxed.
  //   3. Best video + audio streams merged into MP4 — requires ffmpeg.
  //   4. Whatever yt-dlp says is "best" — last-resort fallback.
  // 720p is a deliberate cap: anything higher is wasted bytes on a
  // dashboard thumbnail-sized gallery viewer, and adds disk pressure
  // on the cron-committed cache.
  const format =
    'b[ext=mp4][height<=720]/b[ext=mp4]/bv*[height<=720]+ba[ext=m4a]/b';

  try {
    await run(
      'yt-dlp',
      [
        '--no-warnings', '--quiet', '--no-playlist',
        '-f', format,
        '--merge-output-format', 'mp4',
        '-o', diskPath,
        canonical,
      ],
      { maxBuffer: 64 * 1024 * 1024, timeout: 5 * 60 * 1000 },
    );
  } catch (e) {
    console.warn(`[media-cache] yt-dlp failed for ${url}:`, (e as { message?: string })?.message ?? e);
    return null;
  }

  if (!existsSync(diskPath)) return null;
  console.log(`[media-cache] yt-dlp cached ${ytId} (${url})`);
  return registerMapping(servedPath);
}

/** Download a single media URL into the connector's cache, if not already
 *  cached. Returns the served path (relative — no leading slash, no base)
 *  on success or null if the URL was skipped / failed. Idempotent. */
export async function cacheMedia(connectorKey: string, url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return null;
  // Already a local cache path? Leave it alone.
  if (url.startsWith('_cache/') || url.includes('/_cache/')) return url;

  // YouTube URLs are handled out-of-band by yt-dlp. The shared
  // `public/_cache/youtube/` location and the in-function
  // file-exists guard guarantee at-most-once download per video id,
  // regardless of how many connectors surface the same video or how
  // many builds we run.
  const ytId = youtubeIdFromUrl(url);
  if (ytId) return cacheYouTubeVideo(connectorKey, url, ytId);

  const cache = readUrlMap(connectorKey);
  const cached = cache.map[url];
  if (cached) {
    // A map entry only counts as a hit if the corresponding file is actually
    // on disk. On a fresh CI checkout `public/_cache/` is empty (gitignored
    // unless the cron has committed it back) — without this check we'd ship
    // a `dist/data.json` pointing at files that don't exist in the build
    // output. The presence check forces a re-fetch when the bytes are gone.
    const diskPath = resolve(process.cwd(), PUBLIC_ROOT, cached.replace(/^_cache\//, ''));
    if (existsSync(diskPath)) return cached;
    // Stale entry — fall through to re-fetch and rewrite the map entry.
  }

  const urlHash = urlHashStem(url);

  let res: Response | null = null;
  let fetchError: unknown = null;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch (err) {
    fetchError = err;
  }

  if (!res || !res.ok) {
    const recovered = tryFallbackFromTmp(connectorKey, url, urlHash);
    if (recovered) {
      cache.map[url] = recovered;
      writeUrlMap(connectorKey, cache);
      return recovered;
    }
    if (fetchError) console.warn(`[media-cache] fetch error for ${url}:`, fetchError);
    return null;
  }

  const contentType = normaliseContentType(res.headers.get('content-type'));
  if (!isAllowed(contentType)) return null;
  const ext = pickExt(contentType, url);
  if (!ext) return null;

  const buf = Buffer.from(await res.arrayBuffer());
  const filename = `${urlHash}.${ext}`;
  const servedPath = `_cache/${connectorKey}/${filename}`;
  const diskPath = resolve(process.cwd(), PUBLIC_ROOT, connectorKey, filename);

  mkdirSync(dirname(diskPath), { recursive: true });
  writeFileSync(diskPath, buf);

  cache.map[url] = servedPath;
  writeUrlMap(connectorKey, cache);
  return servedPath;
}

/** Download every media URL in `urls` for one connector. Errors don't throw;
 *  failures simply skip caching that one URL. */
export async function cacheMediaBatch(connectorKey: string, urls: Iterable<string>): Promise<void> {
  const seen = new Set<string>();
  for (const u of urls) {
    if (u && !seen.has(u)) {
      seen.add(u);
      await cacheMedia(connectorKey, u);
    }
  }
}

/** Build a rewriter that turns an original upstream URL into the local
 *  `<base>/<served-path>` when a mapping exists, or returns the input
 *  untouched. `base` should come from `config.deployment.base`. */
export function makeUrlRewriter(base: string | undefined): (url: string | undefined) => string | undefined {
  const map = getMergedUrlMap();
  let b = base || '/';
  if (!b.startsWith('/')) b = '/' + b;
  if (!b.endsWith('/')) b = b + '/';
  return (url) => {
    if (!url) return url;
    const served = map[url];
    return served ? `${b}${served}` : url;
  };
}

/** Read every per-connector url-map under generated/.cache/ and merge into a
 *  single lookup. Used by the build-time rewrite pass that swaps original
 *  upstream URLs for local served paths on Project / ProfileFact fields. */
export function getMergedUrlMap(): Record<string, string> {
  const merged: Record<string, string> = {};
  const root = resolve(process.cwd(), CACHE_ROOT);
  if (!existsSync(root)) return merged;
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return merged;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const m = readJsonCache<UrlMapFile>(`${CACHE_ROOT}/${e.name}/url-map.json`, emptyMap());
    if (m.version === 1 && m.map) Object.assign(merged, m.map);
  }
  return merged;
}
