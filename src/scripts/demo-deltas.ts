type Direction = 'up' | 'down' | 'none';
type StatKey = 'star' | 'download' | 'users' | 'projects';
type Scenario = {
  relativeTime: string;
  heroDeltas: Record<StatKey, { value: number; direction: Direction }>;
  newProjectCount: number;
};

const SCENARIOS: Record<string, Scenario> = {
  growth: {
    relativeTime: 'since 5 days ago',
    heroDeltas: {
      star:     { value: 12,   direction: 'up' },
      download: { value: 1240, direction: 'up' },
      users:    { value: 8,    direction: 'up' },
      projects: { value: 2,    direction: 'up' },
    },
    newProjectCount: 2,
  },
  mixed: {
    relativeTime: 'since 12 days ago',
    heroDeltas: {
      star:     { value: 7,   direction: 'up' },
      download: { value: 230, direction: 'up' },
      users:    { value: 0,   direction: 'none' },
      projects: { value: 2,   direction: 'down' },
    },
    newProjectCount: 1,
  },
  quiet: {
    relativeTime: '',
    heroDeltas: {
      star:     { value: 0, direction: 'none' },
      download: { value: 0, direction: 'none' },
      users:    { value: 0, direction: 'none' },
      projects: { value: 0, direction: 'none' },
    },
    newProjectCount: 0,
  },
};

function formatNumber(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k.toFixed(k < 10 ? 1 : 0).replace(/\.0$/, '')}k`;
  }
  return String(n);
}

function injectHeroDelta(
  tile: Element,
  delta: { value: number; direction: Direction },
  relativeTime: string,
): void {
  if (delta.direction === 'none' || delta.value === 0) return;
  const slot = tile.querySelector<HTMLElement>('.stat-delta');
  if (!slot) return;
  const arrow = delta.direction === 'up' ? '▲' : '▼';
  const sign = delta.direction === 'up' ? '+' : '−';
  slot.classList.toggle('is-negative', delta.direction === 'down');
  slot.innerHTML = `<span class="stat-delta-arrow" aria-hidden="true">${arrow}</span>${sign}${formatNumber(delta.value)}`;
  if (relativeTime) slot.title = relativeTime;
  slot.removeAttribute('hidden');
}

function activate(): void {
  const params = new URLSearchParams(location.search);
  const name = params.get('demo');
  if (!name) return;
  const scenario = SCENARIOS[name];
  if (!scenario) return;

  for (const [key, delta] of Object.entries(scenario.heroDeltas)) {
    const tile = document.querySelector(`.stat[data-stat-key="${key}"]`);
    if (tile) injectHeroDelta(tile, delta, scenario.relativeTime);
  }

  if (scenario.newProjectCount > 0) {
    const cards = document.querySelectorAll<HTMLElement>('.card');
    for (let i = 0; i < Math.min(scenario.newProjectCount, cards.length); i++) {
      const ribbon = cards[i].querySelector<HTMLElement>('.card-new-ribbon');
      if (ribbon) ribbon.removeAttribute('hidden');
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', activate);
} else {
  activate();
}
