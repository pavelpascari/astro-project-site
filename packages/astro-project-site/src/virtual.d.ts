// Types for the virtual modules served by astro-project-site. projectSite() injects this file into the project's
// .astro/ types, so `astro check` knows them in any project that uses the integration.

declare module 'virtual:astro-project-site/config' {
  const config: import('astro-project-site').SiteConfig;
  export default config;
}

declare module 'virtual:astro-project-site/components' {
  type Component = import('astro/runtime/server/index.js').AstroComponentFactory;
  export const Header: Component;
  export const Footer: Component;
  export const Hero: Component;
  export const Landing: Component;
  export const GalleryCard: Component;
  export const Gallery: Component;
}

declare module 'virtual:astro-project-site/og' {
  const ogImageFor: import('astro-project-site').OgImageHook;
  export default ogImageFor;
}

declare module 'virtual:astro-project-site/user-css' {}

declare module 'virtual:astro-project-site/starlight' {
  type Component = import('astro/runtime/server/index.js').AstroComponentFactory;
  export const Search: Component;
  export const ThemeSelect: Component;
  export const showSearch: boolean;
}

declare module 'virtual:astro-project-site/code' {
  export const Code: typeof import('@astrojs/starlight/components').Code;
}

declare module 'virtual:astro-project-site/components/Header' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}

declare module 'virtual:astro-project-site/components/Footer' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}

declare module 'virtual:astro-project-site/components/Hero' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}

declare module 'virtual:astro-project-site/components/Landing' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}

declare module 'virtual:astro-project-site/components/GalleryCard' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}

declare module 'virtual:astro-project-site/components/Gallery' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}
