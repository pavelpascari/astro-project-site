// Builds the Starlight integration from projectSite() options: the docs pipeline (external mounts, sidebar,
// processedDirs, edit links, link checking), the shared chrome (Header, Footer, MobileMenuFooter overrides), the
// theme CSS and the og:image route middleware. Anything under `options.starlight` is passed through, with list
// options (sidebar, plugins, customCss, routeMiddleware, processedDirs) appended to ours rather than replacing them.
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import { buildSidebar, editBaseUrl, resolveProject } from './docs/mount.mjs';
import { resolveModulePath } from './options.mjs';
import { own } from './own.mjs';

const asArray = (/** @type {unknown} */ v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Starlight `social` entry for the repo link (shown in the mobile menu). */
function repoSocial(/** @type {string} */ repo) {
  const host = new URL(repo).hostname.replace(/^www\./, '');
  const icon = host === 'github.com' ? 'github' : host === 'gitlab.com' ? 'gitlab' : host === 'codeberg.org' ? 'codeberg' : 'external';
  const label = icon === 'github' ? 'GitHub' : icon === 'gitlab' ? 'GitLab' : icon === 'codeberg' ? 'Codeberg' : 'Source';
  return { icon, label, href: repo };
}

/**
 * starlight-links-validator, told about the pages it cannot see (it only knows docs pages): the landing page,
 * the gallery, llms.txt and everything under a mirror prefix. The `linksValidator` option adds to this.
 * @param {import('./index').ResolvedOptions} options
 */
export function linksValidator(options) {
  if (options.linksValidator === false) return [];
  const { exclude = [], ...rest } = /** @type {Record<string, any>} */ (options.linksValidator ?? {});
  if (!Array.isArray(exclude)) return [starlightLinksValidator({ ...rest, exclude })];
  const known = [
    ...(options.landing === false ? [] : ['/']),
    ...(options.gallery === false ? [] : ['/gallery', '/gallery/', '/gallery/#*']),
    ...(options.llms ? ['/llms.txt', '/llms-full.txt'] : []),
    ...options.mirrors.flatMap((m) => {
      const to = m.to.replace(/^\/+|\/+$/g, '');
      return [`/${to}`, `/${to}/**`];
    }),
  ];
  return [starlightLinksValidator({ ...rest, exclude: [...known, ...exclude] })];
}

/**
 * The Starlight options projectSite() uses. Exported for tests and for projects that want to inspect them.
 * @param {import('./index').ResolvedOptions} options
 * @param {{ customCss: string[] }} paths
 * @param {string} root
 */
export function starlightOptions(options, paths, root) {
  const project = resolveProject(options, root);
  const editBase = editBaseUrl(project);
  const {
    components = {},
    customCss = [],
    sidebar = [],
    plugins = [],
    routeMiddleware,
    markdown = {},
    social,
    ...rest
  } = /** @type {Record<string, any>} */ (options.starlight);
  const resolve = (/** @type {string} */ id) => resolveModulePath(id, root);

  return {
    title: options.name,
    description: options.tagline,
    favicon: options.favicon,
    social: social ?? [repoSocial(options.repo)],
    // Local pages: <repo>/edit/<branch>/<project folder>/src/content/docs/...; mounted pages carry their own editUrl.
    ...(editBase ? { editLink: { baseUrl: editBase } } : {}),
    ...rest,
    components: {
      Header: own('overrides/Header.astro'),
      Footer: own('overrides/Footer.astro'),
      MobileMenuFooter: own('overrides/MobileMenuFooter.astro'),
      ...Object.fromEntries(Object.entries(components).map(([k, v]) => [k, resolve(v)])),
    },
    // theme.css first, then the project's site-wide CSS, then docs-only CSS.
    customCss: [own('styles/theme.css'), ...paths.customCss, ...asArray(customCss).map(resolve)],
    sidebar: [...buildSidebar(project), ...asArray(sidebar)],
    // Starlight's markdown features (heading anchors, asides, ...) only run on folders it knows about.
    markdown: { ...markdown, processedDirs: [...project.mounts.map((m) => m.dir), ...asArray(markdown.processedDirs).map(resolve)] },
    // og:image (and a large Twitter card) on every docs page, from the same hook as the other pages.
    routeMiddleware: [own('route-middleware.ts'), ...asArray(routeMiddleware).map(resolve)],
    // Fails `astro build` on a broken internal link or #anchor in any docs page (local or mounted).
    plugins: [...linksValidator(options), ...asArray(plugins)],
  };
}

/**
 * @param {import('./index').ResolvedOptions} options
 * @param {{ customCss: string[] }} paths
 * @param {string} root
 */
export function starlightIntegration(options, paths, root) {
  const opts = starlightOptions(options, paths, root);
  const user = /** @type {Record<string, any>} */ (options.starlight);
  // Same rule as Starlight's own header: show search when Pagefind is on or Search is overridden.
  const searchOverride = user.components?.Search;
  return {
    integration: starlight(/** @type {any} */ (opts)),
    search: {
      show: user.pagefind !== false || !!searchOverride,
      Search: searchOverride ? resolveModulePath(searchOverride, root) : '@astrojs/starlight/components/Search.astro',
      ThemeSelect: user.components?.ThemeSelect
        ? resolveModulePath(user.components.ThemeSelect, root)
        : '@astrojs/starlight/components/ThemeSelect.astro',
    },
  };
}
