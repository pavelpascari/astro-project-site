// Vite plugin serving the virtual modules through which options reach components (types: virtual.d.ts).
//
//   virtual:astro-project-site/config      the validated options as JSON, plus the resolved version
//   virtual:astro-project-site/components  the replaceable components (option `components`, else the built-ins)
//   virtual:astro-project-site/og          the social-image hook (option `ogImageFor`, else `ogImage` for every page)
//   virtual:astro-project-site/user-css    imports of the `customCss` files (site-wide CSS)
//   virtual:astro-project-site/starlight   the Search and ThemeSelect the docs use, and whether search is on
import { own } from './own.mjs';

const PREFIX = 'virtual:astro-project-site/';

/** Built-in component for each replaceable slot. */
const DEFAULT_COMPONENTS = {
  Header: 'components/chrome/SiteHeader.astro',
  Footer: 'components/chrome/SiteFooter.astro',
  Hero: 'components/landing/Hero.astro',
  Landing: 'components/landing/Landing.astro',
  GalleryCard: 'components/gallery/GalleryCard.astro',
  Gallery: 'components/gallery/GalleryPage.astro',
};

/** The JSON the config module exports: everything components need, nothing that only matters at setup. */
export function publicConfig(
  /** @type {import('./index').ResolvedOptions} */ options,
  /** @type {string | undefined} */ version,
) {
  const { components, starlight, customCss, ogImageFor, mirrors, ...rest } = options;
  return { ...rest, version };
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
    og: paths.ogImageFor
      ? `export { default } from ${json(paths.ogImageFor)};`
      : `const image = ${json(options.ogImage)};\nexport default function ogImageFor() { return image; }`,
    'user-css': paths.customCss.map((file) => `import ${json(file)};`).join('\n'),
    starlight: [
      `export { default as Search } from ${json(search.Search)};`,
      `export { default as ThemeSelect } from ${json(search.ThemeSelect)};`,
      `export const showSearch = ${json(search.show)};`,
    ].join('\n'),
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
