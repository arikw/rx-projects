// The Share button. The template's (in its header) isn't used by this
// theme, so this one is added to the page when it opens:
//  - wider than a phone: on the line above the heading, at its right
//    (the main page's eyebrow line, a project page's "Back to projects");
//  - phones: full width, near the end of the main page (before "About the
//    author", so it doesn't read as sharing the statistics), or under a
//    project page's top section.
// It moves when the window crosses the phone width. On click: the system
// share sheet where there is one (phones), otherwise the link is copied
// and the button says "Copied" for a moment.

const PHONE = '(max-width: 620px)';
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16.1c-.8 0-1.5.3-2 .8l-7.1-4.2c.1-.2.1-.5.1-.7s0-.5-.1-.7L16 7.2c.5.5 1.2.8 2 .8 1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3c0 .2 0 .5.1.7L8 9.8C7.5 9.3 6.8 9 6 9c-1.7 0-3 1.3-3 3s1.3 3 3 3c.8 0 1.5-.3 2-.8l7.1 4.2c-.1.2-.1.4-.1.6 0 1.6 1.3 2.9 2.9 2.9s2.9-1.3 2.9-2.9-1.2-2.9-2.8-2.9z"/></svg>';

function copy(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  // Plain http (a LAN dev server): the old way.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } finally { ta.remove(); }
  return Promise.resolve();
}

export function addShareButton() {
  const main = document.querySelector<HTMLElement>('.hero .eyebrow');
  const back = document.querySelector<HTMLElement>('.detail .back');
  const top = main ?? back;
  if (!top) return;

  // The line above the heading becomes a row: what was there, and Share.
  const row = document.createElement('div');
  row.className = 'wz-top-row';
  top.parentNode!.insertBefore(row, top);
  row.appendChild(top);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'wz-share';
  btn.innerHTML = ICON + '<span>Share</span>';
  const label = btn.querySelector('span')!;
  btn.addEventListener('click', async () => {
    const url = (document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href) || location.href;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share && window.matchMedia('(pointer: coarse)').matches) {
      try { await nav.share({ title: document.title, url }); } catch { /* dismissed */ }
      return;
    }
    try {
      await copy(url);
      label.textContent = 'Copied';
      btn.classList.add('is-done');
      setTimeout(() => { label.textContent = 'Share'; btn.classList.remove('is-done'); }, 1600);
    } catch { /* nothing to do */ }
  });

  // The change indicators' toggle (Header.astro), on the same line, before
  // Share, and on phones still there (near the markers it hides) when Share
  // moves to the end. The count comes from the template's tooltip text
  // ("3 changes since last visit"); "change" for one.
  const actions = document.createElement('div');
  actions.className = 'wz-actions';
  row.appendChild(actions);
  const eye = document.querySelector<HTMLButtonElement>('.wz-eye[data-delta-toggle]');
  if (eye && main) {
    actions.appendChild(eye);
    const n = eye.querySelector('.n')!, word = n.nextElementSibling!;
    const sync = () => {
      const count = parseInt(eye.dataset.tooltip || '', 10);
      n.textContent = isNaN(count) ? '' : String(count);
      word.textContent = count === 1 ? 'change' : 'changes';
    };
    new MutationObserver(sync).observe(eye, { attributes: true, attributeFilter: ['data-tooltip'] });
    sync();
  }

  // Where it goes on a phone.
  const phoneSpot = main ? document.querySelector('.author-bio') : document.querySelector('.detail .hero');
  const mq = window.matchMedia(PHONE);
  const place = () => {
    if (mq.matches && phoneSpot) {
      btn.classList.add('wz-share--wide');
      if (main) phoneSpot.before(btn); else phoneSpot.after(btn);
    } else {
      btn.classList.remove('wz-share--wide');
      actions.appendChild(btn);
    }
  };
  place();
  mq.addEventListener('change', place);
}
