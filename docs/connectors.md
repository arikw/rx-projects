# Connector guide

This doc explains how the connector system works and how to add a new one. If
you only need to know "how do I show data from source X on the dashboard", the
short answer is: drop a folder under `src/connectors/`, follow the pattern of
an existing connector, and rebuild.

## What a connector is

A **connector** is a self-contained module that pulls data from one external
source (GitHub, npm, Chrome Web Store, Stack Overflow, …) and tells the
dashboard what to do with it. There are two kinds of output a connector can
return — a single connector can return either, or both:

- **`projects`** — a list of `ConnectorResult[]`. Each becomes a card on the
  grid. Origin sources (github, npm, docker, chrome, etc.) emit projects.
- **`profile`** — a single `ProfileFact`. Renders as a small chip in the
  ProfilePresence strip below the hero. Data-only sources (Stack Overflow,
  GitHub-as-a-person) emit profile facts.

A connector that lives at `src/connectors/<key>/index.ts` is **auto-discovered**
by `_registry.ts` — no edits to `load-projects.ts`, `build-projects.ts`,
`source-label.ts`, `ProjectGrid.astro`, `ProjectCard.astro`, or
`ProjectThumb.astro` are needed when adding a new connector.

## Folder layout

```
src/connectors/
├── _define.ts            ← manifest type + defineConnector() helper
├── _registry.ts          ← auto-discovery + derived helpers
│                           (getAll(), getBrandMarks(), getSourceLabels(), …)
│
├── <your-key>/
│   ├── index.ts          ← REQUIRED — exports default defineConnector(…)
│   ├── icon.svg          ← optional — the brand mark for image-less cards
│   ├── README.md         ← optional — connector-specific notes
│   └── (helpers)         ← optional — split scraping / cache / parsing logic
│
└── manual.ts             ← the manual (config-driven) data path (not a connector)
```

A connector with a single file is also fine — just put everything in
`<your-key>/index.ts`.

## The manifest

Every connector's `index.ts` does:

```ts
import { defineConnector } from '../_define';

export default defineConnector({
  key: '<your-key>',                        // matches the folder name
  label: 'Your Source',                     // friendly chip / hero label
  brandMark: {                              // optional — for image-less cards
    svg: yourIconSvgRaw,
    tint: '#0a0c12',                        // backplate background
    fg: '#ffffff',                          // SVG foreground colour
  },
  urlExtractors: [                          // optional — for cross-source merging
    {
      hostnames: ['yoursource.com'],
      extract: (url) => /* return { platform, id } or null */,
    },
  ],
  defaultConfig: {                          // merged with projects.config.ts
    enabled: true,
    /* connector-specific knobs */
  },
  fetch: async (config, opts) => {
    // config is the resolved ProjectsConfig (read config.sources[key] for
    // this connector's slice). opts.fixtureMode is true when running tests.
    const projects = await /* your fetch logic */;
    return { projects };                    // or { profile }, or both
  },
});
```

The `defineConnector` helper is just an identity function with the right
types — its only job is to make TypeScript infer the manifest shape.

## Brand marks

If your connector can leave the card with no image (which happens for github /
npm / docker — the bulk of the cards), you'd usually want a recognisable brand
mark on the card instead of the generic gradient placeholder. To add one:

1. Save the brand's SVG (just the symbol — no surrounding rectangle / tint)
   to `<your-key>/icon.svg`. Use `fill="currentColor"` on the root `<svg>` so
   the brand foreground colour flows through.
2. Import it raw and reference it in the manifest:
   ```ts
   import iconSvg from './icon.svg?raw';
   export default defineConnector({
     brandMark: { svg: iconSvg, tint: '#…', fg: '#…' },
     // …
   });
   ```

