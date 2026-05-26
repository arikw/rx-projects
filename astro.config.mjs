import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Deployment settings live in projects.config.ts so cloners only edit one file.
// projects.config.local.ts (gitignored) shallow-overrides for local dev.
const here = dirname(fileURLToPath(import.meta.url));
const localPath = resolve(here, 'projects.config.local.ts');
const baseCfg = (await import('./projects.config.ts')).default;
const localCfg = existsSync(localPath)
  ? (await import('./projects.config.local.ts')).default
  : undefined;
const deployment = { ...baseCfg.deployment, ...localCfg?.deployment };

export default defineConfig({
  site: deployment.site,
  base: deployment.base,
  trailingSlash: deployment.trailingSlash ?? 'always',
  build: {
    format: deployment.format ?? 'directory',
  },
  integrations: [mdx(), sitemap()],
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark-dimmed',
      },
      wrap: false,
    },
  },
});
