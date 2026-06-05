import { injectDelta, populateVisitSummary, formatRelativeTime, readHashParam } from './delta-injection';

type ProjectStats = {
  stars?: number;
  downloads?: number;
  downloadsMonthly?: number;
  users?: number;
  installs?: number;
};

type ProfileSnapshot = {
  headline: { label: string; value: number };
  details: Array<{ label: string; value: number }>;
};

type DashboardState = {
  version: 2;
  generatedAt: string;
  contentHash: string;
  hero: {
    starsAndLikes: number;
    downloadsAndPulls: number;
    activeUsers: number;
    totalProjects: number;
  };
  projects: Record<string, ProjectStats>;
  profiles: Record<string, ProfileSnapshot>;
  /** Optional friendly title for each project id — used for the
   *  visit-summary "N new projects" hover tooltip. */
  projectTitles?: Record<string, string>;
};

type StoredState = {
  version: 2;
  diffBase: DashboardState;
  diffBaseSetAt: string;
  lastSeen: DashboardState;
  lastSeenSetAt: string;
};

const STORAGE_KEY = 'rx-dashboard-last-visit';

function readCurrent(): DashboardState | null {
  const el = document.querySelector<HTMLScriptElement>('#dashboard-state');
  if (!el?.textContent) return null;
  try {
    const parsed = JSON.parse(el.textContent);
    if (parsed?.version === 2 && parsed.contentHash) return parsed as DashboardState;
  } catch {
    return null;
  }
  return null;
}

function readStored(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed?.version === 2 &&
      parsed.diffBase?.contentHash &&
      parsed.lastSeen?.contentHash &&
      typeof parsed.diffBaseSetAt === 'string' &&
      typeof parsed.lastSeenSetAt === 'string'
    ) {
      return parsed as StoredState;
    }
  } catch {
    return null;
  }
  return null;
}

function saveStored(state: StoredState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / storage disabled */
  }
}

const CARD_STAT_MAP: Array<{ key: keyof ProjectStats; label: string }> = [
  { key: 'stars', label: 'Stars' },
  { key: 'downloads', label: 'Downloads' },
  { key: 'downloadsMonthly', label: 'Monthly downloads' },
  { key: 'installs', label: 'Installs' },
  { key: 'users', label: 'Users' },
];

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1000) {
    const k = n / 1000;
    return `${k.toFixed(Math.abs(k) < 10 ? 1 : 0).replace(/\.0$/, '')}k`;
  }
  return String(n);
}

/** Find each card whose stats moved since `base`, decide a single
 *  headline metric (the largest absolute delta), and render an "updated"
 *  chip into the card's slot. The chip's hover tooltip lists every
 *  metric that moved. Skips cards that are themselves newly added,
 *  since the NEW ribbon already conveys the change. */
function injectCardUpdates(base: DashboardState, current: DashboardState, newIds: Set<string>): void {
  for (const [id, currStats] of Object.entries(current.projects)) {
    if (newIds.has(id)) continue;
    const baseStats = base.projects[id];
    if (!baseStats) continue;
    const deltas: Array<{ key: keyof ProjectStats; label: string; value: number }> = [];
    for (const { key, label } of CARD_STAT_MAP) {
      const delta = (currStats[key] ?? 0) - (baseStats[key] ?? 0);
      if (delta !== 0) deltas.push({ key, label, value: delta });
    }
    if (!deltas.length) continue;
    const headline = deltas.reduce((best, d) =>
      Math.abs(d.value) > Math.abs(best.value) ? d : best,
    );
    const card = document.querySelector<HTMLElement>(`.card[data-id="${CSS.escape(id)}"]`);
    const slot = card?.querySelector<HTMLElement>('.card-updated-chip');
    if (!slot) continue;
    const direction: 'up' | 'down' = headline.value > 0 ? 'up' : 'down';
    const arrow = direction === 'up' ? '▲' : '▼';
    const sign = direction === 'up' ? '+' : '−';
    slot.classList.toggle('is-negative', direction === 'down');
    slot.innerHTML = `<span class="stat-delta-arrow" aria-hidden="true">${arrow}</span>${sign}${formatCompact(Math.abs(headline.value))}`;
    const tooltip = deltas
      .map((d) => `${d.label} ${d.value > 0 ? '+' : '−'}${formatCompact(Math.abs(d.value))}`)
      .join(' · ');
    slot.dataset.tooltip = tooltip;
    slot.removeAttribute('hidden');
  }
}

