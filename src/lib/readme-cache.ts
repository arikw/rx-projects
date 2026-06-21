// Fetch + cache project READMEs and the images they reference. Designed to
// keep the build fast and to no-op when nothing changed upstream.
//
// Layout per project slug:
//   generated/.cache/readme/<slug>/meta.json       — { etag, contentHash, branch }
//   generated/.cache/readme/<slug>/url-map.json    — upstreamImageURL → local served path
//   generated/.cache/readme/<slug>/readme.md       — raw README (last known good)
//   public/_cache/readme/<slug>/<hash>.<ext>       — image bytes
//
// Update flow per project (three-tier short-circuit):
//
//   1. Conditional GET with If-None-Match. 304 → no work at all.
//   2. 200 → SHA the body. If hash matches stored hash, update stored ETag
//      (in case it rotated) and stop. No image work.
//   3. Hash differs (or first fetch) → diff image refs:
//      - Already in url-map AND file present on disk → reuse, no fetch.
//      - New or missing on disk → fetch with a tight timeout, no retries.
//        Failure is silent and the URL is left absent from url-map so the
//        rewrite layer falls through to the raw upstream URL. Next build
//        retries.
//      - Files in the folder whose basename isn't referenced by the new
//        url-map → delete.
//
// On 404 / 5xx / network error: leave EVERYTHING alone — the page renders
// from `readme.md` and `url-map.json` as last persisted. The next build will
// try again.

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readJsonCache, writeJsonCache } from './json-cache';

const CACHE_ROOT = 'generated/.cache/readme';
const PUBLIC_ROOT = 'public/_cache/readme';

const README_TIMEOUT_MS = 8000;
const IMAGE_TIMEOUT_MS = 5000;
const IMAGE_CONCURRENCY = 5;

export type ReadmeMeta = {
  version: 1;
  etag: string | null;
  contentHash: string | null;
  branch: string;
  lastFetched: string;
};

export type ReadmeUrlMap = {
  version: 1;
  _generated: string;
  map: Record<string, string>;
};

export type ReadmeCacheState = {
  /** The raw README text (rewriting happens at render time, not here). */
  readme: string | null;
  /** upstreamURL → public-relative path like "_cache/readme/<slug>/abc.png".
   *  Excludes leading slash and base — the rewrite layer prepends those. */
  imageMap: Record<string, string>;
};

export type FetchResult =
  | { kind: 'unchanged-304' }
  | { kind: 'unchanged-hash' }
  | { kind: 'updated'; imagesFetched: number; imagesReused: number; imagesFailed: number; imagesPurged: number }
  | { kind: 'gone-404' }
  | { kind: 'error'; reason: string };

const URL_MAP_NOTE =
  'Auto-generated. Maps original upstream image URLs (from a README) to local served paths. ' +
  'Maintained by src/lib/readme-cache.ts. Delete to force re-fetch.';

const emptyUrlMap = (): ReadmeUrlMap => ({ version: 1, _generated: URL_MAP_NOTE, map: {} });

const slugDir = (slug: string) => `${CACHE_ROOT}/${slug}`;
const metaPath = (slug: string) => `${slugDir(slug)}/meta.json`;
const urlMapPath = (slug: string) => `${slugDir(slug)}/url-map.json`;
const readmePath = (slug: string) => `${slugDir(slug)}/readme.md`;
const publicDir = (slug: string) => `${PUBLIC_ROOT}/${slug}`;

function readMeta(slug: string): ReadmeMeta | null {
  const m = readJsonCache<ReadmeMeta | null>(metaPath(slug), null);
  if (!m || m.version !== 1) return null;
  return m;
}

function writeMeta(slug: string, meta: ReadmeMeta) {
  writeJsonCache(metaPath(slug), meta);
}

function readUrlMap(slug: string): ReadmeUrlMap {
  const m = readJsonCache<ReadmeUrlMap>(urlMapPath(slug), emptyUrlMap());
  if (m.version !== 1 || !m.map) Object.assign(m, emptyUrlMap());
  m._generated = URL_MAP_NOTE;
  return m;
}

function writeUrlMap(slug: string, m: ReadmeUrlMap) {
  writeJsonCache(urlMapPath(slug), m);
}

function readReadme(slug: string): string | null {
  const path = resolve(process.cwd(), readmePath(slug));
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function writeReadme(slug: string, body: string) {
  const path = resolve(process.cwd(), readmePath(slug));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, 'utf8');
}

