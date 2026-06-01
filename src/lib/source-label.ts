// Human-friendly labels for source chips / thumbnails, keyed by platform id.
// Derived from connector manifests in src/connectors/_registry.ts — each
// manifest contributes its key→label, and aliases (e.g. playstore's
// 'google-play') inherit the manifest's label.
import { getAll, getLabel } from '../connectors/_registry';

const built: Record<string, string> = { manual: 'Portfolio' };
for (const m of getAll()) {
  const label = getLabel(m.key);
  built[m.key] = label;
  for (const alias of m.platformAliases ?? []) {
    built[alias] = label;
  }
}

export const SOURCE_LABEL: Record<string, string> = built;

/** Convert a one-off source key to a presentable chip label. Connector
 *  keys are looked up in the registry-derived map; anything else (e.g.
 *  `'firefox'` set by a manual entry's `source` field) gets its first
 *  letter uppercased so it reads as a proper name instead of all-lower. */
export function sourceLabel(s: string): string {
  const known = SOURCE_LABEL[s];
  if (known) return known;
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
