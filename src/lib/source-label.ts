import type { ProjectSource } from '../types/project';

// Human-friendly labels for source chips / thumbnails. The internal source key
// (e.g. 'appbrain') stays raw in data + snapshot; this is display-only. Both
// Android catalogs render as "Android app" so a merged card shows it once.
export const SOURCE_LABEL: Record<ProjectSource, string> = {
  github: 'GitHub',
  npm: 'npm',
  docker: 'Docker',
  chrome: 'Chrome',
  gnome: 'GNOME',
  appbrain: 'Android app',
  apkpure: 'Android app',
  manual: 'Portfolio',
};

export function sourceLabel(s: ProjectSource): string {
  return SOURCE_LABEL[s] ?? s;
}
