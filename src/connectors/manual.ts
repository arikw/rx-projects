import type { Project } from '../types/project';
import type { ProjectsConfig } from '../types/config';

export function manualToProjects(config: ProjectsConfig): Project[] {
  return config.manual.map((m) => ({
    id: m.slug,
    source: 'manual' as const,
    title: m.title,
    description: m.description,
    url: m.url ?? '',
    tags: m.tags ?? [],
    stats: {},
    language: m.language,
    year: m.year,
    featured: m.featured ?? false,
    hasDetail: false, // set by loader after content collection lookup
  }));
}
