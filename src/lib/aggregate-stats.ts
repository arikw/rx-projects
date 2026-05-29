import type { Project } from '../types/project';

export type HeroStats = {
  /** GitHub stars + Docker Hub stars + "likes" = positive (4–5★) app ratings. */
  starsAndLikes: number;
  /**
   * Cumulative install/fetch events: npm all-time downloads + Docker pulls +
   * GNOME extension downloads + Google Play installs. These are event counts
   * (CI inflates npm/Docker), not unique people — kept separate from a
   * headcount on purpose.
   */
  downloadsAndPulls: number;
  /** Chrome Web Store current users — a point-in-time install headcount. */
  activeUsers: number;
  totalProjects: number;
  openSourceCount: number;
};

const num = (n: number | undefined): number => n ?? 0;

export function aggregateStats(projects: Project[]): HeroStats {
  let starsAndLikes = 0;
  let downloadsAndPulls = 0;
  let activeUsers = 0;
  let openSourceCount = 0;

  for (const p of projects) {
    // Non-manual sources are open-source by default, except entries flagged
    // explicitly closed (e.g. a retired Google Play app) — those are portfolio.
    if (p.source !== 'manual' && p.openSource !== false) openSourceCount++;

    // "Likes" = genuinely positive ratings: only 4★ and 5★ count, not the raw
    // rating count (which includes 1–2★ complaints).
    const h = p.stats.ratingHistogram;
    const likes = h && h.length >= 5 ? num(h[3]) + num(h[4]) : 0;
    starsAndLikes += num(p.stats.stars) + num(p.stats.dockerStars) + likes;

    downloadsAndPulls +=
      num(p.stats.downloadsAllTime) +
      num(p.stats.pulls) +
      num(p.stats.gnomeDownloads) +
      num(p.stats.installs);

    activeUsers += num(p.stats.users);
  }

  return {
    starsAndLikes,
    downloadsAndPulls,
    activeUsers,
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
