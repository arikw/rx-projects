// Unify a project's videos + screenshots into a single carousel-ready
// list. Videos are ordered FIRST so the most expressive demo leads the
// gallery; the rest of the page (carousel, dots, viewer dialog) iterates
// the resulting `MediaItem[]` without caring about source media kind.
//
// Three video shapes are supported:
//
//  - YouTube embeds / share / watch URLs → `kind: 'video'`, with a derived
//    `posterUrl` (i.ytimg.com hqdefault) for the carousel slide and an
//    `embedSrc` (youtube.com/embed/<id>) for the viewer iframe.
//  - Locally-cached MP4 originally fetched from a YouTube URL via the
//    media-cache pipeline → `kind: 'video'`, poster URL synthesized
//    from the YouTube id (looked up via reverse url-map at build time),
//    no embedSrc (we play the cached MP4 directly).
//  - Locally-cached MP4 / WebM with no upstream YouTube link → poster
//    null (browser paints the first frame), no embedSrc.
//
// Unrecognised URLs are dropped on the floor — the gallery just shows
// the screenshots in that case rather than rendering a broken player.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import config from './load-config';

export type MediaItem = {
  /** Stable key used by data attributes. Equals the original src URL. */
  src: string;
  kind: 'video' | 'image';
  /** Thumbnail to render in the carousel. For YouTube videos this is the
   *  derived `hqdefault.jpg`; for images, the image itself. */
  posterUrl: string | null;
  /** YouTube embed URL — present only when the video should be played via
   *  `<iframe>`. Absent for native `<video>` / image items. */
  embedSrc?: string;
};

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Parse a YouTube URL into its 11-char video ID, or return null. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return YT_ID_RE.test(id) ? id : null;
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      // /embed/<id>, /v/<id>, /shorts/<id>
      const m = u.pathname.match(/\/(?:embed|v|shorts)\/([^/?#]+)/);
      if (m && YT_ID_RE.test(m[1])) return m[1];
      // /watch?v=<id>
      const v = u.searchParams.get('v');
      if (v && YT_ID_RE.test(v)) return v;
    }
    return null;
  } catch {
    return null;
  }
}

function isNativeVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(url);
}

/** Forward + reverse url-map indexes (original-URL ↔ served-path).
 *  Built lazily at first access by scanning every per-connector
 *  url-map under `generated/.cache/<connector>/url-map.json`.
 *  Cached for the build's lifetime — the url-maps are stable across
 *  the page-build loop. */
let urlMapsCache: { forward: Map<string, string>; reverse: Map<string, string> } | null = null;
function getUrlMaps(): { forward: Map<string, string>; reverse: Map<string, string> } {
  if (urlMapsCache) return urlMapsCache;
  const forward = new Map<string, string>();
  const reverse = new Map<string, string>();
  const cacheRoot = resolve(process.cwd(), 'generated/.cache');
  if (existsSync(cacheRoot)) {
    for (const dirent of readdirSync(cacheRoot, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue;
      const mapPath = resolve(cacheRoot, dirent.name, 'url-map.json');
      if (!existsSync(mapPath)) continue;
      try {
        const d = JSON.parse(readFileSync(mapPath, 'utf8')) as { map?: Record<string, string> };
        for (const [orig, served] of Object.entries(d.map ?? {})) {
          // Served paths are stored WITHOUT the deployment-base prefix
          // (e.g. `_cache/chromestats/<hash>.jpg`).
          forward.set(orig, served);
          reverse.set(served, orig);
        }
      } catch { /* skip malformed cache */ }
    }
  }
  urlMapsCache = { forward, reverse };
  return urlMapsCache;
}

/** Given a final rewritten media URL (e.g. `/projects/_cache/foo/bar.mp4`),
 *  recover the original upstream URL that produced this cache entry,
 *  or null if the URL isn't a cached one. */
function lookupOriginal(localUrl: string): string | null {
  const idx = localUrl.indexOf('_cache/');
  if (idx < 0) return null;
  return getUrlMaps().reverse.get(localUrl.slice(idx)) ?? null;
}

/** Given an original upstream URL, return its build-time-cached
 *  served URL (`<base>/_cache/<connector>/<hash>.<ext>`), or null
 *  when the URL isn't in any per-connector url-map. */
function lookupCached(originalUrl: string): string | null {
  const served = getUrlMaps().forward.get(originalUrl);
  if (!served) return null;
  const b = config.deployment.base.endsWith('/')
    ? config.deployment.base
    : `${config.deployment.base}/`;
  return `${b}${served}`;
}

/** Pick the best available YouTube poster URL for a video id.
 *  Resolution preference: maxresdefault (1280×720, only available
 *  for HD source videos) → hqdefault (480×360, always available).
 *  Both are checked against the build-time forward url-map first so
 *  the result points at the locally-cached copy when present;
 *  otherwise falls back to the upstream `i.ytimg.com` URL. */
function pickYoutubePoster(ytId: string): string {
  const maxres = `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;
  const hq = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  // 1) Local cached maxres — preferred (1280×720)
  const maxresLocal = lookupCached(maxres);
  if (maxresLocal) return maxresLocal;
  // 2) Local cached hq — fallback when maxres wasn't cached (e.g.
  //    the source video isn't HD and maxres returned 404 at fetch).
  const hqLocal = lookupCached(hq);
  if (hqLocal) return hqLocal;
  // 3) No local cache — point at the upstream maxres URL. The
  //    browser handles its own 404 fallback by emitting an error
  //    event; for non-HD videos the YouTube CDN returns a 404 and
  //    we'd want a JS-side onerror to swap to hq, but that's only
  //    needed when the build couldn't cache locally — which is
  //    rare on a healthy build.
  return maxres;
}

/** Convert a raw video URL into a MediaItem, or null if unsupported. */
function buildVideoItem(src: string): MediaItem | null {
  const ytId = youtubeId(src);
  if (ytId) {
    return {
      src,
      kind: 'video',
      posterUrl: pickYoutubePoster(ytId),
      // Normalise to the privacy-friendlier nocookie host. `playsinline=1`
      // keeps mobile Safari from punting playback into its own fullscreen
      // chrome (which would close our dialog).
      embedSrc: `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&playsinline=1`,
    };
  }
  if (isNativeVideo(src)) {
    // Locally-cached MP4 may have come from a YouTube embed at build
    // time. If so, derive the poster URL from the YouTube id via the
    // same pickYoutubePoster() helper (max → hq → upstream). Falls
    // back to null (browser paints first frame) when the cached file
    // has no YouTube origin.
    let posterUrl: string | null = null;
    const orig = lookupOriginal(src);
    if (orig) {
      const origYtId = youtubeId(orig);
      if (origYtId) posterUrl = pickYoutubePoster(origYtId);
    }
    return { src, kind: 'video', posterUrl };
  }
  return null;
}

/** Build the carousel list: videos first, then screenshots, then drop
 *  duplicates by `src` so the same asset doesn't appear twice when a
 *  manual entry pastes a poster URL into both arrays. */
export function buildMediaItems(opts: {
  videos?: string[];
  screenshots?: string[];
}): MediaItem[] {
  const seen = new Set<string>();
  const items: MediaItem[] = [];
  for (const v of opts.videos ?? []) {
    if (seen.has(v)) continue;
    seen.add(v);
    const item = buildVideoItem(v);
    if (item) items.push(item);
  }
  for (const s of opts.screenshots ?? []) {
    if (seen.has(s)) continue;
    seen.add(s);
    items.push({ src: s, kind: 'image', posterUrl: s });
  }
  return items;
}
