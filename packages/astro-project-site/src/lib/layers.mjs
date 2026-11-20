// The cascade-layer order of every page, declared inline in <head> before any stylesheet. Layer order is fixed by
// the first time a layer name appears; Vite may put a Starlight component's CSS (the header's search, used on
// docs and non-docs pages alike) in a shared chunk that loads before Starlight's own order declaration, which would
// put `starlight.core` ahead of `starlight.reset`. This keeps Starlight's order (style/layers.css), with
// theme.css's fallback layer first.
export const LAYER_ORDER =
  '@layer project-site.fallback, starlight.base, starlight.reset, starlight.core, starlight.content, starlight.components, starlight.components.icon, starlight.components.aside, starlight.utils;';
