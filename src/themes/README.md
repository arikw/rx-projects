# Themes

A theme is a folder here. `ui.theme` in `projects.config.ts` (or your
`projects.config.local.ts`) picks one; without it, `default` is used.

```ts
ui: {
  theme: 'mysite',   // → src/themes/mysite/
}
```

A theme folder can contain any of these files. Whatever it leaves out is
taken from `default/`, so a theme only holds the parts it changes.

| File           | What it does                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `theme.css`    | Loaded after `default/theme.css` and `src/styles/global.css`, so it can override tokens and any rule.    |
| `Header.astro` | Replaces the site header on every page.                                                                  |
| `Head.astro`   | Extra tags at the end of `<head>`: font preloads, or an inline script that must run before first paint. |
| `Footer.astro` | Rendered after the page content on every page.                                                           |

## Tokens

`default/theme.css` defines the colours, fonts and shadows the rest of the
CSS uses, for light and dark. Overriding those is usually enough for a new
palette:

```css
:root {
  --bg: #f5f2eb;
  --accent: #1f2b45;
  --font-body: 'IBM Plex Sans', system-ui, sans-serif;
}
```

Remember the dark scheme: `default/theme.css` sets dark values under
`@media (prefers-color-scheme: dark)` and `:root[data-theme='dark']`.
Override both, or the dark values win when the visitor's system is dark.

## Animations and scripts

`Header.astro` and `Footer.astro` are ordinary Astro components, so a
`<script>` in them is bundled and runs on every page, and `theme.css` can
hold keyframes. Anything that has to decide the look before the first paint
(e.g. "start dark when arriving from another page") belongs in an
`<script is:inline>` in `Head.astro`.

## Personal themes in a clone

Keep your theme in its own folder (e.g. `src/themes/mysite/`). Upstream
never touches folders other than `default/`, so merging upstream updates
stays conflict-free.
