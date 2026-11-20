// Only for `npm run check` (tsc): .astro imports. In a project, Astro provides these types itself.
declare module '*.astro' {
  const Component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default Component;
}