const HERO_MAP = [
  { key: 'starsAndLikes',     stat: 'star',     label: 'stars & likes' },
  { key: 'downloadsAndPulls', stat: 'download', label: 'downloads' },
  { key: 'activeUsers',       stat: 'users',    label: 'active users' },
  { key: 'totalProjects',     stat: 'projects', label: 'projects' },
] as const;

function injectDeltas(base: DashboardState, current: DashboardState, diffBaseSetAt: string): void {
  const relativeTime = `since ${formatRelativeTime(diffBaseSetAt)}`;

  for (const { key, stat, label } of HERO_MAP) {
    const delta = current.hero[key] - base.hero[key];
    if (delta === 0) continue;
    const tile = document.querySelector(`.stat[data-stat-key="${stat}"]`);
    const slot = tile?.querySelector<HTMLElement>('.stat-delta');
    if (slot) {
      injectDelta(slot, { value: Math.abs(delta), direction: delta > 0 ? 'up' : 'down', label }, relativeTime);
    }
  }

  for (const [source, profile] of Object.entries(current.profiles)) {
    const baseProfile = base.profiles[source];
    if (!baseProfile) continue;
    const chip = document.querySelector(`.profile-chip[data-profile-source="${source}"]`);
    if (!chip) continue;

    const headDelta = profile.headline.value - baseProfile.headline.value;
    if (headDelta !== 0) {
      const slot = chip.querySelector<HTMLElement>(`.stat-delta[data-fact-label="${CSS.escape(profile.headline.label)}"]`);
      if (slot) {
        injectDelta(slot, { value: Math.abs(headDelta), direction: headDelta > 0 ? 'up' : 'down', label: profile.headline.label }, relativeTime);
      }
    }
    for (const detail of profile.details) {
      const baseDetail = baseProfile.details.find((d) => d.label === detail.label);
      if (!baseDetail) continue;
      const delta = detail.value - baseDetail.value;
      if (delta === 0) continue;
      const slot = chip.querySelector<HTMLElement>(`.stat-delta[data-fact-label="${CSS.escape(detail.label)}"]`);
      if (slot) {
        injectDelta(slot, { value: Math.abs(delta), direction: delta > 0 ? 'up' : 'down', label: detail.label }, relativeTime);
      }
    }
  }

  const baseIds = new Set(Object.keys(base.projects));
  const currentIds = new Set(Object.keys(current.projects));
  const titleFor = (id: string): string =>
    current.projectTitles?.[id] ?? base.projectTitles?.[id] ?? id;
  const newProjectNames: string[] = [];
  const newIds = new Set<string>();
  for (const id of currentIds) {
    if (baseIds.has(id)) continue;
    newIds.add(id);
    newProjectNames.push(titleFor(id));
    const card = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
    const ribbon = card?.querySelector<HTMLElement>('.card-new-ribbon');
    if (ribbon) ribbon.removeAttribute('hidden');
  }
  const removedProjectNames: string[] = [];
  for (const id of baseIds) {
    if (!currentIds.has(id)) removedProjectNames.push(titleFor(id));
  }
  injectCardUpdates(base, current, newIds);
  if (newProjectNames.length > 0 || removedProjectNames.length > 0) {
    populateVisitSummary({
      newProjectCount: newProjectNames.length,
      removedProjectCount: removedProjectNames.length,
      newProjectNames,
      removedProjectNames,
      relativeTime,
    });
  }
}

function init(): void {
  if (readHashParam('stats-demo')) return;
  const current = readCurrent();
  if (!current) return;
  const now = new Date().toISOString();

  const stored = readStored();
  if (!stored) {
    saveStored({ version: 2, diffBase: current, diffBaseSetAt: now, lastSeen: current, lastSeenSetAt: now });
    return;
  }

  if (stored.lastSeen.contentHash !== current.contentHash) {
    stored.diffBase = stored.lastSeen;
    stored.diffBaseSetAt = stored.lastSeenSetAt;
    stored.lastSeen = current;
    stored.lastSeenSetAt = now;
  } else {
    stored.lastSeenSetAt = now;
  }
  saveStored(stored);

  if (stored.diffBase.contentHash === current.contentHash) return;
  injectDeltas(stored.diffBase, current, stored.diffBaseSetAt);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
