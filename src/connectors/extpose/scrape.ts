import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0';

export type ExtposeApp = {
  id: string;
  url: string;
  name?: string;
  description?: string;
  /** Install-count floor, parsed from `interactionCount=UserDownloads:<n>`. */
  userCount?: number;
  rating?: { value: number; count: number };
  version?: string;
  /** ISO date string, from itemprop="dateModified". */
  lastUpdate?: string;
  /** True when the page shows a "Delisted on YYYY-MM-DD" marker. */
  isDeleted?: boolean;
  /** Square 128×128 icon, from the page's <img itemprop="image"> tag. The
   *  same Google-CDN bytes the Chrome Web Store uses — stays alive after
   *  a listing is removed, which is the whole point. */
  icon?: string;
  /** 640×400 promo banner, from og:image. */
  banner?: string;
  /** Long-form description copy carried verbatim from the CWS listing —
   *  Extpose renders it inside `<div itemprop="description"><p>…</p>…</div>`
   *  on the detail page. Joined paragraphs separated by a blank line so
   *  Marked renders them as separate `<p>`s. Unlike chrome-stats's
   *  `<div class="meta-summary">` (an AI-generated summary), this is
   *  the original developer copy. */
  body?: string;
};

// extpose sits behind Cloudflare like chrome-stats and appbrain; curl with
// realistic headers passes, Node's undici-based fetch is fingerprinted and
// blocked. Same shell-out trick.
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const { stdout } = await run(
      'curl',
      [
        '-sL',
        '--max-time',
        '25',
        '-A',
        UA,
        '-H',
        'Accept-Language: en-US,en;q=0.9',
        '-H',
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        url,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    return stdout || null;
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function pickMetaContent(doc: string, attr: string, value: string): string | undefined {
  const re = new RegExp(`<meta[^>]+${attr}="${value}"[^>]+content="([^"]+)"`);
  const m = doc.match(re);
  return m ? decodeEntities(m[1]) : undefined;
}

function pickItempropText(doc: string, name: string): string | undefined {
  // The same itemprop can appear on multiple elements (e.g. a header wrapper
  // and the visible paragraph that follows). Walk every match and return the
  // first one whose captured text isn't blank.
  const re = new RegExp(`itemprop="${name}"[^>]*>([^<]+)<`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc))) {
    const text = decodeEntities(m[1]).trim();
    if (text) return text;
  }
  return undefined;
}

/** Extract the long-form description body from Extpose's
 *  `<div itemprop="description"><p>…</p>…</div>` block. Returns a
 *  blank-line-separated paragraph string ready for Marked, or
 *  undefined when the listing has no body (rare). */
function pickItempropBody(doc: string, name: string): string | undefined {
  // Anchor on `itemprop="<name>">` directly — the opening tag preceding
  // it on Extpose carries Tailwind classes like
  // `class="[&>p]:mb-4 [&>p:last-child]:mb-0"` whose literal `>` would
  // break a naive `<div[^>]+itemprop=…>` match (the `[^>]+` stops at
  // the FIRST `>`, inside the class string, never reaching itemprop).
  // Skip the opening tag entirely, capture until the next closing
  // `</div>` or `</section>`.
  const re = new RegExp(`itemprop="${name}"\\s*>([\\s\\S]*?)</(?:div|section)>`);
  const m = doc.match(re);
  if (!m) return undefined;
  const inner = m[1];
  // Pull every <p>…</p> inside. Each block becomes one paragraph in
  // the output markdown; non-<p> stray whitespace/elements are dropped.
  const paragraphs: string[] = [];
  const pre = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let pm: RegExpExecArray | null;
  while ((pm = pre.exec(inner))) {
    // Strip any nested tags (Extpose sometimes wraps URLs in <a>) and
    // collapse the result to a single line so paragraph breaks are
    // controlled by the join below, not by embedded \n.
    const text = decodeEntities(pm[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (text) paragraphs.push(text);
  }
  if (!paragraphs.length) return undefined;
  return paragraphs.join('\n\n');
}

export async function scrapeOne(extId: string): Promise<ExtposeApp | null> {
  const url = `https://extpose.com/ext/${encodeURIComponent(extId)}`;
  const doc = await fetchHtml(url);
  if (!doc) return null;

  // Friendly name lives in <h1 itemprop="name">…</h1>. Fall back to og:title
  // minus the " on Extpose" suffix when the h1 capture misses (defensive).
  const ogTitle = pickMetaContent(doc, 'property', 'og:title');
  const name =
    pickItempropText(doc, 'name') ??
    (ogTitle ? ogTitle.replace(/\s+on\s+Extpose\s*$/i, '') : undefined);
  if (!name) return null;

  const description =
    pickItempropText(doc, 'alternativeHeadline') ??
    pickMetaContent(doc, 'property', 'og:description');

  const userMatch = doc.match(/itemprop="interactionCount"[^>]+content="UserDownloads:(\d+)"/);
  const userCount = userMatch ? Number(userMatch[1]) : undefined;

  const ratingValueRaw = pickMetaContent(doc, 'itemprop', 'ratingValue');
  const ratingCountRaw = pickMetaContent(doc, 'itemprop', 'ratingCount');
  const rValue = ratingValueRaw ? Number(ratingValueRaw) : NaN;
  const rCount = ratingCountRaw ? Number(ratingCountRaw) : NaN;
  const rating =
    Number.isFinite(rValue) && Number.isFinite(rCount)
      ? { value: Math.round(rValue * 100) / 100, count: rCount }
      : undefined;

  const version = pickMetaContent(doc, 'itemprop', 'softwareVersion');
  const lastUpdate = pickMetaContent(doc, 'itemprop', 'dateModified');

  // Icon: <img itemprop="image" src="..."> — square Google-CDN image. The
  // attribute order varies (some pages put src before itemprop), so capture
  // both arrangements.
  const iconMatch =
    doc.match(/<img[^>]+itemprop="image"[^>]+src="([^"]+)"/) ??
    doc.match(/<img[^>]+src="([^"]+)"[^>]+itemprop="image"/);
  const icon = iconMatch ? decodeEntities(iconMatch[1]) : undefined;

  const banner = pickMetaContent(doc, 'property', 'og:image');

  const body = pickItempropBody(doc, 'description');

  return {
    id: extId,
    url,
    name,
    description,
    userCount: Number.isFinite(userCount) ? userCount : undefined,
    rating,
    version,
    lastUpdate,
    isDeleted: /\bDelisted on\s+\d{4}-\d{2}-\d{2}/.test(doc),
    icon,
    banner,
    body,
  };
}