The `tint` is the card's backplate colour (the dark wash behind the icon).
The `fg` is the icon colour (typically the brand's primary hex). See
`src/connectors/github/icon.svg` for an example.

## URL extractors

If a project on **another** source links to **this** source (e.g. a GitHub
repo's `homepage` field points at a Chrome Web Store listing), the builder
needs to know how to recognise the URL and merge the two ConnectorResults
into one card. Each connector declares the hostnames it owns and a function
that extracts `{ platform, id }` from a URL on one of those hostnames:

```ts
urlExtractors: [
  {
    hostnames: ['chrome.google.com', 'chromewebstore.google.com'],
    extract: (url) => {
      const m = url.pathname.match(/\/detail\/(?:[^/]+\/)?([a-p]{32})/);
      return m ? { platform: 'chrome', id: m[1] } : null;
    },
  },
],
```

## Mirrors and `mirrorOf`

Some sources are "the same project, reported by someone else" — AppBrain and
APKPure mirror Google Play; chrome-stats mirrors the Chrome Web Store. The
manifest declares this relationship explicitly:

```ts
export default defineConnector({
  key: 'chromestats',
  mirrorOf: 'chrome',                       // the origin connector's key
  platformAliases: ['chrome-stats'],        // see below
  defaultConfig: { enabled: true },
  fetch: async (config, opts) => /* … */,
});
```

When `mirrorOf` is set:

- The chip label is inherited from the origin (`[CHROME]`, not
  `[CHROMESTATS]`).
- The chip URL falls back to this mirror when the origin has no URL (e.g. a
  removed Chrome Web Store listing whose mirror page on chrome-stats.com is
  still alive).
- The source-group is inherited from the origin (chip filtering puts this
  mirror under the origin's filter).
- The brand mark is inherited from the origin.

## `platformAliases`

Some connectors emit reps with a `platform:` string that's different from the
manifest's `key`. For example:

- The `playstore` connector uses `platform: 'google-play'` (the canonical Play
  resource identifier, also used in manual `origins` config).
- The `chromestats` mirror uses `platform: 'chrome-stats'` (legacy hyphenated
  form).

Declare these aliases so the registry's platform→source-group lookup still
resolves:

```ts
platformAliases: ['google-play'],
```

If your connector's `platform:` strings always match its `key`, omit this.

## `sourceGroup`

If your connector is the **origin** for a chip whose label is different from
the key (the `playstore` connector emits `[ANDROID APP]`, not
`[PLAYSTORE]`), set the group explicitly:

```ts
key: 'playstore',
label: 'Android app',
sourceGroup: 'android',
platformAliases: ['google-play'],
```

Other connectors that share this group (`appbrain`, `apkpure`) set
`mirrorOf: 'playstore'` and inherit the `android` group via the chain.

## Config

A connector's `defaultConfig` is the connector's own section of
`config.sources`. The loader merges:

```
manifest.defaultConfig  ←  projects.config.ts (committed)  ←  projects.config.local.ts (gitignored override)
```

Most connectors have at minimum `{ enabled: true }`. Add whatever knobs you
need — see `src/connectors/chrome/index.ts` (`extensionIds`),
`src/connectors/gnome/index.ts` (`extensionIds: number[]`), or
`src/connectors/stackoverflow/index.ts` (`userId`).

## What's still hand-maintained

After adding a connector, you may still need to edit:

- **`src/types/config.ts`** — only if you want TypeScript autocomplete on
  `config.sources.<your-key>`. The runtime works without this; it's purely an
  editor ergonomics thing. Add a type for your section and include it in
  `ProjectsConfig.sources`.
- **`projects.config.ts`** — only if the user needs to provide a value (like
  a handle or extension id) that has no sensible default. Otherwise the
  manifest's `defaultConfig` is enough.
- **`src/components/ProjectThumb.astro:BRAND_RANK`** — only if you want a
  specific ordering when multiple branded sources are present on a single
  card (currently npm > docker > github).

## See also

- `src/connectors/github/` — the most complex connector. Splits into
  `index.ts` (manifest), `projects.ts` (repo fetching), `pages.ts` (Pages
  favicon + `<title>` scraping), and `icon.svg`.
- `src/connectors/chromestats/` — mirror connector. Splits scraping logic
  into `scrape.ts`.
- `src/connectors/stackoverflow/` — data-only / project-emitting (currently
  emits both; the project-emission part will be retired once the
  ProfilePresence strip lands).
