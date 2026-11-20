// Vite plugin serving the virtual modules through which options reach components (types: virtual.d.ts).
//
//   virtual:astro-project-site/config      the validated options as JSON, plus the resolved version
//   virtual:astro-project-site/components  the replaceable components (option `components`, else the built-ins)
//   virtual:astro-project-site/components/<Slot>  one of them alone (default export). The package imports these,
//                                          so an override and its CSS are bundled only into pages that render it.
//   virtual:astro-project-site/og          the social-image hook (option `ogImageFor`, else `ogImage` for every page)
//   virtual:astro-project-site/user-css    imports of the `customCss` files (site-wide CSS)
//   virtual:astro-project-site/starlight   the Search and ThemeSelect the docs use, and whether search is on
//   virtual:astro-project-site/code        Expressive Code's <Code> (for <Live>), without Starlight's component barrel
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { own } from './own.mjs';

/**
 * Where `<Code>` comes from. Starlight re-exports it from `@astrojs/starlight/components`, but importing that barrel
 * pulls Starlight's whole base stylesheet (~64 KB) into every page that renders a `<Live>`, the landing page and the
 * gallery included. Import Expressive Code's component directly, resolved from Starlight's own dependency so it
 * works without hoisting; fall back to the barrel if that ever fails.
 */
export function codeComponentModule() {
  try {
    const starlight = fileURLToPath(import.meta.resolve('@astrojs/starlight'));
    return createRequire(starlight).resolve('astro-expressive-code/components');
  } catch {
    return '@astrojs/starlight/components';
  }
}

const PREFIX = 'virtual:astro-project-site/';

/** Built-in component for each replaceable slot. */
const DEFAULT_COMPONENTS = {
  Header: 'components/chrome/SiteHeader.astro',
  Footer: 'components/chrome/SiteFooter.astro',
  Hero: 'components/landing/Hero.astro',
  Landing: 'components/landing/Landing.astro',
  GalleryCard: 'components/gallery/GalleryCard.astro',
  Gallery: 'components/gallery/GalleryPage.astro',
  BlogIndex: 'components/blog/BlogIndex.astro',
  BlogPost: 'components/blog/BlogPost.astro',
  BlogCard: 'components/blog/BlogCard.astro',
};

/** The JSON the config module exports: everything components need, nothing that only matters at setup. */
export function publicConfig(
  /** @type {import('./index').ResolvedOptions} */ options,
  /** @type {string | undefined} */ version,
) {
  const { components, starlight, customCss, ogImageFor, mirrors, ...rest } = options;
  return { ...rest, ...siteLocale(starlight), version };
}

/**
 * Language and direction for pages outside the docs, from Starlight's locales: the root locale, else the
 * `defaultLocale`, else English.
 */
export function siteLocale(/** @type {Record<string, any> | undefined} */ starlight) {
  const locales = starlight?.locales;
  if (locales && typeof locales === 'object') {
    const key = 'root' in locales ? 'root' : starlight?.defaultLocale in locales ? starlight?.defaultLocale : undefined;
    const locale = key ? locales[key] : undefined;
    if (locale) return { lang: String(locale.lang ?? (key === 'root' ? 'en' : key)), dir: locale.dir === 'rtl' ? 'rtl' : 'ltr' };
  }
  return { lang: 'en', dir: 'ltr' };
}

/**
 * @param {{
 *   options: import('./index').ResolvedOptions,
 *   paths: { components: Record<string, string>, customCss: string[], ogImageFor?: string },
 *   version: string | undefined,
 *   search: { show: boolean, Search: string, ThemeSelect: string },
 * }} ctx
 */
export function vitePluginProjectSite({ options, paths, version, search }) {
  const json = (/** @type {unknown} */ v) => JSON.stringify(v);
  /** @type {Record<string, string>} */
  const modules = {
    config: `export default ${json(publicConfig(options, version))};`,
    components: Object.entries(DEFAULT_COMPONENTS)
      .map(([name, file]) => `export { default as ${name} } from ${json(paths.components[name] ?? own(file))};`)
      .join('\n'),
    ...Object.fromEntries(
      Object.entries(DEFAULT_COMPONENTS).map(([name, file]) => [
        `components/${name}`,
        `export { default } from ${json(paths.components[name] ?? own(file))};`,
      ]),
    ),
    og: paths.ogImageFor
      ? `export { default } from ${json(paths.ogImageFor)};`
      : `const image = ${json(options.ogImage)};\nexport default function ogImageFor() { return image; }`,
    'user-css': paths.customCss.map((file) => `import ${json(file)};`).join('\n'),
    starlight: [
      `export { default as Search } from ${json(search.Search)};`,
      `export { default as ThemeSelect } from ${json(search.ThemeSelect)};`,
      `export const showSearch = ${json(search.show)};`,
    ].join('\n'),
    code: `export { Code } from ${json(codeComponentModule())};`,
  };

  return {
    name: 'vite-plugin-astro-project-site',
    resolveId(/** @type {string} */ id) {
      if (id.startsWith(PREFIX) && id.slice(PREFIX.length) in modules) return `\0${id}`;
    },
    load(/** @type {string} */ id) {
      if (id.startsWith(`\0${PREFIX}`)) return modules[id.slice(PREFIX.length + 1)];
    },
  };
}
