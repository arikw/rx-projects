import { injectDelta, populateVisitSummary, readHashParam, type DeltaInfo } from './delta-injection';

type CardUpdate = {
  /** Headline number rendered inside the chip. */
  headline: { value: number; direction: 'up' | 'down' };
  /** Full breakdown rendered into the hover tooltip. */
  breakdown: Array<{ label: string; value: number }>;
};

type Scenario = {
  relativeTime: string;
  heroDeltas: Record<'star' | 'download' | 'users' | 'projects', DeltaInfo & { direction: 'up' | 'down' | 'none' }>;
  profileDeltas: Record<string, Record<string, DeltaInfo & { direction: 'up' | 'down' | 'none' }>>;
  newProjectCount: number;
  removedProjectCount: number;
  /** Names rendered into the visit-summary hover tooltip. Demo fakes a
   *  representative list — production data flows through diff-stats. */
  newProjectNames: string[];
  removedProjectNames: string[];
  /** Sample per-card updated chips — applied to the first N visible
   *  cards (skipping any that already show the NEW ribbon). */
  cardUpdates: CardUpdate[];
};

const SCENARIOS: Record<string, Scenario> = {
  growth: {
    relativeTime: 'since 5 days ago',
    heroDeltas: {
      star:     { value: 12,   direction: 'up', label: 'stars & likes' },
      download: { value: 1240, direction: 'up', label: 'downloads' },
      users:    { value: 8,    direction: 'up', label: 'active users' },
      projects: { value: 2,    direction: 'up', label: 'projects' },
    },
    profileDeltas: {
      github: {
        'public repos': { value: 4, direction: 'up', label: 'public repos' },
        'followers':    { value: 2, direction: 'up', label: 'followers' },
      },
      stackoverflow: {
        'reputation': { value: 320, direction: 'up', label: 'reputation' },
        '🥇':          { value: 1,   direction: 'up', label: 'gold badges' },
        '🥉':          { value: 3,   direction: 'up', label: 'bronze badges' },
      },
    },
    newProjectCount: 2,
    removedProjectCount: 0,
    newProjectNames: ['Sketch2Go', 'Fit2Go'],
    removedProjectNames: [],
    cardUpdates: [
      {
        headline: { value: 1240, direction: 'up' },
        breakdown: [{ label: 'Downloads', value: 1240 }, { label: 'Stars', value: 4 }],
      },
      {
        headline: { value: 8, direction: 'up' },
        breakdown: [{ label: 'Users', value: 8 }, { label: 'Stars', value: 2 }],
      },
      {
        headline: { value: 2, direction: 'up' },
        breakdown: [{ label: 'Stars', value: 2 }],
      },
    ],
  },
  mixed: {
    relativeTime: 'since 12 days ago',
    heroDeltas: {
      star:     { value: 7,   direction: 'up',   label: 'stars & likes' },
      download: { value: 230, direction: 'up',   label: 'downloads' },
      users:    { value: 0,   direction: 'none', label: 'active users' },
      projects: { value: 2,   direction: 'down', label: 'projects' },
    },
    profileDeltas: {
      github: {
        'public repos': { value: 1, direction: 'up',   label: 'public repos' },
        'followers':    { value: 1, direction: 'down', label: 'followers' },
      },
      stackoverflow: {
        'reputation': { value: 50, direction: 'down', label: 'reputation' },
        '🥈':          { value: 2,  direction: 'up',   label: 'silver badges' },
      },
    },
    newProjectCount: 1,
    removedProjectCount: 3,
    newProjectNames: ['Graph2Go'],
    removedProjectNames: ['Old CLI', 'Throwaway Test', 'Legacy Bot'],
    cardUpdates: [
      {
        headline: { value: 230, direction: 'up' },
        breakdown: [{ label: 'Downloads', value: 230 }],
      },
      {
        headline: { value: 12, direction: 'down' },
        breakdown: [{ label: 'Users', value: -12 }, { label: 'Stars', value: 1 }],
      },
    ],
  },
  quiet: {
    relativeTime: '',
    heroDeltas: {
      star:     { value: 0, direction: 'none', label: 'stars & likes' },
      download: { value: 0, direction: 'none', label: 'downloads' },
      users:    { value: 0, direction: 'none', label: 'active users' },
      projects: { value: 0, direction: 'none', label: 'projects' },
    },
    profileDeltas: {},
    newProjectCount: 0,
    removedProjectCount: 0,
    newProjectNames: [],
    removedProjectNames: [],
    cardUpdates: [],
  },
};

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1000) {
    const k = n / 1000;
    return `${k.toFixed(Math.abs(k) < 10 ? 1 : 0).replace(/\.0$/, '')}k`;
  }
  return String(n);
}

