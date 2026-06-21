// Shared email-scrubbing helper. Used by every connector that pulls
// long-form body text from a third-party source (AppBrain, APKPure,
// future Play / AMO scrapers). The behaviour is config-driven:
//
//   `meta.scrubEmails: false`  → emails pass through verbatim.
//   `meta.scrubEmails: true`   (default) → emails are replaced. When
//   `meta.contactReplacement` is set, every email is swapped for that
//   string; otherwise the email is simply deleted (and a downstream
//   pass like `dropEmptyContactLines` typically strips the orphan
//   "Please contact us at " prefix).
//
// The function runs at fetch-time inside each connector, so the cached
// connector data already has the substitution baked in. Re-fetch is
// required to pick up config changes — bump the relevant connector's
// cache version when toggling.

import config from './load-config';

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

/** Detect whether a contact-replacement value should be auto-wrapped
 *  in markdown link syntax. URLs with a recognised scheme (`http(s):`,
 *  `mailto:`) or root-relative paths get wrapped so they render as
 *  clickable links; plain text and bare emails get inserted verbatim.
 *  Config doesn't carry separate text + href fields — the value
 *  itself becomes both the href and the visible label (with one
 *  cosmetic exception for `mailto:`, see below). */
function formatReplacement(value: string): string {
  if (!value) return '';
  // mailto: → wrap as a link; the user almost never wants the literal
  // "mailto:foo@bar" string visible. Strip the scheme for the label.
  if (/^mailto:/i.test(value)) {
    const visible = value.slice(7);
    return `[${visible}](${value})`;
  }
  // http(s) and root-relative URLs — wrap as link with the URL as label.
  if (/^(https?:\/\/|\/)/.test(value)) return `[${value}](${value})`;
  // Bare email or plain text — verbatim. Bare emails fall here on
  // purpose: someone wanting a clickable address should write
  // `mailto:them@example.com`; writing a bare email matches the
  // original "this is the developer's contact info" shape that the
  // sentence already had.
  return value;
}

export function scrubEmails(s: string): string {
  if (config.meta.scrubEmails === false) return s;
  const repl = formatReplacement(config.meta.contactReplacement ?? '');
  return s.replace(EMAIL_RE, repl).trim();
}
