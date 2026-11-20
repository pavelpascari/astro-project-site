// Only for `npm run check` (tsc): .astro imports. In a project, Astro provides these types itself.
declare module '*.astro' {
  const Component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default Component;
}

// Starlight's resolved config, read by nav-middleware.ts (`pagination`). Starlight types it in a project.
declare module 'virtual:starlight/user-config' {
  const config: { pagination: boolean } & Record<string, unknown>;
  export default config;
}
