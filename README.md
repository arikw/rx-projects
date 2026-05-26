# rx-dev-dashboard

Config-driven dev dashboard and project showcase. Built with [Astro](https://astro.build/), publishable to GitHub Pages or any other static host.

Pulls public signals from **GitHub**, **npm**, **Docker Hub**, and **Chrome Web Store** at build time, merges them with manual entries you control, and renders an "impact dashboard" plus a project grid with tag filtering.

Designed to be cloned — edit one config file, set one repo secret, push, and you have your own.

## Quick start

```bash
git clone https://github.com/<your-user>/rx-dev-dashboard.git
cd rx-dev-dashboard
npm install
npm run dev
```

Edit `projects.config.ts` to point at your own handles, then refresh.

## Set up your own dashboard

The fastest path to a working dashboard on your domain:

### 1. Create your copy

Click **Use this template → Create a new repository** on this repo's GitHub page. This gives you a clean, independent repo with the workflow files included and Actions enabled by default.

(If you used **Fork** instead, see [Enabling Actions on a fork](#enabling-actions-on-a-fork) further down — forks ship with Actions disabled.)

### 2. Edit `projects.config.ts`

The whole dashboard is driven from this one file:

- `deployment.site` — the public origin where your site lives (e.g. `https://yourname.dev`)
- `deployment.base` — the path prefix (`'/'` for root deployments, `'/projects'` for sub-path)
- `user.github`, `user.npm`, `user.docker` — your handles for each source (`npm` and `docker` default to `github` when left empty)
- `sources.chrome.extensionIds` — 32-char IDs from your Chrome Web Store listing URLs
- `featured` — slugs to pin at the top of the page
- `manual` — projects without an online source (closed-source, retired, etc.)

Any source you leave empty or disable just contributes nothing — connectors degrade gracefully.

### 3. Add a `GH_API_TOKEN` repo secret

Settings → Secrets and variables → Actions → New repository secret. Create one named **`GH_API_TOKEN`** containing a [personal access token](https://github.com/settings/tokens) with `public_repo` read access.

This bumps the GitHub connector from 60 to 5000 requests/hour. Builds still work without it but may rate-limit on larger accounts.

### 4. Enable GitHub Pages

Settings → Pages → Source: **GitHub Actions**.

### 5. Push (or trigger manually)

Push to your default branch — the workflow builds and deploys. A daily cron at 08:00 UTC also rebuilds so source-fetched stats stay fresh without manual pushes.

To trigger a one-off build without pushing: Actions tab → **Deploy** → **Run workflow**.

The workflow listens on both `master` and `main`, so it'll fire whichever default branch your new repo ended up with.

## Enabling Actions on a fork

If you used **Fork** instead of **Use this template**, GitHub disables Actions on forks by default. Two ways to turn them back on:

- **Web UI:** go to the **Actions** tab of your fork → click **I understand my workflows, go ahead and enable them**.
- **CLI:** `gh api -X PUT repos/<your-user>/<your-fork>/actions/permissions -F enabled=true`

After that, either push something or use the **Run workflow** button on the Deploy workflow to kick off the first build.

## Local development with real handles

If you want to dev locally with real values you don't want to commit, create `projects.config.local.ts`:

```ts
import baseConfig from './projects.config';

export default {
  ...baseConfig,
  deployment: {
    ...baseConfig.deployment,
    site: 'https://your-host.example',
    base: '/projects',
  },
  user: {
    ...baseConfig.user,
    github: 'your-handle',
  },
};
```

The file is `.gitignored` — the loader shallow-merges it over `projects.config.ts` at build time when present.

## Commands

```bash
npm run dev               # local dev server
npm run build             # → dist/
npm run preview           # serve dist/ locally
```

## Layout

```
.
├── astro.config.mjs                reads site/base from projects.config.ts
├── projects.config.ts              single source of truth (config-driven)
├── src/
│   ├── content.config.ts           Zod schema for optional detail pages
│   ├── content/projects/           optional detail .mdx files (one per project slug)
│   ├── connectors/                 github, npm, docker, chrome
│   ├── lib/                        load-config, load-projects, aggregate-stats
│   ├── components/                 Hero, Stat, ProjectCard, FeaturedRow, TagFilter, BaseHead
│   ├── layouts/                    BaseLayout
│   └── pages/
│       ├── index.astro             the showcase
│       └── projects/[...slug].astro detail routes
├── tests/fixtures/                 connector fixtures for offline builds
└── .github/workflows/deploy.yml    build + Pages deploy
```
