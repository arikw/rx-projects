import type { APIRoute } from 'astro';
import { loadProjects } from '../lib/load-projects';
import { aggregateStats, formatStat } from '../lib/aggregate-stats';

// The same headline numbers the profile card (profile-card.svg) shows, as
// JSON, so another site can render them. Built by the same `aggregateStats`
// call at the same cadence, so the two never disagree.
//
// Each stat carries the exact `value` plus a ready-to-show `display` string
// ("12.3K+") formatted exactly like the card.
//
//   curl <site>/stats.json
export const GET: APIRoute = async () => {
  const projects = await loadProjects();
  const stats = aggregateStats(projects);

  const stat = (value: number, suffix: string, label: string) => ({
    value,
    display: `${formatStat(value)}${suffix}`,
    label,
  });

  const body = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      stats: {
        starsAndLikes: stat(stats.starsAndLikes, '+', 'Stars & likes'),
        downloadsAndPulls: {
          ...stat(stats.downloadsAndPulls, '+', 'Downloads & pulls'),
          sources: stats.downloadSources,
        },
        activeUsers: {
          ...stat(stats.activeUsers, '+', 'Active users'),
          sources: stats.activeUsersSources,
        },
        totalProjects: stat(stats.totalProjects, '', 'Projects shipped'),
        openSourceCount: stat(stats.openSourceCount, '', 'Open source'),
      },
    },
    null,
    2,
  );
  return new Response(body, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
