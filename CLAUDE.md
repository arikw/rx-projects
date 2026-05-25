# CLAUDE.md

Project context for Claude Code working in this repo.

## What this is

Personal dev dashboard + clonable starter, published at `https://wzmn.net/projects/`. Aggregates public signals from **GitHub**, **npm**, **Docker Hub**, and **Chrome Web Store** at build time, merges them with manual entries you control, and renders an "impact dashboard" + project grid with tag filtering.

Built with **Astro 6**, deployed to **GitHub Pages**. The reverse-proxy topology that makes the public URL serve from GitHub Pages is private (see `CLAUDE.local.md`).

The project is designed to double as a starter: a cloner edits a single `projects.config.ts` and gets a working dashboard pointing at their own handles.

## Stack & layout

- Astro 6 with `@astrojs/mdx`, `@astrojs/sitemap`. Node ≥ 22.
- Single source of truth: **`projects.config.ts`** at the repo root. All user-tunable knobs live here.
- Local override pattern: `projects.config.local.ts` (gitignored) shallow-merges over the base config so real handles can be tested locally without committing them.
- Connectors: `src/connectors/{github,npm,docker,chrome}.ts` — each fetches at build time and returns a normalized `Project[]`. Failures are non-fatal; an unavailable source just contributes nothing.
- Loader: `src/lib/load-projects.ts` runs enabled connectors in parallel, merges with `config.manual[]`, dedupes by slug, applies the `featured` pin list.
- Optional detail pages: `src/content/projects/<slug>.mdx` auto-generates `/projects/<slug>/` when the slug matches a project's id (GitHub repo name, npm name, docker image, chrome slug, or manual slug).
- URL strategy: `astro.config.mjs` sets `site: 'https://wzmn.net'` + `base: '/projects'`. The `/projects/` prefix carries through every internal href and canonical tag — **never hardcode `github.io` or strip the base**.

## Commands

```bash
npm run dev               # localhost:4321/projects/
npm run build             # → dist/
npm run preview           # serve dist/ locally
```

## Conventions

- Don't put project images in `public/`. Use `src/content/projects/<slug>/` for colocated detail-page media so `astro:assets` can optimize.
- The author for the site is `Arik W.`. Set as the `<meta name="author">` default in `BaseHead.astro`. Override per detail page via MDX frontmatter.
- Connectors must degrade gracefully — an empty handle returns `[]`, an API failure logs and returns `[]`. A broken source never breaks the build.
- Don't speculatively add features that haven't been asked for (no admin UI, no search, no comments). Public docs (`README.md`, `CLAUDE.md`, GitHub About panel) only describe what's actually shipped.

## Deployment

- `.github/workflows/deploy.yml` builds on push to `main` plus a daily cron and deploys `dist/` to GitHub Pages.
- The `wzmn.net/projects/` routing topology lives in `docs/private/` (gitignored) — see `CLAUDE.local.md` for details.

## Where things live that aren't in this file

- `CLAUDE.local.md` (gitignored) — deployment specifics, personal/sensitive context, working preferences.
- `docs/private/` (gitignored) — proxy snippet with real values.
- `projects.config.local.ts` (gitignored) — local override of `projects.config.ts` with real handles.
- `README.md` — public-facing project intro and cloner onboarding.
