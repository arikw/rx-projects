import type { Connector } from '../types';
import type { ConnectorResult } from '../../types/project';
import type { ThunderbirdFallback } from '../../types/config';
import { defineConnector, type UrlIdExtractor } from '../_define';
import { loadFixture } from '../../lib/fixtures';

// Thunderbird Add-ons (addons.thunderbird.net). Like Chrome and GNOME there's
// no per-developer listing to discover from, so the add-ons to show are
// configured by their slug — the last part of
// addons.thunderbird.net/<locale>/thunderbird/addon/<slug>/.
//
// The site's public API only returns add-ons Mozilla has reviewed; one still
// awaiting review answers 401. For that window an entry can carry a
// `fallback` (hand-copied from its page), used only while the API doesn't
// return the add-on — the live data replaces it on the first build after.

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

const listingUrl = (slug: string) => `https://addons.thunderbird.net/thunderbird/addon/${slug}/`;

function fromFallback(slug: string, f: ThunderbirdFallback): ConnectorResult {
  return {
    origin: {
      platform: 'thunderbird',
      id: slug,
      url: listingUrl(slug),
      title: f.title ?? slug,
      description: f.description ?? '',
      tags: ['thunderbird-addon'],
      kind: 'extension',
      openSource: f.sourceUrl ? true : undefined,
      sourceUrl: f.sourceUrl,
      icon: f.icon,
      screenshots: f.screenshots?.length ? f.screenshots : undefined,
      firstReleased: f.firstReleased,
      stats: f.users ? { users: f.users } : {},
    },
  };
}

export const fetchThunderbirdProjects: Connector = async (config, options) => {
  const entries = config.sources.thunderbird.addons.map((e) =>
    typeof e === 'string' ? { slug: e, fallback: undefined } : e,
  );
  if (!entries.length) return [];

  if (options?.fixtureMode) return loadFixture('thunderbird');

  const fetched = await Promise.all(entries.map((e) => fetchOne(e.slug)));
  const out: ConnectorResult[] = [];
  fetched.forEach((a, i) => {
    const { slug, fallback } = entries[i];
    if (a) out.push(fromApi(a));
    else if (fallback) out.push(fromFallback(slug, fallback));
  });
  return out;
};

function fromApi(a: AtnAddon): ConnectorResult {
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
      url: listingUrl(a.slug),
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
}

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
