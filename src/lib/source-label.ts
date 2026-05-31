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

export function sourceLabel(s: string): string {
  return SOURCE_LABEL[s] ?? s;
}
