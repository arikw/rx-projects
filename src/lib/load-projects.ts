import { getCollection } from 'astro:content';
import config from './load-config';
import type { Project } from '../types/project';
import { fetchGithubProjects } from '../connectors/github';
import { fetchNpmProjects } from '../connectors/npm';
import { fetchDockerProjects } from '../connectors/docker';
import { fetchChromeProjects } from '../connectors/chrome';
import { manualToProjects } from '../connectors/manual';

const FIXTURE_MODE = process.env.CONNECTORS_FIXTURE === '1';

async function safeRun(name: string, fn: () => Promise<Project[]>): Promise<Project[]> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[loader] connector "${name}" failed:`, err);
    return [];
  }
}

export async function loadProjects(): Promise<Project[]> {
  // Which slugs have a matching MDX detail page?
  const detailEntries = await getCollection('projects').catch(() => []);
  const detailSlugs = new Set(detailEntries.map((e) => e.id.replace(/\.mdx?$/, '')));

  const opts = { fixtureMode: FIXTURE_MODE };

  const [github, npm, docker, chrome] = await Promise.all([
    config.sources.github.enabled
      ? safeRun('github', () => fetchGithubProjects(config, opts))
      : Promise.resolve([] as Project[]),
    config.sources.npm.enabled
      ? safeRun('npm', () => fetchNpmProjects(config, opts))
      : Promise.resolve([] as Project[]),
    config.sources.docker.enabled
      ? safeRun('docker', () => fetchDockerProjects(config, opts))
      : Promise.resolve([] as Project[]),
    config.sources.chrome.enabled
      ? safeRun('chrome', () => fetchChromeProjects(config, opts))
      : Promise.resolve([] as Project[]),
  ]);

  const manual = manualToProjects(config);

  // Merge — dedupe by id. Priority when a slug appears in multiple sources:
  // manual > github > npm > docker > chrome (last write wins; iterate in
  // reverse priority so manual overwrites others).
  const byId = new Map<string, Project>();
  for (const project of [...chrome, ...docker, ...npm, ...github, ...manual]) {
    byId.set(project.id, project);
  }

  const featuredSlugs = new Set(config.featured);

  const projects = Array.from(byId.values()).map((p) => ({
    ...p,
    featured: p.featured || featuredSlugs.has(p.id),
    hasDetail: detailSlugs.has(p.id),
  }));

  return projects;
}
