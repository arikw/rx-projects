import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Connector } from '../types';
import type { ConnectorResult } from '../../types/project';
import { defineConnector, type UrlIdExtractor } from '../_define';
import { loadFixture, isPlaceholderHandle } from '../../lib/fixtures';
import {
  readNpmCache,
  writeNpmCache,
  sumAllTime,
  REFETCH,
  type NpmDownloadsCache,
  type PackageDownloads,
} from '../../lib/npm-downloads-cache';
import iconSvg from './icon.svg?raw';

const runCurl = promisify(execFile);

export const urlExtractors: UrlIdExtractor[] = [
  {
    hostnames: ['www.npmjs.com', 'npmjs.com'],
    extract: (url) => {
      const m = url.pathname.match(/^\/package\/(@[^/]+\/[^/#?]+|[^/#?]+)/);
      return m ? { platform: 'npm', id: decodeURIComponent(m[1]) } : null;
    },
  },
];

type NpmLinks = { npm: string; homepage?: string; repository?: string };

type NpmSearchResult = {
  objects: Array<{
    package: {
      name: string;
      description?: string;
      keywords?: string[];
      date: string;
      links: NpmLinks;
    };
  }>;
};

const UA = { 'User-Agent': 'live-dev-portfolio' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class NotFoundError extends Error {}

// A couple of quick retries only — this runs in a cron, so we never stall long
// on a rate limit. If it keeps failing, we give up and let the next run retry
// (the cache is eventually-correct).
async function fetchJson<T>(url: string, tries = 3, extraHeaders: Record<string, string> = {}): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { ...UA, ...extraHeaders } });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) throw new NotFoundError(`404 ${url}`);
      // Rate limited / server error — short capped back-off, then retry.
      const retryAfter = Number(res.headers.get('retry-after')) * 1000;
      const wait = Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 300 * 2 ** i, 2000);
      lastErr = new Error(`${res.status} ${url}`);
      await sleep(wait);
      continue;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      lastErr = err;
      await sleep(Math.min(300 * 2 ** i, 2000));
    }
  }
  throw lastErr;
}

/** Run `fn` over items with bounded concurrency, preserving order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchPackagesByMaintainer(user: string): Promise<NpmSearchResult['objects']> {
  const all: NpmSearchResult['objects'] = [];
  for (let from = 0; from < 1000; from += 250) {
    const url = `https://registry.npmjs.org/-/v1/search?text=maintainer:${encodeURIComponent(user)}&size=250&from=${from}`;
    const data = await fetchJson<NpmSearchResult>(url);
    if (!data.objects?.length) break;
    all.push(...data.objects);
    if (data.objects.length < 250) break;
  }
  return all;
}

// Dependent-packages count from the same Spiferack JSON endpoint npmjs.com's
// own package page uses. Sending `X-Spiferack: 1` flips the response from HTML
// to JSON, and `dependents.dependentsCount` is the exact number the site
// renders — keeping the dashboard in lock-step with what visitors see on
// npmjs.com itself.
//
// npmjs.com is fronted by Cloudflare and gates on TLS fingerprint (Node's
// fetch handshake gets a 403 "Just a moment..."), so we shell out to curl —
// whose ClientHello passes — for this one call. Returns null on any
// failure; the caller falls back to the last cached value so a transient
// blip never drops the figure to 0.
async function fetchDependents(pkg: string): Promise<number | null> {
  const url = `https://www.npmjs.com/package/${encodeURIComponent(pkg)}`;
  try {
    const { stdout } = await runCurl(
      'curl',
      [
        '-sL', '--max-time', '15',
        // npmjs.com's Cloudflare gate flips a bare "Mozilla/5.0" to a 403
        // challenge but lets a full browser-style UA through — the rest of
        // the connector's UA stays as the bot label since the registry
        // and downloads APIs are unhostile.
        '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        '-H', 'X-Spiferack: 1',
        '-H', 'Accept: application/json',
        url,
      ],
      { maxBuffer: 4 * 1024 * 1024 },
    );
    if (!stdout || stdout[0] !== '{') return null;
    const data = JSON.parse(stdout) as { dependents?: { dependentsCount?: string | number } };
    const raw = data.dependents?.dependentsCount;
    const n = typeof raw === 'number' ? raw : raw != null ? parseInt(String(raw), 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

// Returns null on fetch failure (e.g. rate-limit) so a transient error is never
// recorded as a genuine 0 — the caller omits the stat instead of showing a lie.
async function fetchPointDownloads(pkg: string, period: string): Promise<number | null> {
  try {
    const data = await fetchJson<{ downloads?: number }>(
      `https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(pkg)}`,
    );
    return data.downloads ?? null;
  } catch {
    return null;
  }
}

/**
 * Sum one calendar year's daily downloads via the range endpoint.
 * Throws on request failure — callers must NOT cache a failure as 0, or a
 * transient rate-limit would silently corrupt the all-time total.
 */
