import type { Connector } from '../types';
import type { ConnectorResult } from '../../types/project';
import { defineConnector, type UrlIdExtractor } from '../_define';
import { loadFixture } from '../../lib/fixtures';
import { readJsonCache, writeJsonCache } from '../../lib/json-cache';
import iconSvg from './icon.svg?raw';

export const urlExtractors: UrlIdExtractor[] = [
  {
    hostnames: ['stackoverflow.com', 'www.stackoverflow.com'],
    extract: (url) => {
      const m = url.pathname.match(/\/users\/(\d+)/);
      return m ? { platform: 'stackoverflow', id: m[1] } : null;
    },
  },
];

const CACHE_PATH = 'generated/stackoverflow.json';
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// What we keep from the SE API response. PII is deliberately *not* cached:
// display_name and profile_image are the canonical identifying fields and
// the dashboard publishes under the pseudonymous "Arik W." persona.
type SOUser = {
  user_id: number;
  reputation: number;
  answer_count?: number;
  question_count?: number;
  badge_counts: { gold: number; silver: number; bronze: number };
  link: string;
};
type SOCache = { version: 1; _generated: string; scrapedAt?: string; user?: SOUser };

const NOTE =
  'Auto-generated Stack Overflow profile snapshot. Refreshed when older than 7 days. PII (display_name, profile_image) is intentionally omitted.';
const empty = (): SOCache => ({ version: 1, _generated: NOTE });

/** Stack Overflow as an inline Simple Icons SVG (CC0). Used as the card icon
 *  so we don't need to fetch the user's profile photo. Until the ProjectCard
 *  consumer refactor drops the per-result `icon` field in favour of the
 *  brandMark on the manifest, the card still needs a URL/data-URI here. */
const SO_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
      "<rect width='24' height='24' rx='4' fill='#f48024'/>" +
      "<path fill='#ffffff' d='M17.36 20.2v-5.38h1.79V22H3v-7.18h1.8v5.38h12.56zm-9.97-2.04l8.78 1.83.37-1.76-8.78-1.84-.37 1.77zM8.55 14l8.13 3.78.76-1.62-8.13-3.79-.76 1.63zm2.37-3.99l6.89 5.73 1.15-1.36-6.89-5.74-1.15 1.37zm4.6-4.4l-1.44 1.07 5.34 7.18 1.44-1.07L15.52 5.61zM7.2 18.39h8.94v-1.79H7.2v1.79z'/>" +
      '</svg>',
  );

async function fetchSOUser(userId: string): Promise<SOUser | null> {
  // Stack Exchange API: 300 requests/day per IP without auth — fine for one
  // user fetched at most once a week.
  const url = `https://api.stackexchange.com/2.3/users/${encodeURIComponent(userId)}?site=stackoverflow`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'rx-dev-dashboard/0.1' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: SOUser[] };
    const u = data.items?.[0];
    if (!u || typeof u.user_id !== 'number') return null;
    return {
      user_id: u.user_id,
      reputation: u.reputation,
      answer_count: u.answer_count,
      question_count: u.question_count,
      badge_counts: u.badge_counts ?? { gold: 0, silver: 0, bronze: 0 },
      link: u.link,
    };
  } catch {
    return null;
  }
}

export const fetchStackoverflowProjects: Connector = async (config, options) => {
  const cfg = config.sources.stackoverflow;
  if (!cfg.enabled || !cfg.userId) return [];

  if (options?.fixtureMode) return loadFixture('stackoverflow');

  const cache = readJsonCache<SOCache>(CACHE_PATH, empty());
  if (cache.version !== 1) Object.assign(cache, empty());
  cache._generated = NOTE;

  const stale =
    !cache.scrapedAt || Date.now() - new Date(cache.scrapedAt).getTime() > REFRESH_MS;
  if (stale) {
    const u = await fetchSOUser(cfg.userId);
    if (u) {
      cache.user = u;
      cache.scrapedAt = new Date().toISOString();
      writeJsonCache(CACHE_PATH, cache);
    }
  }

  const u = cache.user;
  if (!u) return [];

  const totalBadges = u.badge_counts.gold + u.badge_counts.silver + u.badge_counts.bronze;
  const descParts = [
    `${u.reputation.toLocaleString()} reputation`,
    u.answer_count ? `${u.answer_count.toLocaleString()} answers` : null,
    totalBadges
      ? `${u.badge_counts.gold}🥇 ${u.badge_counts.silver}🥈 ${u.badge_counts.bronze}🥉`
      : null,
  ].filter(Boolean);

  return [
    {
      origin: {
        platform: 'stackoverflow',
        id: String(u.user_id),
        url: u.link,
        asOf: cache.scrapedAt,
        title: 'Stack Overflow',
        description: descParts.join(' · '),
        tags: ['stack-overflow', 'community'],
        kind: 'other',
        openSource: false,
        icon: SO_ICON,
        // Reputation slots into `stars` so it adds to the hero "Stars & likes"
        // count — same kind of social-validation signal.
        stats: { stars: u.reputation },
      },
    },
  ];
};

/** Manifest — picked up by `_registry.ts` via auto-discovery.
 *  The brandMark here describes what the card SHOULD render once consumers
 *  switch to reading brand marks from the manifest. The orange backplate that
 *  was baked into SO_ICON moves to `tint`; the white stack glyph in
 *  `icon.svg` uses `fill="currentColor"` so `fg` controls it. Until then, the
 *  connector keeps emitting `icon: SO_ICON` (a data URI of the orange tile +
 *  glyph) so the existing ProjectCard layout still renders. */
export default defineConnector({
  key: 'stackoverflow',
  label: 'Stack Overflow',
  brandMark: {
    svg: iconSvg,
    tint: '#f48024',
    fg: '#ffffff',
  },
  urlExtractors,
  defaultConfig: {
    enabled: true,
    userId: '',
  },
  fetch: async (config, opts) => {
    const projects = await fetchStackoverflowProjects(config, opts);
    return { projects };
  },
});
