import type { Connector } from '../types';
import type { ConnectorResult } from '../../types/project';
import { defineConnector, type UrlIdExtractor } from '../_define';
import { loadFixture } from '../../lib/fixtures';

/** Recognise both the legacy `chrome.google.com/webstore/detail/<slug>/<id>`
 * and the new `chromewebstore.google.com/detail/<slug?>/<id>` URLs. */
export const urlExtractors: UrlIdExtractor[] = [
  {
    hostnames: ['chrome.google.com', 'chromewebstore.google.com'],
    extract: (url) => {
      const m = url.pathname.match(/\/detail\/(?:[^/]+\/)?([a-p]{32})/);
      return m ? { platform: 'chrome', id: m[1] } : null;
    },
  },
];

type ChromeExtension = {
  id: string;
  title: string;
  description: string;
  url: string;
  users?: number;
  rating?: number;
  ratingCount?: number;
  image?: string;
  screenshots?: string[];
};

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function scrapeOne(id: string): Promise<ChromeExtension | null> {
  const url = `https://chromewebstore.google.com/detail/${encodeURIComponent(id)}`;
  let html: string;
  let finalUrl: string;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) live-dev-portfolio/0.1',
        'Accept-Language': 'en-US,en;q=0.9',
        // The CWS page is served gzipped only when Accept-Encoding announces
        // it; without this the server returns an empty body. Without
        // --compressed-equivalent decoding, Node's fetch would also decode
        // automatically, so requesting gzip is enough.
        'Accept-Encoding': 'gzip',
      },
    });
    if (!res.ok) return null;
    finalUrl = res.url;
    html = await res.text();
  } catch {
    return null;
  }

  // Taken-down extensions get redirected to `/detail/empty-title/<id>`
  // (a structural slug CWS uses for removed listings). Live extensions get
  // the real slug. The id stays in the URL either way, so the slug is the
  // signal — chrome-stats's mirror supplies metadata for the removed ones.
  const slug = finalUrl.match(/\/detail\/([^/]+)\//)?.[1];
  if (slug === 'empty-title') return null;

  // Title: prefer og:title; fall back to <title>. Both come with a
  // " - Chrome Web Store" suffix on this site, so strip it uniformly.
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)?.[1];
  const titleTag = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const rawTitle = decodeEntities((ogTitle ?? titleTag ?? id).trim());
  const title = rawTitle.replace(/\s*-\s*Chrome Web Store\s*$/, '');

  // Description: og:description or meta description
  const descMatch =
    html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/) ??
    html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/);
  const description = descMatch ? decodeEntities(descMatch[1]) : '';

  // Users: pattern like "1,000,000+ users" or "12,345 users"
  let users: number | undefined;
  const usersMatch = html.match(/([\d,]+)\+?\s*users?/i);
  if (usersMatch) {
    const n = parseInt(usersMatch[1].replace(/,/g, ''), 10);
    if (Number.isFinite(n)) users = n;
  }

  // Rating: aggregateRating in JSON-LD or inline
  let rating: number | undefined;
  let ratingCount: number | undefined;
  const ldBlocks = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]+?)<\/script>/g);
  if (ldBlocks) {
    for (const block of ldBlocks) {
      const inner = block.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
      try {
        const data = JSON.parse(inner);
        const candidates = Array.isArray(data) ? data : [data];
        for (const item of candidates) {
          const agg = item?.aggregateRating;
          if (agg) {
            const r = parseFloat(agg.ratingValue);
            const c = parseInt(agg.ratingCount, 10);
            if (Number.isFinite(r)) rating = r;
            if (Number.isFinite(c)) ratingCount = c;
            break;
          }
        }
        if (rating !== undefined) break;
      } catch {
        // Skip non-JSON blocks; some pages embed templates.
      }
    }
  }

  const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1];

  // Screenshots — CWS marks the extension's own gallery items with
  // `<div role="button" aria-label="Item media N (screenshot) for <title>"
  // data-media-url="https://lh3.googleusercontent.com/...">`. The
  // data-media-url is the base; we append `=s550-w550-h350` for a sensible
  // gallery resolution. Anchoring on `Item media (screenshot)` confines
  // the extraction to THIS extension — earlier `=s550-w550-h350` heuristic
  // also matched marquees from related-extension cards on the same page.
  //
  // Sort by the `aria-label="Item media N"` index — the CWS HTML
  // emits buttons in (preview-strip → thumbnail row) order, NOT the
  // intended display order. `N` is what the listing actually shows.
  const itemMediaButton = new RegExp('<div\\b([^>]+role="button"[^>]+)>', 'g');
  const seen = new Map<string, number>();
  for (const m of html.matchAll(itemMediaButton)) {
    const attrs = m[1];
    const nMatch = attrs.match(/aria-label="Item media (\d+) \(screenshot\)/);
    if (!nMatch) continue;
    const urlMatch = attrs.match(/data-media-url="([^"]+)"/);
    if (!urlMatch) continue;
    // Reject anything that didn't come from googleusercontent — defensive
    // against future CWS markup tweaks that might point at video or other
    // hosts.
    if (!/^https:\/\/lh\d+\.googleusercontent\.com\//.test(urlMatch[1])) continue;
    const url = urlMatch[1];
    const n = parseInt(nMatch[1], 10);
    // Same URL appears multiple times (preview + thumbnail row).
    // Keep the lowest N so dedup-by-URL leaves the display position.
    if (!seen.has(url) || n < seen.get(url)!) seen.set(url, n);
  }
  const screenshotUrls = [...seen.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([url]) => url);

  return {
    id,
    title,
    description,
    url,
    users,
    rating,
    ratingCount,
    image: ogImage ? decodeEntities(ogImage) : undefined,
    screenshots: screenshotUrls.length ? screenshotUrls.map((u) => `${u}=s550-w550-h350`) : undefined,
  };
}

export const fetchChromeProjects: Connector = async (config, options) => {
  const ids = config.sources.chrome.extensionIds;
  if (!ids.length) return [];

  if (options?.fixtureMode) return loadFixture('chrome');

  const results = await Promise.all(ids.map((id) => scrapeOne(id)));
  const valid = results.filter((r): r is ChromeExtension => r !== null);

  return valid.map<ConnectorResult>((ext) => ({
    // Chrome Web Store is the origin (it hosts the extension).
    origin: {
      platform: 'chrome',
      id: ext.id,
      url: ext.url,
      title: ext.title,
      description: ext.description,
      tags: ['chrome-extension'],
      kind: 'extension',
      // CWS's og:image is the extension's 128×128 icon (=s128-rj-…), not a
      // banner. chrome-stats supplies the real marquee separately; when both
      // exist the banner layout wins, when only this one does the icon layout
      // renders the icon at a sane size instead of stretching it into a banner.
      icon: ext.image,
      ...(ext.screenshots?.length ? { screenshots: ext.screenshots } : {}),
      stats: {
        ...(ext.users != null ? { users: ext.users } : {}),
        ...(ext.rating != null && ext.ratingCount != null
          ? { rating: { average: ext.rating, count: ext.ratingCount } }
          : {}),
      },
    },
  }));
};

/** Manifest — picked up by `_registry.ts` via auto-discovery. */
export default defineConnector({
  key: 'chrome',
  label: 'Chrome',
  emits: ['users', 'rating'],
  urlExtractors,
  defaultConfig: {
    enabled: true,
    extensionIds: [] as string[],
  },
  fetch: async (config, opts) => {
    const projects = await fetchChromeProjects(config, opts);
    return { projects };
  },
});
