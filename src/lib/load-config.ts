import baseConfig from '../../projects.config';
import type { ProjectsConfig } from '../types/config';
import { getDefaultSourcesConfig } from '../connectors/_registry';

// Vite glob picks up projects.config.local.ts if it exists (gitignored).
// When absent, the glob returns {} and we use the base config as-is.
const localModules = import.meta.glob<{ default: ProjectsConfig }>(
  '../../projects.config.local.*',
  { eager: true }
);
const localConfig: ProjectsConfig | undefined = Object.values(localModules)[0]?.default;

function mergeSources(
  base: ProjectsConfig['sources'],
  override?: ProjectsConfig['sources'],
): ProjectsConfig['sources'] {
  // Start from the registry's manifest defaults so a newly added connector
  // shows up automatically without anyone having to edit this file.
  const out: Record<string, unknown> = { ...getDefaultSourcesConfig() };
  const b = base as unknown as Record<string, unknown>;
  const o = (override ?? {}) as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(out), ...Object.keys(b), ...Object.keys(o)])) {
    out[key] = {
      ...(out[key] as object | undefined),
      ...(b[key] as object | undefined),
      ...(o[key] as object | undefined),
    };
  }
  return out as ProjectsConfig['sources'];
}

function mergeConfig(base: ProjectsConfig, override?: ProjectsConfig): ProjectsConfig {
  if (!override) {
    return { ...base, sources: mergeSources(base.sources) };
  }
  return {
    ...base,
    ...override,
    deployment: { ...base.deployment, ...override.deployment },
    user: { ...base.user, ...override.user },
    sources: mergeSources(base.sources, override.sources),
    ui: {
      ...base.ui,
      ...override.ui,
      hero: { ...base.ui.hero, ...override.ui?.hero },
    },
    origins: { ...base.origins, ...override.origins },
  };
}

const merged = mergeConfig(baseConfig, localConfig);

// Default empty npm/docker handles to the github handle.
if (!merged.user.npm) merged.user.npm = merged.user.github;
if (!merged.user.docker) merged.user.docker = merged.user.github;

export default merged;
