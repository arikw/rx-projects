# rx-tech-blog

Static blog source. Built with [Astro](https://astro.build/), deployed via GitHub Pages, published at `https://wzmn.net/blog/`.

## Local development

```bash
npm install
npm run dev       # http://localhost:4321/blog/
npm run build     # outputs to ./dist/
npm run preview   # serve the built site locally
```

Posts live in `src/content/blog/` as Markdown or MDX. Frontmatter schema (validated at build time by Zod in `src/content.config.ts`):

```yaml
---
title: "Post title"
date: 2026-05-21
description: "One-line summary."
tags:
  - docker
  - devops
slug: my-post-slug      # routes to /blog/posts/my-post-slug/
draft: false            # optional; true hides from build
---
```

## Deployment

`.github/workflows/deploy.yml` builds on every push to `main` and deploys the contents of `dist/` to GitHub Pages. All internal hrefs and the canonical `<link>` carry the `/blog/` prefix because `astro.config.mjs` sets `site: 'https://wzmn.net'` and `base: '/blog'`.

## Layout

```
.
├── astro.config.mjs              site=wzmn.net, base=/blog
├── src/
│   ├── content.config.ts         Zod schema for the blog collection
│   ├── content/blog/             your posts
│   ├── components/BaseHead.astro canonical + OG + RSS link
│   ├── layouts/                  BaseLayout + PostLayout
│   ├── pages/
│   │   ├── index.astro           post list
│   │   ├── posts/[...slug].astro post page
│   │   ├── rss.xml.js            RSS feed
│   │   └── 404.astro
│   ├── consts.ts                 SITE_TITLE / SITE_DESCRIPTION
│   └── styles/global.css
├── public/                       .nojekyll, robots.txt, favicon
└── .github/workflows/deploy.yml  build + GH Pages deploy
```