async function fetchYearDownloads(pkg: string, year: number, created: Date, now: Date): Promise<number> {
  const start = new Date(Date.UTC(year, 0, 1));
  const from = start < created ? created : start;
  const end = new Date(Date.UTC(year, 11, 31));
  const to = end > now ? now : end;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const data = await fetchJson<{ downloads?: Array<{ downloads: number }> }>(
    `https://api.npmjs.org/downloads/range/${fmt(from)}:${fmt(to)}/${encodeURIComponent(pkg)}`,
  );
  return (data.downloads ?? []).reduce((sum, d) => sum + d.downloads, 0);
}

/** Fetch first-publish date from registry metadata. */
async function fetchCreated(pkg: string): Promise<string | null> {
  try {
    const data = await fetchJson<{ time?: { created?: string } }>(
      `https://registry.npmjs.org/${encodeURIComponent(pkg)}`,
    );
    return data.time?.created ?? null;
  } catch {
    return null;
  }
}

/** Ensure the cache has accurate per-year data for a package; returns it. */
async function refreshPackage(
  cache: NpmDownloadsCache,
  pkg: string,
  fallbackDate: string,
  now: Date,
): Promise<PackageDownloads> {
  let entry = cache.packages[pkg];
  if (!entry) {
    const created = (await fetchCreated(pkg)) ?? fallbackDate;
    entry = { created, years: {} };
    cache.packages[pkg] = entry;
  }

  const firstYear = new Date(entry.created).getUTCFullYear();
  const created = new Date(entry.created);
  const thisYear = now.getUTCFullYear();

  for (let y = firstYear; y <= thisYear; y++) {
    const cached = entry.years[String(y)];
    const mustRefresh = y >= thisYear - 1; // current + just-ended year are never frozen
    if (!mustRefresh && cached !== undefined && cached >= 0) continue; // frozen, complete
    try {
      entry.years[String(y)] = await fetchYearDownloads(pkg, y, created, now);
    } catch (err) {
      // Don't clobber a value we already have (e.g. a just-ended year we've
      // mostly captured) — only flag -1 when we have nothing for this year.
      if (!(cached !== undefined && cached >= 0)) entry.years[String(y)] = REFETCH;
      console.warn(
        `[npm] ${pkg} ${y} downloads fetch failed, will retry next run:`,
        err instanceof Error ? err.message : err,
      );
    }
    await sleep(100); // gentle gap between calls; cheap, keeps the cron quick
  }
  return entry;
}

export const fetchNpmProjects: Connector = async (config, options) => {
  const handle = config.user.npm;
  if (isPlaceholderHandle(handle)) return [];

  if (options?.fixtureMode) return loadFixture('npm');

  const cfg = config.sources.npm;
  const explicit = new Set(cfg.packages);
  const matches = await fetchPackagesByMaintainer(handle);
  const picked = explicit.size > 0 ? matches.filter((m) => explicit.has(m.package.name)) : matches;

  const cache = readNpmCache();
  const now = new Date();

  // Single gentle stream (with a small gap between calls) trips npm's rate
  // limiter far less than a parallel burst — and without backoff stalls it's
  // actually faster. Anything that still fails just refetches next cron run.
  const enriched = await mapLimit(picked, 1, async (m) => {
    const name = m.package.name;
    const fetched = await fetchPointDownloads(name, 'last-month');
    const dl = await refreshPackage(cache, name, m.package.date, now);
    if (fetched != null) dl.lastMonth = fetched; // persist last-good monthly
    const monthly = fetched ?? dl.lastMonth ?? null; // reuse cached when fetch failed
    const fetchedDependents = await fetchDependents(name);
    if (fetchedDependents != null) dl.dependents = fetchedDependents; // persist last-good
    const dependents = fetchedDependents ?? dl.dependents ?? null;
    return { entry: m, monthly, dependents, allTime: sumAllTime(dl), firstYear: new Date(dl.created).getUTCFullYear() };
  });

  writeNpmCache(cache);

  return enriched.map<ConnectorResult>(({ entry, monthly, dependents, allTime, firstYear }) => ({
    // npm registry is the origin. All-time → canonical `downloads`.
    origin: {
      platform: 'npm',
      id: entry.package.name,
      url: entry.package.links.npm,
      asOf: entry.package.date,
      title: entry.package.name,
      description: entry.package.description ?? '',
      firstReleased: firstYear,
      tags: entry.package.keywords ?? [],
      kind: 'package',
      openSource: true,
      homepage: entry.package.links.homepage,
      stats: {
        downloads: allTime,
        ...(monthly != null ? { downloadsMonthly: monthly } : {}),
        ...(dependents != null && dependents > 0 ? { dependents } : {}),
      },
    },
  }));
};

/** Manifest — picked up by `_registry.ts` via auto-discovery. */
export default defineConnector({
  key: 'npm',
  label: 'npm',
  emits: ['downloads', 'downloadsMonthly'],
  brandMark: {
    svg: iconSvg,
    tint: '#2d0707',
    fg: '#cb3837',
    // npm's own red on dark mode: skip the deep-burgundy tile and go
    // straight to the brand red as the surface so it pops.
    darkTint: '#cb3837',
    darkFg: '#ffffff',
  },
  urlExtractors,
  defaultConfig: {
    enabled: true,
    packages: [] as string[],
  },
  fetch: async (config, opts) => {
    const projects = await fetchNpmProjects(config, opts);
    return { projects };
  },
});
