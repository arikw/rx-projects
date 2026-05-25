# rx-dev-dashboard

Config-driven dev dashboard and project showcase. Built with [Astro](https://astro.build/), deployed via GitHub Pages.

Pulls public signals from **GitHub**, **npm**, **Docker Hub**, and **Chrome Web Store** at build time, merges them with manual entries you control, and renders an "impact dashboard" plus a project grid with tag filtering.

Designed to be cloned — edit one config file, set one repo secret, push, and you have your own.

## Quick start

```bash
git clone https://github.com/<your-user>/rx-dev-dashboard.git
cd rx-dev-dashboard
npm install
npm run dev      # http://localhost:4321/projects/
```

Edit `projects.config.ts` to point at your own handles.

## Cloner setup

1. Use this repo as a template (the **Use this template** button on GitHub).
2. In your new repo, edit `projects.config.ts`:
   - `user.github`, `user.npm`, `user.docker` — your handles
   - `sources.chrome.extensionIds` — your Chrome Web Store extension IDs
   - `featured` — slugs to pin at the top
   - `manual` — projects without an online source
3. Add a `GITHUB_TOKEN` repo secret (a PAT with `public_repo` read access) so the GitHub connector can use the 5000 req/hr authenticated rate limit instead of 60 req/hr unauthenticated.
4. Settings → Pages → Source: **GitHub Actions**.
5. Push to `main`. The Actions workflow builds + deploys on every push and once daily so source-fetched stats stay fresh.

## Local development with real handles

If you want to dev locally with real values that you don't want to commit, create `projects.config.local.ts`:

```ts
import baseConfig from './projects.config';

export default {
  ...baseConfig,
  user: {
    ...baseConfig.user,
    github: 'your-handle',
  },
};
```

That file is `.gitignored` — the loader shallow-merges it over `projects.config.ts` at build time when present.

## Commands

```bash
npm run dev               # localhost:4321/projects/
npm run build             # → dist/
npm run preview           # serve dist/ locally
```

## Layout

```
.
├── astro.config.mjs                site, base: '/projects'
├── projects.config.ts              single source of truth (config-driven)
├── src/
│   ├── content.config.ts           Zod schema for optional detail pages
│   ├── content/projects/           optional detail .mdx files (one per project slug)
│   ├── connectors/                 github, npm, docker, chrome
│   ├── lib/                        load-projects, aggregate-stats
│   ├── components/                 Hero, Stat, ProjectCard, FeaturedRow, TagFilter, BaseHead
│   ├── layouts/                    BaseLayout
│   └── pages/
│       ├── index.astro             the showcase
│       └── projects/[...slug].astro detail routes
├── tests/fixtures/                 connector fixtures for offline builds
└── .github/workflows/deploy.yml    build + GH Pages deploy
```
