// Cross-source perceptual deduplication for project screenshots.
//
// PROBLEM: A project can carry the same gallery image from multiple
// connectors (chrome, chromestats, extpose, …) — possibly served from
// different CDNs with different compression / sizing, so neither URL
// equality nor canonical-googleusercontent dedup catches them. The
// `dhash` (difference hash) reads the actual cached pixels, producing
// a 64-bit fingerprint that's stable across re-encoding.
//
// SCOPE: only collapses entries from DIFFERENT source connectors.
// Two screenshots from the same connector (e.g. chromestats listing
// two near-identical promo tiles) stay separate even when their
// dhashes are similar — the source's curators chose to list both,
// so we trust that decision.
//
// COST: ~5 ms per cached image (sharp resize + 8×9 grayscale read).
// Hashes are persisted to `generated/.cache/dhashes.json` keyed by the
// served path, so a steady-state build pays for new images only.

import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readJsonCache, writeJsonCache } from './json-cache';
import config from './load-config';

const CACHE_PATH = 'generated/.cache/dhashes.json';
const NOTE =
  'Auto-generated perceptual-hash cache. Keys are served paths under `_cache/`; ' +
  'values are 64-bit difference-hash strings. Delete to recompute.';

type DhashCache = {
  version: 1;
  _generated: string;
  hashes: Record<string, string>;
};

/** Hamming-distance threshold for "same image". 10 / 64 ≈ 84% similarity.
 *  Validated against the auto-replay-for-youtube gallery (the 1↔2, 1↔4,
 *  1↔5, 2↔4, 2↔5, 4↔5 pairs all measured Hamming ≤ 5 and ARE the same
 *  source screenshot from different CDNs; the next-nearest pair was 16). */
const HAMMING_THRESHOLD = 10;

let cacheCache: DhashCache | null = null;
let cacheDirty = false;
function getCache(): DhashCache {
  if (cacheCache) return cacheCache;
  const c = readJsonCache<DhashCache>(CACHE_PATH, { version: 1, _generated: NOTE, hashes: {} });
  if (c.version !== 1 || !c.hashes) cacheCache = { version: 1, _generated: NOTE, hashes: {} };
  else cacheCache = c;
  return cacheCache;
}

/** Persist any newly-computed hashes. Called once after a build's
 *  deduplication pass; safe to call when nothing's changed (writes a
 *  no-op file). */
export function flushDhashCache(): void {
  if (!cacheDirty) return;
  const c = getCache();
  c._generated = NOTE;
  writeJsonCache(CACHE_PATH, c);
  cacheDirty = false;
}

/** Map a project-rewritten URL (e.g. `/projects/_cache/foo/bar.jpg`) to
 *  its on-disk path under `public/`. Returns null for URLs outside the
 *  cache (e.g. external CDNs we couldn't fetch). */
function urlToLocalPath(url: string): string | null {
  let rel: string | null = null;
  const base = config.deployment.base;
  const baseWithSlash = base.endsWith('/') ? base : `${base}/`;
  if (url.startsWith(baseWithSlash)) rel = url.slice(baseWithSlash.length);
  else if (url.startsWith('_cache/')) rel = url;
  if (!rel || !rel.startsWith('_cache/')) return null;
  const local = `public/${rel}`;
  return existsSync(local) ? resolve(local) : null;
}

/** Compute a 64-bit difference-hash for an image: resize to 9×8
 *  grayscale, encode left>right neighbour comparison as one bit per
 *  position. Two visually-identical images at different resolutions or
 *  encodings produce hashes with Hamming distance ≤ ~5. */
async function computeDhash(filePath: string): Promise<string | null> {
  try {
    const raw = await sharp(filePath).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
    let bits = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        bits += raw[y * 9 + x] < raw[y * 9 + x + 1] ? '1' : '0';
      }
    }
    return bits;
  } catch {
    return null;
  }
}

/** Look up (or compute + cache) the dhash for a URL. Returns null when
 *  the URL isn't a local cache path or sharp can't decode the file. */
async function getDhash(url: string): Promise<string | null> {
  const local = urlToLocalPath(url);
  if (!local) return null;
  // Cache key = the served path portion (`_cache/foo/bar.jpg`) — the
  // deployment base may differ between dev / prod but the cached
  // bytes are the same.
  const key = local.split('public/').pop() ?? local;
  const cache = getCache();
  if (cache.hashes[key]) return cache.hashes[key];
  const h = await computeDhash(local);
  if (h) {
    cache.hashes[key] = h;
    cacheDirty = true;
  }
  return h;
}

function hamming(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

export type SourcedUrl = { url: string; platform: string };

/** Cross-source perceptual dedup. Walks the input list in order; keeps
 *  the first entry; for every subsequent entry, drops it ONLY when a
 *  previously-kept entry from a DIFFERENT platform has a similar
 *  dhash (Hamming ≤ threshold). Same-platform near-duplicates stay
 *  because the source listed both intentionally. */
export async function dedupAcrossSourcesPerceptually(items: SourcedUrl[]): Promise<SourcedUrl[]> {
  const kept: Array<SourcedUrl & { hash: string | null }> = [];
  for (const item of items) {
    const hash = await getDhash(item.url);
    if (hash == null) {
      // No local file → can't compute → can't dedup → keep.
      kept.push({ ...item, hash: null });
      continue;
    }
    const cross = kept.find(
      (k) => k.platform !== item.platform && k.hash != null && hamming(k.hash, hash) <= HAMMING_THRESHOLD,
    );
    if (!cross) kept.push({ ...item, hash });
    // else: dropped — visually-identical to an already-kept entry
    // from another source.
  }
  return kept.map((k) => ({ url: k.url, platform: k.platform }));
}