function injectCardUpdateDemo(card: HTMLElement, update: CardUpdate): void {
  const slot = card.querySelector<HTMLElement>('.card-updated-chip');
  if (!slot) return;
  const { direction, value } = update.headline;
  const arrow = direction === 'up' ? '▲' : '▼';
  const sign = direction === 'up' ? '+' : '−';
  slot.classList.toggle('is-negative', direction === 'down');
  slot.innerHTML = `<span class="stat-delta-arrow" aria-hidden="true">${arrow}</span>${sign}${formatCompact(value)}`;
  const tooltip = update.breakdown
    .map((d) => `${d.label} ${d.value >= 0 ? '+' : '−'}${formatCompact(Math.abs(d.value))}`)
    .join(' · ');
  slot.dataset.tooltip = tooltip;
  slot.removeAttribute('hidden');
  card.dataset.updated = '1';
}

function activate(): void {
  const name = readHashParam('stats-demo');
  if (!name) return;
  const scenario = SCENARIOS[name];
  if (!scenario) return;

  for (const [key, delta] of Object.entries(scenario.heroDeltas)) {
    if (delta.direction === 'none') continue;
    const tile = document.querySelector(`.stat[data-stat-key="${key}"]`);
    const slot = tile?.querySelector<HTMLElement>('.stat-delta');
    if (slot) injectDelta(slot, delta as DeltaInfo, scenario.relativeTime);
  }

  for (const [source, deltas] of Object.entries(scenario.profileDeltas)) {
    const chip = document.querySelector(`.profile-chip[data-profile-source="${source}"]`);
    if (!chip) continue;
    for (const [factLabel, delta] of Object.entries(deltas)) {
      if (delta.direction === 'none') continue;
      const slot = chip.querySelector<HTMLElement>(`.stat-delta[data-fact-label="${CSS.escape(factLabel)}"]`);
      if (slot) injectDelta(slot, delta as DeltaInfo, scenario.relativeTime);
    }
  }

  const cards = Array.from(document.querySelectorAll<HTMLElement>('.card'));
  // Step 1 — mark the first N cards as "NEW" so they look like newly
  // added projects in the demo.
  for (let i = 0; i < Math.min(scenario.newProjectCount, cards.length); i++) {
    const ribbon = cards[i].querySelector<HTMLElement>('.card-new-ribbon');
    if (ribbon) ribbon.removeAttribute('hidden');
  }
  // Step 2 — apply per-card update chips to the NEXT cards, skipping
  // any that already display the NEW ribbon (the two are mutually
  // exclusive: a NEW card doesn't also need an "updated" chip).
  let updateIdx = 0;
  for (let i = scenario.newProjectCount; i < cards.length && updateIdx < scenario.cardUpdates.length; i++) {
    injectCardUpdateDemo(cards[i], scenario.cardUpdates[updateIdx]);
    updateIdx++;
  }

  populateVisitSummary({
    newProjectCount: scenario.newProjectCount,
    removedProjectCount: scenario.removedProjectCount,
    relativeTime: scenario.relativeTime,
    newProjectNames: scenario.newProjectNames,
    removedProjectNames: scenario.removedProjectNames,
  });

  document.dispatchEvent(new CustomEvent('dashboard:updates-applied'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', activate);
} else {
  activate();
}
