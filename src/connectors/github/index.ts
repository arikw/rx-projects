import type { Connector } from '../types';
import { defineConnector, type UrlIdExtractor } from '../_define';
import { fetchGithubRepoProjects } from './projects';
import iconSvg from './icon.svg?raw';

export const urlExtractors: UrlIdExtractor[] = [
  {
    hostnames: ['github.com', 'www.github.com'],
    extract: (url) => {
      const m = url.pathname.match(/^\/[^/]+\/([^/#?]+)/);
      return m ? { platform: 'github', id: m[1].replace(/\.git$/, '') } : null;
    },
  },
];

/** Manifest — picked up by `_registry.ts` via auto-discovery. */
export default defineConnector({
  key: 'github',
  label: 'GitHub',
  brandMark: {
    svg: iconSvg,
    tint: '#0a0c12',
    fg: '#ffffff',
  },
  urlExtractors,
  defaultConfig: {
    enabled: true,
    includeForks: false,
    excludeRepos: [] as string[],
  },
  fetch: async (config, opts) => {
    const cfg = config.sources.github;
    const projects = await fetchGithubRepoProjects({
      handle: config.user.github,
      includeForks: cfg.includeForks,
      excludeRepos: cfg.excludeRepos,
      fixtureMode: opts?.fixtureMode,
    });
    return { projects };
  },
});

/** Legacy named export — kept while consumers haven't switched to the registry. */
export const fetchGithubProjects: Connector = async (config, options) => {
  const cfg = config.sources.github;
  return fetchGithubRepoProjects({
    handle: config.user.github,
    includeForks: cfg.includeForks,
    excludeRepos: cfg.excludeRepos,
    fixtureMode: options?.fixtureMode,
  });
};
