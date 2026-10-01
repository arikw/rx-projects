// `theme:<file>` imports are resolved by the theme resolver in astro.config.mjs.
declare module 'theme:*.astro' {
  const Component: (props: Record<string, unknown>) => unknown;
  export default Component;
}
declare module 'theme:*.css';
