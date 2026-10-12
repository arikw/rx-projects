const STORAGE_KEY = 'delta-visibility';

/** Projects that are new or whose numbers moved — the same set the
 *  gallery's "Updated" filter shows, so the two counts always agree. */
function countProjects(): number {
  const cards = new Set<Element>();
  document
    .querySelectorAll('.card-new-ribbon:not([hidden]), .card-updated-chip:not([hidden])')
    .forEach((el) => {
      const card = el.closest('.card');
      if (card) cards.add(card);
    });
  return cards.size;
}

/** Moves in the headline tiles and the profile cards (not projects). */
function countOther(): number {
  return document.querySelectorAll('.stat-delta:not([hidden])').length;
}

function countChanges(): number {
  return countProjects() + countOther();
}

function shouldShowToggle(): boolean {
  if (countChanges() > 0) return true;
  const summary = document.querySelector<HTMLElement>('.visit-summary');
  return !!(summary && !summary.hidden);
}

function applyVisibilityState(hidden: boolean): void {
  document.body.classList.toggle('changes-hidden', hidden);
}

function readStoredHidden(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'hidden';
  } catch {
    return false;
  }
}

function storeHidden(hidden: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, hidden ? 'hidden' : 'visible');
  } catch {
    /* private mode / storage disabled — state still applies for this session */
  }
}

function init(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-delta-toggle]');
  if (!btn) return;

  queueMicrotask(() => {
    if (!shouldShowToggle()) return;
    const projects = countProjects();
    const other = countOther();

    const hidden = readStoredHidden();
    applyVisibilityState(hidden);

    // Leads with the project count: themes read the first number as the
    // button's badge (e.g. the wzmn header's "N changes").
    btn.dataset.tooltip =
      `${projects} project${projects === 1 ? '' : 's'} changed since last visit` +
      (other ? ` · plus ${other} headline number${other === 1 ? '' : 's'}` : '');
    btn.hidden = false;

    btn.addEventListener('click', () => {
      const next = !document.body.classList.contains('changes-hidden');
      applyVisibilityState(next);
      storeHidden(next);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
