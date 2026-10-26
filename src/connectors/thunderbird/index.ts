import type { Connector } from '../types';
import type { ConnectorResult } from '../../types/project';
import { defineConnector, type UrlIdExtractor } from '../_define';
import { loadFixture } from '../../lib/fixtures';

// Thunderbird Add-ons (addons.thunderbird.net). Like Chrome and GNOME there's
// no per-developer listing to discover from, so the add-ons to show are
// configured by their slug — the last part of
// addons.thunderbird.net/<locale>/thunderbird/addon/<slug>/.
//
// The site's public API only returns add-ons Mozilla has reviewed; one still
// awaiting review answers 401 and contributes nothing until it's approved.

export const urlExtractors: UrlIdExtractor[] = [
  {
    hostnames: ['addons.thunderbird.net'],
    extract: (url) => {
      const m = url.pathname.match(/\/thunderbird\/addon\/([^/#?]+)/);
      return m ? { platform: 'thunderbird', id: decodeURIComponent(m[1]) } : null;
    },
  },
];

/** The fields of /api/v4/addons/addon/<slug>/ this connector reads.
 *  Text fields are localized maps ({ "en-US": "…" }) or plain strings. */
type Localized = string | Record<string, string> | null | undefined;
type AtnAddon = {
  slug: string;
  name: Localized;
  summary: Localized;
  homepage: Localized;
  url: string;
  icon_url?: string;
  average_daily_users?: number;
  ratings?: { average?: number; count?: number };
  created?: string;
  tags?: string[];
  previews?: Array<{ image_url?: string }>;
};

const API = 'https://addons.thunderbird.net/api/v4/addons/addon/';

/** en-US first, else the first value. */
function text(v: Localized): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  return v['en-US'] ?? Object.values(v)[0];
}

async function fetchOne(slug: string): Promise<AtnAddon | null> {
  try {
    const res = await fetch(`${API}${encodeURIComponent(slug)}/`, {
      headers: { 'User-Agent': 'live-dev-portfolio' },
    });
    if (!res.ok) {
      console.warn(`[thunderbird] ${slug}: HTTP ${res.status}${res.status === 401 ? ' (not public yet — awaiting Mozilla review?)' : ''}`);
      return null;
    }
    return (await res.json()) as AtnAddon;
  } catch {
    return null;
  }
}

export const fetchThunderbirdProjects: Connector = async (config, options) => {
  const slugs = config.sources.thunderbird.addons;
  if (!slugs.length) return [];

  if (options?.fixtureMode) return loadFixture('thunderbird');

  const results = await Promise.all(slugs.map((s) => fetchOne(s)));
  return results
    .filter((a): a is AtnAddon => a !== null)
    .map<ConnectorResult>((a) => {
      const homepage = text(a.homepage)?.trim() || undefined;
      // A homepage on GitHub is the source repo: exposing it as `sourceUrl`
      // lets the builder merge this card with the repo's (as does the repo's
      // own homepage pointing at this listing).
      const sourceUrl = homepage && /(^|\/\/)(www\.)?github\.com\//i.test(homepage) ? homepage : undefined;
      const screenshots = (a.previews ?? []).map((p) => p.image_url).filter((u): u is string => !!u);
      return {
        origin: {
          platform: 'thunderbird',
          id: a.slug,
          url: `https://addons.thunderbird.net/thunderbird/addon/${a.slug}/`,
          title: text(a.name) ?? a.slug,
          description: text(a.summary) ?? '',
          tags: ['thunderbird-addon'],
          kind: 'extension',
          openSource: sourceUrl ? true : undefined,
          sourceUrl,
          homepage: sourceUrl ? undefined : homepage,
          icon: a.icon_url,
          screenshots: screenshots.length ? screenshots : undefined,
          firstReleased: a.created ? new Date(a.created).getUTCFullYear() : undefined,
          stats: {
            // "Users" on the listing: average daily users.
            users: a.average_daily_users,
            rating: a.ratings?.count
              ? { average: a.ratings.average ?? 0, count: a.ratings.count, max: 5 }
              : undefined,
          },
        },
      };
    });
};

/** Manifest — picked up by `_registry.ts` via auto-discovery. */
export default defineConnector({
  key: 'thunderbird',
  label: 'Thunderbird Add-ons',
  urlExtractors,
  defaultConfig: {
    enabled: true,
    addons: [] as string[],
  },
  fetch: async (config, opts) => {
    const projects = await fetchThunderbirdProjects(config, opts);
    return { projects };
  },
});
