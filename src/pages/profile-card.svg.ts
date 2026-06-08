import type { APIRoute } from 'astro';
import { loadProjects, getProfiles } from '../lib/load-projects';
import { aggregateStats, formatStat } from '../lib/aggregate-stats';
import config from '../lib/load-config';

// Animated SVG profile card meant for embedding in a GitHub README.
// Mounted at `<base>profile-card.svg` and built at the same cadence as
// the rest of the dashboard, so the numbers below stay in sync with what
// `/projects/` is showing.
//
// Layout (640×220, anchored at the top so it sits cleanly inline next
// to other README content):
//   - Header: small "LIVE PROJECT STATS · ARIKW" kicker + name + tagline
//   - Stats row: 4 evenly-spaced cells filling the card width
//   - Footer: single line with GitHub repos · Stack Overflow rep ·
//     dashboard link
//
// Why CSS animations instead of SMIL: GitHub's camo proxy serves SVGs
// fine and honours embedded `<style>`, but `<script>` is stripped.
// CSS keyframes are the cleanest way to express "fade in once on
// load" without writing per-element animate nodes. Transforms on
// SVG `<g>` elements behave unevenly across browsers though, so the
// animation here is a pure opacity fade — no translate, no scale.
// `prefers-color-scheme: dark` overrides inside the SVG let one URL
// adapt to either GitHub theme.
export const GET: APIRoute = async () => {
  const projects = await loadProjects();
  const stats = aggregateStats(projects);
  const profiles = getProfiles();

  const githubFact = profiles.find((p) => p.source === 'github');
  const stackoverflowFact = profiles.find((p) => p.source === 'stackoverflow');

  const githubRepos = typeof githubFact?.headline.value === 'number' ? githubFact.headline.value : null;
  const stackoverflowRep = typeof stackoverflowFact?.headline.value === 'number' ? stackoverflowFact.headline.value : null;

  const userName = config.user.name || 'Arik W.';
  const userHandle = config.user.github || 'arikw';
  const dashboardUrl = `${config.deployment.site}${config.deployment.base}`;
  const tagline = (config.user.bio ?? '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1') // strip markdown links
    .replace(/\.\s*Reach me on GitHub.*$/i, '')
    .replace(/\.\s*$/, '')
    .trim();

  // Hand-picked X positions for the 4 stat cells — evenly distributed
  // across a 580px usable width with 20px gap, so the column rhythm
  // is visible at a glance and the rightmost cell doesn't crowd the
  // card edge.
  const cellX = [0, 145, 290, 435];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 220" width="640" height="220" role="img" aria-label="${userName} — live project stats">
  <title>${userName} — live project stats</title>
  <style>
    :root {
      --bg: #fafaf7;
      --card: #ffffff;
      --fg: #1a1a1a;
      --muted: #6a6a6a;
      --accent: #2e4f6f;
      --border: #e8e3da;
      --live: #16a34a;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0c0d0f;
        --card: #1e2024;
        --fg: #ecebe5;
        --muted: #a8a39a;
        --accent: #94bcdb;
        --border: #3a3c41;
        --live: #4ade80;
      }
    }
    .bg { fill: var(--bg); }
    .card { fill: var(--card); stroke: var(--border); }
    .fg { fill: var(--fg); }
    .muted { fill: var(--muted); }
    .accent-rule { stroke: var(--accent); }
    .live-dot { fill: var(--live); }

    .serif { font-family: 'Fraunces', 'Source Serif Pro', ui-serif, Georgia, 'Times New Roman', serif; }
    .sans { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-feature-settings: 'tnum'; }
    .num { font-weight: 700; letter-spacing: -0.02em; }
    .label { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }

    /* Pure-opacity fade-in for the whole content layer. CSS transforms
       on SVG group elements render unevenly across browsers (the
       coordinate systems disagree on transform-origin), so the
       animation avoids translate/scale and stays subtle. */
    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .content { animation: fade-in 700ms ease-out backwards; }
  </style>

  <!-- Frame -->
  <rect class="bg" width="640" height="220" rx="14"/>
  <rect class="card" x="10" y="10" width="620" height="200" rx="10" stroke-width="1"/>

  <g class="content">
    <!-- Top kicker: live dot + label -->
    <g transform="translate(30 32)">
      <circle class="live-dot" cx="0" cy="-2" r="3.5"/>
      <text class="sans label muted" x="11" y="2">LIVE PROJECT STATS · ${userHandle.toUpperCase()}</text>
    </g>

    <!-- Title + tagline -->
    <text class="serif num fg" x="30" y="74" font-size="28">${userName}</text>
    ${tagline ? `<text class="sans muted" x="30" y="95" font-size="12">${tagline}</text>` : ''}
    <line class="accent-rule" x1="30" y1="106" x2="68" y2="106" stroke-width="2"/>

    <!-- Stats row -->
    <g transform="translate(30 144)">
      <g>
        <text class="serif num fg" font-size="30" x="${cellX[0]}" y="0">${formatStat(stats.starsAndLikes)}+</text>
        <text class="sans label muted" x="${cellX[0]}" y="18">★ Stars &amp; likes</text>
      </g>
      <g>
        <text class="serif num fg" font-size="30" x="${cellX[1]}" y="0">${formatStat(stats.downloadsAndPulls)}+</text>
        <text class="sans label muted" x="${cellX[1]}" y="18">↓ Downloads &amp; pulls</text>
      </g>
      <g>
        <text class="serif num fg" font-size="30" x="${cellX[2]}" y="0">${formatStat(stats.activeUsers)}+</text>
        <text class="sans label muted" x="${cellX[2]}" y="18">⏺ Active users</text>
      </g>
      <g>
        <text class="serif num fg" font-size="30" x="${cellX[3]}" y="0">${stats.totalProjects}</text>
        <text class="sans label muted" x="${cellX[3]}" y="18">▢ Projects shipped</text>
      </g>
    </g>

    <!-- Footer: side stats + clickable dashboard link on one line. -->
    <text class="sans muted" x="30" y="200" font-size="11">${
      [
        githubRepos != null ? `GitHub: <tspan class="fg" font-weight="600">${githubRepos}</tspan> repos` : '',
        stackoverflowRep != null ? `Stack Overflow: <tspan class="fg" font-weight="600">${formatStat(stackoverflowRep)}</tspan> rep` : '',
      ].filter(Boolean).join('  ·  ')
    }${githubRepos != null || stackoverflowRep != null ? '  ·  ' : ''}<a href="${dashboardUrl}" target="_blank"><tspan class="fg" font-weight="600" text-decoration="underline">↗ ${dashboardUrl.replace(/^https?:\/\//, '')}</tspan></a></text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // GitHub's camo proxy caches images aggressively — a short
      // Cache-Control isn't strictly enforced but signals intent.
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
