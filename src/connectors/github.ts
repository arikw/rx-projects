import type { Connector, UrlIdExtractor } from './types';
import type { ConnectorResult, ProjectKind } from '../types/project';
import { loadFixture, isPlaceholderHandle } from '../lib/fixtures';
import { readJsonCache, writeJsonCache } from '../lib/json-cache';

export const urlExtractors: UrlIdExtractor[] = [
  {
    hostnames: ['github.com', 'www.github.com'],
    extract: (url) => {
      const m = url.pathname.match(/^\/[^/]+\/([^/#?]+)/);
      return m ? { platform: 'github', id: m[1].replace(/\.git$/, '') } : null;
    },
  },
];

const MOBILE_TOPICS = new Set([
  'android',
  'ios',
  'react-native',
  'flutter',
  'swift-ui',
  'mobile',
]);
const EXTENSION_TOPICS = new Set([
  'chrome-extension',
  'chrome-extensions',
  'firefox-extension',
  'web-extension',
  'webextension',
  'gnome-extension',
  'gnome-shell-extension',
]);
const CLI_TOPICS = new Set(['cli', 'command-line', 'cli-tool', 'terminal']);
const LIBRARY_TOPICS = new Set(['library', 'sdk', 'framework']);

function deriveKind(topics: string[]): ProjectKind {
  const t = new Set(topics.map((s) => s.toLowerCase()));
  if ([...EXTENSION_TOPICS].some((k) => t.has(k))) return 'extension';
  if ([...MOBILE_TOPICS].some((k) => t.has(k))) return 'mobile';
  if ([...CLI_TOPICS].some((k) => t.has(k))) return 'cli';
  if ([...LIBRARY_TOPICS].some((k) => t.has(k))) return 'library';
  return 'app';
}

type GithubRepo = {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  topics?: string[];
  language: string | null;
  created_at: string;
  updated_at: string;
  fork: boolean;
  archived: boolean;
  has_pages: boolean;
};

// GitHub Pages favicon cache. Once we've fetched a repo's pages site and
// pulled its favicon URL, it's frozen — favicons rarely change, and a missing
// favicon (`null`) is a stable answer too. Delete generated/github-pages.json
// to force a refresh.
const PAGES_CACHE_PATH = 'generated/github-pages.json';
type PagesEntry = { pagesUrl: string; favicon: string | null };
type PagesCache = { version: 1; _generated: string; pages: Record<string, PagesEntry> };
const PAGES_CACHE_NOTE =
  'Auto-generated GitHub Pages favicons (fetched once per repo whose has_pages=true). Delete to refresh.';
const emptyPagesCache = (): PagesCache => ({ version: 1, _generated: PAGES_CACHE_NOTE, pages: {} });

/** Fallback icon for Pages projects whose site doesn't expose a favicon. */
const GITHUB_FAVICON = 'https://github.com/favicon.ico';

/** Conventional Pages URL for a repo: user/org site if the repo name matches
 * `<handle>.github.io`, project site otherwise. Custom domains still serve
 * from this URL (or redirect to it); we leave cname detection to the user
 * setting the repo's homepage field explicitly. */
function pagesUrlFor(handle: string, repo: string): string {
  const handleLower = handle.toLowerCase();
  const repoLower = repo.toLowerCase();
  if (repoLower === `${handleLower}.github.io`) return `https://${handleLower}.github.io/`;
  return `https://${handleLower}.github.io/${repo}/`;
}

/** Fetch the Pages site and extract a favicon URL. Tries (in order):
 *  - <link rel="icon" href="…">  (most common)
 *  - <link rel="shortcut icon" href="…">
 *  - <link rel="apple-touch-icon" href="…">
 *  - <pages-url>favicon.ico convention (last resort, no HEAD check). */
async function fetchPagesFavicon(pagesUrl: string): Promise<string | null> {
  let html: string;
  try {
    const res = await fetch(pagesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) rx-dev-dashboard/0.1',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  // Match <link rel="<one of icon variants>" href="..."> in either attribute order.
  const REL_VALUES = '(?:shortcut\\s+)?icon|apple-touch-icon|mask-icon';
  const relHref = new RegExp(
    `<link[^>]*\\brel=["'](?:${REL_VALUES})["'][^>]*\\bhref=["']([^"']+)["']`,
    'i',
  );
  const hrefRel = new RegExp(
    `<link[^>]*\\bhref=["']([^"']+)["'][^>]*\\brel=["'](?:${REL_VALUES})["']`,
    'i',
  );
  const m = html.match(relHref) ?? html.match(hrefRel);
  if (m) {
    try { return new URL(m[1], pagesUrl).toString(); } catch { /* fallthrough */ }
  }
  // Fallback: assume favicon.ico at the pages-url base.
  try { return new URL('favicon.ico', pagesUrl).toString(); } catch { return null; }
}

async function fetchPage(user: string, page: number, token?: string): Promise<GithubRepo[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'rx-dev-dashboard',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=updated&type=owner&page=${page}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text().catch(() => '')}`);
  return (await res.json()) as GithubRepo[];
}

async function fetchAllRepos(user: string, token?: string): Promise<GithubRepo[]> {
  const all: GithubRepo[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await fetchPage(user, page, token);
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

export const fetchGithubProjects: Connector = async (config, options) => {
  const handle = config.user.github;
  if (isPlaceholderHandle(handle)) return [];

  if (options?.fixtureMode) return loadFixture('github');

  const token = process.env.GITHUB_TOKEN;
  const repos = await fetchAllRepos(handle, token);

  const cfg = config.sources.github;
  const excludeSet = new Set(cfg.excludeRepos);

  // A repo named exactly after the handle is GitHub's "profile README" repo —
  // it renders the README on the user's profile, not a real project.
  const handleLower = handle.toLowerCase();

  // Filter the repo list first; only THEN look up Pages favicons for the
  // survivors (no point fetching favicons for repos we'll drop).
  const keptRepos = repos
    .filter((r) => cfg.includeForks || !r.fork)
    .filter((r) => !excludeSet.has(r.name))
    .filter((r) => r.name.toLowerCase() !== handleLower);

  // Populate the favicon cache for any has_pages repos we haven't seen before.
  const pagesCache = readJsonCache<PagesCache>(PAGES_CACHE_PATH, emptyPagesCache());
  if (pagesCache.version !== 1 || !pagesCache.pages) Object.assign(pagesCache, emptyPagesCache());
  pagesCache._generated = PAGES_CACHE_NOTE;

  const toFetch = keptRepos.filter((r) => r.has_pages && !pagesCache.pages[r.name]);
  if (toFetch.length) {
    const results = await Promise.all(
      toFetch.map(async (r) => {
        const pagesUrl = pagesUrlFor(handle, r.name);
        const favicon = await fetchPagesFavicon(pagesUrl);
        return [r.name, { pagesUrl, favicon }] as const;
      }),
    );
    for (const [name, entry] of results) pagesCache.pages[name] = entry;
    writeJsonCache(PAGES_CACHE_PATH, pagesCache);
  }

  return keptRepos.map<ConnectorResult>((r) => {
    const pagesEntry = r.has_pages ? pagesCache.pages[r.name] : undefined;
    // Pages URL stands in as homepage when the repo doesn't set one explicitly,
    // so the card's site badge surfaces it without changing UI.
    const homepage = r.homepage?.trim() || pagesEntry?.pagesUrl || undefined;
    return {
      // GitHub is the origin — its data is first-party, no mirror/native.
      // Archived repos still emit so URL extractors can merge them with their
      // npm / docker / chrome counterparts; the builder then drops the whole
      // merged group, so a project shipped to npm with an archived repo
      // disappears from the dashboard entirely.
      origin: {
        platform: 'github',
        id: r.name,
        url: r.html_url,
        asOf: r.updated_at,
        title: r.name,
        description: r.description ?? '',
        firstReleased: r.created_at ? new Date(r.created_at).getUTCFullYear() : undefined,
        tags: r.topics ?? [],
        language: r.language ?? undefined,
        kind: deriveKind(r.topics ?? []),
        openSource: true,
        archived: r.archived,
        sourceUrl: r.html_url,
        homepage,
        // The Pages favicon doubles as a per-project icon — much more
        // distinctive than the generic GitHub mark for repos that ship a site.
        // If the Pages site has no detectable favicon, fall back to GitHub's
        // own so the card still uses the icon layout (the Pages URL itself
        // signals "this ships as a github-hosted site").
        icon: pagesEntry?.favicon ?? (r.has_pages ? GITHUB_FAVICON : undefined),
        stats: { stars: r.stargazers_count, forks: r.forks_count },
      },
    };
  });
};