/** SHA-1 of body, first 16 hex chars — used both for content-hash short-circuit
 *  and image basename. SHA-1 is fine; collision risk on README-sized blobs is
 *  vanishingly small and shorter hashes keep filenames readable. */
function sha1Short(input: string | Uint8Array): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 16);
}

const IMAGE_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

function pickExt(contentType: string, url: string): string | null {
  const ct = contentType.split(';')[0].trim().toLowerCase();
  if (IMAGE_MIME_EXT[ct]) return IMAGE_MIME_EXT[ct];
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.([a-z0-9]{2,5})$/i);
    if (m) {
      const ext = m[1].toLowerCase();
      if (Object.values(IMAGE_MIME_EXT).includes(ext)) return ext;
    }
  } catch {
    /* malformed URL */
  }
  return null;
}

async function fetchWithTimeout(url: string, opts: RequestInit & { timeoutMs: number }): Promise<Response | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), opts.timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ac.signal, redirect: 'follow' });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Resolve a relative or absolute README image URL to a fully-qualified URL
 *  that can be fetched. The README itself has been rewritten to point at
 *  `raw.githubusercontent.com` for relatives, but we receive references both
 *  pre- and post-rewrite — this normalises. */
export function resolveImageUrl(
  href: string,
  owner: string,
  repo: string,
  branch: string,
): string | null {
  if (!href) return null;
  if (/^https?:\/\//.test(href)) return href;
  if (href.startsWith('//')) return 'https:' + href;
  if (href.startsWith('data:') || href.startsWith('mailto:') || href.startsWith('#')) return null;
  // Relative — point at raw.githubusercontent for the same branch.
  let path = href.replace(/^\.\//, '').replace(/^\//, '');
  const hashIdx = path.indexOf('#');
  if (hashIdx >= 0) path = path.slice(0, hashIdx);
  const qIdx = path.indexOf('?');
  if (qIdx >= 0) path = path.slice(0, qIdx);
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

/** Parse a README and return every image URL we should mirror locally.
 *  Covers markdown `![](url)` and inline `<img src="url">`.
 *
 *  Only same-repo assets are mirrored: a relative path resolves to
 *  raw.githubusercontent.com/<owner>/<repo>/..., and an absolute URL that
 *  already points at the same raw-content path is also accepted. Anything
 *  on a different host (shields.io, external CDNs, screenshot hosts) falls
 *  through to its live URL — see the design discussion about default
 *  caching scope. */
export function extractImageUrls(
  markdown: string,
  owner: string,
  repo: string,
  branch: string,
): string[] {
  const selfRawPrefix = `https://raw.githubusercontent.com/${owner}/${repo}/`;
  const urls = new Set<string>();
  const add = (raw: string) => {
    const wasRelative = !/^https?:\/\//.test(raw) && !raw.startsWith('//') && !raw.startsWith('data:');
    const resolved = resolveImageUrl(raw, owner, repo, branch);
    if (!resolved) return;
    // Cacheable only if it points at this repo's raw content. Relative refs
    // always resolve to that; absolute refs only if the README author wrote
    // a self-link explicitly.
    if (wasRelative || resolved.startsWith(selfRawPrefix)) urls.add(resolved);
  };
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) add(m[1]);
  for (const m of markdown.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) add(m[1]);
  return [...urls];
}

async function fetchOneImage(slug: string, url: string): Promise<{ servedPath: string } | null> {
  const res = await fetchWithTimeout(url, { timeoutMs: IMAGE_TIMEOUT_MS });
  if (!res || !res.ok) return null;
  const ct = res.headers.get('content-type') ?? '';
  const ext = pickExt(ct, url);
  if (!ext) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const hash = sha1Short(buf);
  const filename = `${hash}.${ext}`;
  const servedPath = `_cache/readme/${slug}/${filename}`;
  const diskPath = resolve(process.cwd(), publicDir(slug), filename);
  mkdirSync(dirname(diskPath), { recursive: true });
  writeFileSync(diskPath, buf);
  return { servedPath };
}

/** Run a list of async jobs with bounded concurrency. */
async function runWithLimit<T, R>(items: T[], limit: number, fn: (it: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Filesystem basename → list every file in the slug's public folder. */
function listCachedBasenames(slug: string): string[] {
  const dir = resolve(process.cwd(), publicDir(slug));
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  } catch {
    return [];
  }
}

function deleteCachedFile(slug: string, basename: string): void {
  const path = resolve(process.cwd(), publicDir(slug), basename);
  try {
    rmSync(path, { force: true });
  } catch {
    /* best-effort */
  }
}

export type UpdateOptions = {
  owner: string;
  repo: string;
  /** Slug used in cache paths — should be stable per project. */
  slug: string;
  /** Optional pre-known branch. If absent, we look it up via the GitHub API
   *  first and persist whatever it resolves to. */
  branch?: string;
  /** Bearer token for the GitHub API call that fetches default_branch — pass
   *  process.env.GITHUB_TOKEN for higher rate limits. raw.githubusercontent
   *  itself doesn't need auth. */
  githubToken?: string;
};

async function resolveBranch(owner: string, repo: string, token?: string, hint?: string): Promise<string> {
  if (hint) return hint;
  const headers: Record<string, string> = { 'User-Agent': 'rx-dev-dashboard-readme-cache' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}`, {
    headers,
    timeoutMs: README_TIMEOUT_MS,
  });
  if (!res || !res.ok) return 'main';
  try {
    const j = await res.json();
    return typeof j.default_branch === 'string' ? j.default_branch : 'main';
  } catch {
    return 'main';
  }
}

/** The main entry point. Idempotent. Performs the three-tier short-circuit
 *  and returns a FetchResult describing what happened. */
export async function updateReadmeCache(opts: UpdateOptions): Promise<FetchResult> {
  const { owner, repo, slug } = opts;
  const prevMeta = readMeta(slug);
  const branch = await resolveBranch(owner, repo, opts.githubToken, opts.branch ?? prevMeta?.branch);
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;

  // Tier 1 — conditional GET.
  const headers: Record<string, string> = { 'User-Agent': 'rx-dev-dashboard-readme-cache' };
  if (prevMeta?.etag) headers['If-None-Match'] = prevMeta.etag;
  const res = await fetchWithTimeout(rawUrl, { headers, timeoutMs: README_TIMEOUT_MS });

  if (!res) return { kind: 'error', reason: 'network/timeout' };
  if (res.status === 304) return { kind: 'unchanged-304' };
  if (res.status === 404) return { kind: 'gone-404' };
  if (!res.ok) return { kind: 'error', reason: `HTTP ${res.status}` };

  const body = await res.text();
  const newHash = sha1Short(body);
  const newEtag = res.headers.get('etag');

  // Tier 2 — content hash short-circuit. Note this can fire even when ETag
  // was absent or didn't match (some CDN tiers serve fresh ETags for
  // byte-identical bodies).
  if (prevMeta?.contentHash === newHash) {
    writeMeta(slug, {
      version: 1,
      etag: newEtag ?? prevMeta.etag,
      contentHash: newHash,
      branch,
      lastFetched: new Date().toISOString(),
    });
    return { kind: 'unchanged-hash' };
  }

  // Tier 3 — README changed. Persist the new body, then process images.
  writeReadme(slug, body);

  const imageUrls = extractImageUrls(body, owner, repo, branch);
  const prevUrlMap = readUrlMap(slug);
  const newMapEntries: Record<string, string> = {};
  let reused = 0;
  let fetched = 0;
  let failed = 0;

  type Job = { url: string; action: 'reuse' | 'fetch'; reusePath?: string };
  const jobs: Job[] = imageUrls.map((url) => {
    const prev = prevUrlMap.map[url];
    if (prev) {
      const diskPath = resolve(process.cwd(), 'public', prev);
      if (existsSync(diskPath)) return { url, action: 'reuse', reusePath: prev };
    }
    return { url, action: 'fetch' };
  });

  await runWithLimit(jobs, IMAGE_CONCURRENCY, async (job) => {
    if (job.action === 'reuse') {
      newMapEntries[job.url] = job.reusePath!;
      reused++;
      return;
    }
    const result = await fetchOneImage(slug, job.url);
    if (result) {
      newMapEntries[job.url] = result.servedPath;
      fetched++;
    } else {
      failed++;
    }
  });

  // Purge anything on disk that isn't referenced by the new url-map.
  const keepBasenames = new Set(Object.values(newMapEntries).map((p) => p.split('/').pop()!));
  const onDisk = listCachedBasenames(slug);
  let purged = 0;
  for (const name of onDisk) {
    if (!keepBasenames.has(name)) {
      deleteCachedFile(slug, name);
      purged++;
    }
  }

  // Persist new url-map + meta.
  writeUrlMap(slug, { version: 1, _generated: URL_MAP_NOTE, map: newMapEntries });
  writeMeta(slug, {
    version: 1,
    etag: newEtag,
    contentHash: newHash,
    branch,
    lastFetched: new Date().toISOString(),
  });

  return { kind: 'updated', imagesFetched: fetched, imagesReused: reused, imagesFailed: failed, imagesPurged: purged };
}

/** Read the persisted state for a slug without doing any network work.
 *  Render pipelines call this to decide what to display. */
export function getReadmeCacheState(slug: string): ReadmeCacheState {
  const readme = readReadme(slug);
  const urlMap = readUrlMap(slug);
  return { readme, imageMap: urlMap.map };
}

/** Synchronous existence check used by getStaticPaths to decide whether
 *  the README tier applies to a project. */
export function hasCachedReadme(slug: string): boolean {
  return existsSync(resolve(process.cwd(), readmePath(slug)));
}

/** Derive the readme-cache slug for a GitHub-backed project from its
 *  canonical source URL (e.g. `https://github.com/arikw/foo` → `arikw__foo`).
 *  Returns null when the project isn't recognisably hosted on GitHub. */
export function readmeSlugFromSourceUrl(sourceUrl: string | undefined): { slug: string; owner: string; repo: string } | null {
  if (!sourceUrl) return null;
  const m = sourceUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, '');
  return { slug: `${owner}__${repo}`, owner, repo };
}

/** Read meta.json for a slug. Returns null if absent or unreadable. */
export function getReadmeMeta(slug: string): ReadmeMeta | null {
  return readMeta(slug);
}

// ─── CHANGELOG cache (smaller sibling of the README cache) ─────────────
// Same conditional-GET + body-hash short-circuit, but no image processing
// because changelogs only carry text. Stored alongside the README in the
// same per-slug folder so a project that loses both stays consistent.

type ChangelogMeta = { version: 1; etag: string | null; contentHash: string | null; branch: string; lastFetched: string };
const changelogPath = (slug: string) => `${slugDir(slug)}/changelog.md`;
const changelogMetaPath = (slug: string) => `${slugDir(slug)}/changelog-meta.json`;

function readChangelogMeta(slug: string): ChangelogMeta | null {
  const m = readJsonCache<ChangelogMeta | null>(changelogMetaPath(slug), null);
  if (!m || m.version !== 1) return null;
  return m;
}
function writeChangelogMeta(slug: string, meta: ChangelogMeta) {
  writeJsonCache(changelogMetaPath(slug), meta);
}

/** Fetch CHANGELOG.md for a repo and persist if changed. Same short-circuit
 *  semantics as updateReadmeCache — if the changelog is unchanged or missing
 *  upstream, the disk state is left untouched. */
export async function updateChangelogCache(opts: {
  owner: string; repo: string; slug: string; branch: string; githubToken?: string;
}): Promise<'unchanged' | 'updated' | 'gone' | 'error'> {
  const { owner, repo, slug, branch } = opts;
  // CHANGELOG.md is the most common; we don't probe for other names. If the
  // project keeps their changelog elsewhere, they can land it via MDX
  // override anyway.
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/CHANGELOG.md`;
  const prev = readChangelogMeta(slug);
  const headers: Record<string, string> = { 'User-Agent': 'rx-dev-dashboard-changelog-cache' };
  if (prev?.etag) headers['If-None-Match'] = prev.etag;
  const res = await fetchWithTimeout(rawUrl, { headers, timeoutMs: README_TIMEOUT_MS });
  if (!res) return 'error';
  if (res.status === 304) return 'unchanged';
  if (res.status === 404) return 'gone';
  if (!res.ok) return 'error';
  const body = await res.text();
  const newHash = sha1Short(body);
  if (prev?.contentHash === newHash) {
    writeChangelogMeta(slug, { version: 1, etag: res.headers.get('etag') ?? prev.etag, contentHash: newHash, branch, lastFetched: new Date().toISOString() });
    return 'unchanged';
  }
  const path = resolve(process.cwd(), changelogPath(slug));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, 'utf8');
  writeChangelogMeta(slug, { version: 1, etag: res.headers.get('etag'), contentHash: newHash, branch, lastFetched: new Date().toISOString() });
  return 'updated';
}

export function getChangelog(slug: string): string | null {
  const path = resolve(process.cwd(), changelogPath(slug));
  if (!existsSync(path)) return null;
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

export function hasCachedChangelog(slug: string): boolean {
  return existsSync(resolve(process.cwd(), changelogPath(slug)));
}
