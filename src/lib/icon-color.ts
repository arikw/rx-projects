import sharp from 'sharp';
import { readJsonCache, writeJsonCache } from './json-cache';

/** Per-icon dominant *subject* colour, computed at build time via sharp.
 *  Used as the backplate tint for icon-only thumb layouts so each card's
 *  backdrop reflects the icon rather than a deterministic hash hue. */
const CACHE_PATH = 'generated/icon-colors.json';
type ColorCache = { version: 1; _generated: string; colors: Record<string, string | null> };
const NOTE =
  'Auto-generated dominant icon colors (sharp). Frozen-once. Delete the file to refresh.';
const empty = (): ColorCache => ({ version: 1, _generated: NOTE, colors: {} });

/** Decode `data:` URIs locally; fetch HTTP(S) URIs over the network. */
async function fetchBuffer(url: string): Promise<Buffer | null> {
  if (url.startsWith('data:')) {
    const idx = url.indexOf(',');
    if (idx < 0) return null;
    const meta = url.slice(5, idx);
    const data = url.slice(idx + 1);
    try {
      return /;base64\b/i.test(meta)
        ? Buffer.from(data, 'base64')
        : Buffer.from(decodeURIComponent(data), 'utf8');
    } catch {
      return null;
    }
  }
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** If `buf` is an ICO file, extract its largest embedded image's bytes.
 *  Modern favicons embed PNG inside the ICO container — sharp can't decode
 *  the ICO wrapper, but it reads the inner PNG fine. Returns the original
 *  buffer if it isn't an ICO or the embedded image isn't PNG. */
function maybeUnwrapIco(buf: Buffer): Buffer {
  if (buf.length < 6) return buf;
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return buf;
  const count = buf.readUInt16LE(4);
  if (count === 0) return buf;
  let bestSize = 0;
  let bestOffset = 0;
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16;
    if (entry + 16 > buf.length) break;
    const size = buf.readUInt32LE(entry + 8);
    const offset = buf.readUInt32LE(entry + 12);
    if (size > bestSize) {
      bestSize = size;
      bestOffset = offset;
    }
  }
  if (bestSize === 0 || bestOffset + bestSize > buf.length) return buf;
  const inner = buf.subarray(bestOffset, bestOffset + bestSize);
  // PNG signature: 89 50 4E 47.
  const isPng =
    inner.length >= 8 &&
    inner[0] === 0x89 &&
    inner[1] === 0x50 &&
    inner[2] === 0x4e &&
    inner[3] === 0x47;
  return isPng ? inner : buf;
}

/** Pick a representative *subject* colour from an icon buffer:
 *   1. Flatten transparency onto neutral gray so the "background" of an SVG
 *      with alpha doesn't dominate.
 *   2. Resize to 48×48 raw pixels.
 *   3. Compute HSL per pixel; keep mid-lightness, saturated ones.
 *   4. Average the top-saturation 15% — that's typically the icon's subject
 *      (logo, mark), not its padding. */
async function dominantSubjectHex(buf: Buffer): Promise<string | null> {
  try {
    const decoded = maybeUnwrapIco(buf);
    const { data, info } = await sharp(decoded)
      .flatten({ background: '#808080' })
      .resize(48, 48, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ch = info.channels;
    if (ch < 3) return null;

    type Px = { r: number; g: number; b: number; s: number; l: number };
    const pixels: Px[] = [];
    for (let i = 0; i + 2 < data.length; i += ch) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 510; // 0..1
      const delta = (max - min) / 255; // 0..1
      const s = delta === 0 ? 0 : l <= 0.5 ? delta / (2 * l) : delta / (2 - 2 * l);
      pixels.push({ r, g, b, s, l });
    }
    if (pixels.length === 0) return null;

    // Prefer "interesting" pixels — saturated, not near-white / near-black.
    let candidates = pixels.filter((p) => p.s > 0.25 && p.l > 0.15 && p.l < 0.85);
    if (candidates.length < 8) {
      // Relaxed pass: less-strict saturation threshold if the strict one
      // didn't yield enough samples (icons with muted colours).
      candidates = pixels.filter((p) => p.s > 0.1 && p.l > 0.1 && p.l < 0.9);
    }
    if (candidates.length === 0) {
      // Fully greyscale / near-white / near-black icon — no colour to pick.
      return null;
    }

    // Top 15% by saturation = the icon's subject mark.
    candidates.sort((a, b) => b.s - a.s);
    const topN = Math.max(1, Math.floor(candidates.length * 0.15));
    const top = candidates.slice(0, topN);
    const sum = top.reduce(
      (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
      { r: 0, g: 0, b: 0 },
    );
    const n = top.length;
    const hex = (v: number) =>
      Math.max(0, Math.min(255, Math.round(v / n))).toString(16).padStart(2, '0');
    return `#${hex(sum.r)}${hex(sum.g)}${hex(sum.b)}`;
  } catch {
    return null;
  }
}

/** Resolve subject colours for a batch of icon URLs. Frozen-once cache;
 *  delete generated/icon-colors.json to refresh. */
export async function resolveIconColors(urls: string[]): Promise<Map<string, string>> {
  const cache = readJsonCache<ColorCache>(CACHE_PATH, empty());
  if (cache.version !== 1 || !cache.colors) Object.assign(cache, empty());
  cache._generated = NOTE;

  const toFetch = [...new Set(urls)].filter((u) => !(u in cache.colors));
  if (toFetch.length) {
    const results = await Promise.all(
      toFetch.map(async (u) => {
        const buf = await fetchBuffer(u);
        const color = buf ? await dominantSubjectHex(buf) : null;
        return [u, color] as const;
      }),
    );
    for (const [u, c] of results) cache.colors[u] = c;
    writeJsonCache(CACHE_PATH, cache);
  }

  const out = new Map<string, string>();
  for (const u of urls) {
    const c = cache.colors[u];
    if (c) out.set(u, c);
  }
  return out;
}
