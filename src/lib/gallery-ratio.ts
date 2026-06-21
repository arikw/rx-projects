// Build-time helper that picks the best `aspect-ratio` value for a
// project's gallery envelope based on the actual dimensions of its
// screenshots. Returns one of: '16 / 10', '16 / 9', or null.
//
// SCOPE: only overrides the default when the project's screenshots
// are clearly landscape AND close to either of the two acceptable
// targets (16:10 ≈ CWS 1280×800, 16:9 ≈ HD video). For anything
// outside that window — portrait phone screenshots, square images,
// very-wide banners — returns null and lets the CSS default (16:9)
// take over. Portrait content then letterboxes inside the 16:9 box
// with the blurred ambient backdrop filling the side margins, which
// reads better than an awkwardly tall portrait section dominating
// the page.
//
// The result is intended for a `--gallery-aspect-ratio` CSS custom
// property set on the gallery section.

import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import config from './load-config';
import type { Project } from '../types/project';

/** Map a served URL back to a local filesystem path under `public/`,
 *  or return null when the URL doesn't live in the cache. Handles
 *  the deployment-base prefix (`/projects/_cache/...`) and bare
 *  /public-relative paths (`/manual-media/foo.png`). */
function urlToLocalPath(url: string): string | null {
  let path: string | null = null;
  const base = config.deployment.base;
  const baseWithSlash = base.endsWith('/') ? base : `${base}/`;
  if (url.startsWith(baseWithSlash)) {
    path = `public/${url.slice(baseWithSlash.length)}`;
  } else if (url.startsWith('/') && !url.startsWith('//')) {
    path = `public${url}`;
  }
  if (!path) return null;
  return existsSync(path) ? resolve(path) : null;
}

/** Probe an image's natural dimensions. Returns null on any failure
 *  (unsupported format, corrupt bytes, missing file) — caller skips
 *  the failed image and uses the others. */
async function probeDimensions(filePath: string): Promise<{ w: number; h: number } | null> {
  try {
    const m = await sharp(filePath).metadata();
    if (typeof m.width === 'number' && typeof m.height === 'number' && m.height > 0) {
      return { w: m.width, h: m.height };
    }
  } catch {
    // sharp couldn't parse — corrupt / unsupported / missing
  }
  return null;
}

/** Snap a measured ratio to a CSS aspect-ratio value, but ONLY when
 *  the measurement falls in the landscape "16:10 to 16:9" window
 *  (1.5 to 1.9 wide-to-tall). Outside that window — extra-wide
 *  banners, square-ish content, anything portrait — return null so
 *  the caller falls back to the CSS default (16/9). Portrait
 *  galleries get a 16:9 envelope with the blurred ambient backdrop
 *  filling the side margins; that reads better than an awkwardly
 *  tall portrait section dominating the page. */
function snapToStandard(ratio: number): string | null {
  if (ratio < 1.5 || ratio > 1.9) return null;
  // Geometric midpoint between 16:10 (1.60) and 16:9 (1.78) is
  // sqrt(1.60 × 1.78) ≈ 1.687. Below → snap to 16:10, above → 16:9.
  return ratio < 1.687 ? '16 / 10' : '16 / 9';
}

/** Compute the aspect-ratio string to apply to a project's gallery
 *  envelope, or null when no measurement could be made (project has
 *  no screenshots, or all screenshot URLs point outside the cache).
 *  The caller treats null as "use the CSS default (16/9)". */
export async function computeGalleryRatio(project: Project): Promise<string | null> {
  const urls = project.screenshots ?? [];
  if (urls.length === 0) return null;
  const ratios: number[] = [];
  for (const url of urls) {
    const path = urlToLocalPath(url);
    if (!path) continue;
    const dim = await probeDimensions(path);
    if (dim) ratios.push(dim.w / dim.h);
  }
  if (ratios.length === 0) return null;
  ratios.sort((a, b) => a - b);
  // Median, not mean — one weird tall outlier (e.g. a sidebar PNG)
  // shouldn't swing the envelope away from the bulk of normal shots.
  const median = ratios[Math.floor(ratios.length / 2)];
  return snapToStandard(median);
}
