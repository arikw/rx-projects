import type { Project } from '../types/project';

export type HeroStats = {
  /** GitHub stars + Docker Hub stars + Chrome Web Store rating counts. */
  starsAndLikes: number;
  /**
   * Combined reach signal. Docker pulls are true all-time. npm "last-year"
   * downloads are an annual proxy (npm doesn't track all-time). Chrome
   * "users" is current install count — included here as a baseline since
   * Chrome doesn't expose lifetime installs.
   */
  allTimeInstalls: number;
  /** npm last-month downloads + Chrome current users. */
  monthlyReach: number;
  totalProjects: number;
  openSourceCount: number;
};

const num = (n: number | undefined): number => n ?? 0;

export function aggregateStats(projects: Project[]): HeroStats {
  let starsAndLikes = 0;
  let allTimeInstalls = 0;
  let monthlyReach = 0;
  let openSourceCount = 0;

  for (const p of projects) {
    if (p.source !== 'manual') openSourceCount++;

    starsAndLikes +=
      num(p.stats.stars) + num(p.stats.dockerStars) + num(p.stats.ratingCount);

    allTimeInstalls +=
      num(p.stats.pulls) + num(p.stats.users) + num(p.stats.downloadsLastYear);

    monthlyReach += num(p.stats.downloadsMonthly) + num(p.stats.users);
  }

  return {
    starsAndLikes,
    allTimeInstalls,
    monthlyReach,
    totalProjects: projects.length,
    openSourceCount,
  };
}

/** Format a count for display: 1234 → "1.2K", 1_234_567 → "1.2M". */
export function formatStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}
