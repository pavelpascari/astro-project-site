---
title: Exports and virtual modules
description: The package's entry points, its public types, and the virtual modules behind astro-project-site/config.
sidebar:
  order: 7
---

| Import | What |
|---|---|
| `astro-project-site` | `default projectSite(options)`, `mirror(entries)` (the mirror integration on its own); types |
| `astro-project-site/components` | The components and helpers listed under [Components](/docs/reference/components/) |
| `astro-project-site/content` | `projectSiteCollections()`, `gallerySchema`, `projectDocsLoader` ([Content collections](/docs/reference/content/)) |
| `astro-project-site/config` | The validated options plus `version`, for your own pages |
| `astro-project-site/theme.css` | The design tokens. Loaded on every page already; import it only in a page that uses neither `BaseLayout` nor Starlight |
| `astro-project-site/virtual` | Types only: the declarations below |

Types exported from `astro-project-site`: `ProjectSiteOptions`, `ResolvedOptions`, `ResolvedLanding`,
`SiteConfig`, `LandingContent`, `HeroDemo`, `Feature`, `Step`, `SectionContent`, `LinkAction`, `ExternalDocs`,
`Mirror`, `ComponentOverrides`, `GalleryEntry`, `GalleryData`, `OgImageHook`, `OgImageRequest`, and the
[Live types](/docs/reference/live/) `LiveProps`, `LiveRunner`, `LiveContext`, `LiveRunResult`, `LiveMode`,
`LivePreviewPosition`, `LiveStatusLevel`.

## astro-project-site/config

```astro title="src/pages/about.astro"
---
import config from 'astro-project-site/config';
---
<p>{config.name} v{config.version}: {config.tagline}</p>
```

The default export is `SiteConfig`: the options after validation and defaults (`nav` filled in, `url` and `repo`
without trailing slash, `features`/`steps` normalised to `{ title, intro, items }`), **minus** `components`,
`starlight`, `customCss`, `ogImageFor` and `mirrors`, **plus** `version` (read from `versionFrom` at startup).

## Virtual modules

`astro-project-site/config` re-exports `virtual:astro-project-site/config`. The integration serves five virtual
modules and injects their types into `.astro/`, so `astro check` passes without setup. Only `config` is meant
for projects; the others are how the built-in components find overrides and may change between minor
versions.

<!-- gen:file from=src/virtual.d.ts lang=ts -->
```ts title="src/virtual.d.ts"
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
  export const BlogIndex: Component;
  export const BlogPost: Component;
  export const BlogCard: Component;
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

declare module 'virtual:astro-project-site/components/BlogIndex' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}

declare module 'virtual:astro-project-site/components/BlogPost' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}

declare module 'virtual:astro-project-site/components/BlogCard' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}
```
<!-- /gen -->
