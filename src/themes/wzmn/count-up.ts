// The headline numbers (.stat-value: "11.2K+", "1.2M+", "52") count up from
// zero to their value as the page opens, like a counter on an old screen.
// Each ends on exactly its original text. Skipped under reduced motion.

const DURATION = 1400;
// Starts with the page's rise (theme.css: 0.1s, or 0.25s from the computer).
const DELAY = 150;
const DELAY_FROM_CRT = 350;

interface Counter {
  el: HTMLElement;
  final: string;
  render: (t: number) => string;
}

function parse(el: HTMLElement): Counter | null {
  const final = el.textContent?.trim() ?? '';
  // prefix, number (with optional decimals and thousands commas), the rest ("K+").
  const m = final.match(/^(\D*?)(\d[\d,]*)(?:\.(\d+))?(.*)$/);
  if (!m) return null;
  const [, prefix, whole, frac = '', suffix] = m;
  const target = Number(whole.replace(/,/g, '') + (frac ? `.${frac}` : ''));
  const commas = whole.includes(',');
  const render = (t: number) => {
    let n = (target * t).toFixed(frac.length);
    if (commas) n = Number(n).toLocaleString('en-US', { minimumFractionDigits: frac.length, maximumFractionDigits: frac.length });
    return prefix + n + suffix;
  };
  return { el, final, render };
}

function run(fromCrt: boolean) {
  const counters = [...document.querySelectorAll<HTMLElement>('.stat-value')]
    .map(parse)
    .filter((c): c is Counter => c !== null);
  if (!counters.length) return;
  for (const c of counters) {
    c.el.setAttribute('aria-label', c.final);
    c.el.textContent = c.render(0);
  }
  const start = performance.now() + (fromCrt ? DELAY_FROM_CRT : DELAY);
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  function frame(now: number) {
    const t = Math.min(1, Math.max(0, (now - start) / DURATION));
    for (const c of counters) c.el.textContent = t < 1 ? c.render(ease(t)) : c.final;
    if (t < 1) requestAnimationFrame(frame);
    else for (const c of counters) c.el.removeAttribute('aria-label');
  }
  requestAnimationFrame(frame);
}

export function countUpOnArrive() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  // Header.astro adds .wz-arrive when the page is actually shown (later, for
  // a page built ahead in the background).
  const go = () => run(root.classList.contains('from-crt'));
  if (root.classList.contains('wz-arrive')) return go();
  const mo = new MutationObserver(() => {
    if (!root.classList.contains('wz-arrive')) return;
    mo.disconnect();
    go();
  });
  mo.observe(root, { attributes: true, attributeFilter: ['class'] });
}
