// Builds the Starlight integration from projectSite() options: the docs pipeline (external mounts, sidebar,
// processedDirs, edit links, link checking), the shared chrome (Header, Footer, MobileMenuFooter overrides), the
// theme CSS and the og:image route middleware. Anything under `options.starlight` is passed through, with list
// options (sidebar, plugins, customCss, routeMiddleware, processedDirs) appended to ours rather than replacing them.
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import { blogKnownLinks } from './blog/options.mjs';
import { expressiveCodeConfig } from './markdown/expressive-code.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { buildSidebar, editBaseUrl, listMountFiles, resolveProject, slugify } from './docs/mount.mjs';
import { LAYER_ORDER } from './lib/layers.mjs';
import { COLLAPSE_ABOVE } from './lib/sidebar.mjs';
import { resolveModulePath } from './options.mjs';
import { own } from './own.mjs';
import { repoHost } from './repo-host.mjs';
import { format } from './labels.mjs';

const asArray = (/** @type {unknown} */ v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Starlight `social` entry for the repo link (shown in the mobile menu). */
function repoSocial(/** @type {string} */ repo, /** @type {string} */ fallback) {
  const { icon, name } = repoHost(repo);
  return { icon, label: name ?? fallback, href: repo };
}

/**
 * starlight-links-validator, told about the pages it cannot see (it only knows docs pages): the landing page,
 * the gallery, llms.txt, the blog and everything under a mirror prefix. The `linksValidator` option adds to this.
 * @param {import('./index').ResolvedOptions} options
 */
export function linksValidator(options, /** @type {string[]} */ pages = []) {
  if (options.linksValidator === false) return [];
  const { exclude = [], ...rest } = /** @type {Record<string, any>} */ (options.linksValidator ?? {});
  if (!Array.isArray(exclude)) return [starlightLinksValidator({ ...rest, exclude })];
  const known = [
    ...(options.landing === false ? [] : ['/']),
    ...(options.gallery === false ? [] : [`/${options.gallery.route}`, `/${options.gallery.route}/`, `/${options.gallery.route}/#*`]),
    ...(options.llms ? ['/llms.txt', '/llms-full.txt'] : []),
    ...blogKnownLinks(options.blog),
    // Automatic overview pages (routes/section.astro) are not in the docs collection either.
    ...pages.flatMap((p) => [p, p.replace(/\/$/, ''), `${p}#*`]),
    ...options.mirrors.flatMap((m) => {
      const to = m.to.replace(/^\/+|\/+$/g, '');
      return [`/${to}`, `/${to}/**`];
    }),
  ];
  return [starlightLinksValidator({ ...rest, exclude: [...known, ...exclude] })];
}

// ---------- sidebar presentation ----------

// Above this many pages the generated groups start collapsed (the current page's group always opens).
export { COLLAPSE_ABOVE };

/**
 * Presentation of the generated sidebar: in a small docs site every group is open, so everything is one glance
 * away; in a larger one every group starts collapsed and only the branch of the current page opens (Starlight
 * opens a group holding the current page). Groups a project adds under `starlight.sidebar` are left as they are.
 * @param {any[]} items
 * @param {number} pages
 */
export function presentSidebar(items, pages) {
  const collapsed = pages > COLLAPSE_ABOVE;
  /** @type {(list: any[]) => any[]} */
  const walk = (list) =>
    list.map((item) => (item && typeof item === 'object' && 'items' in item ? { ...item, collapsed, items: walk(item.items) } : item));
  return walk(items);
}

/** Number of docs pages: local pages under src/content/docs/docs/ plus the files of every mount. */
export function countPages(/** @type {ReturnType<typeof resolveProject>} */ project) {
  /** @type {(dir: string) => number} */
  const count = (dir) => {
    if (!fs.existsSync(dir)) return 0;
    let n = 0;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.') || ent.name.startsWith('_') || ent.name === 'node_modules') continue;
      if (ent.isDirectory()) n += count(path.join(dir, ent.name));
      else if (/\.(md|mdx|markdown|mdoc)$/i.test(ent.name)) n++;
    }
    return n;
  };
  return count(path.join(project.localDir, 'docs')) + project.mounts.reduce((n, m) => n + listMountFiles(m).length, 0);
}

const INDEX = /^(index|readme)\.(md|mdx|markdown|mdoc)$/i;

/**
 * Paths of the automatic overview pages: docs folders (local or mounted) with pages under them but no index page.
 * Read from the file system for the links validator, which runs before the collection exists.
 * @param {ReturnType<typeof resolveProject>} project
 */
export function overviewPaths(project) {
  /** @type {Set<string>} */
  const out = new Set();
  /** @param {string[]} files posix paths relative to a folder; @param {string} prefix URL path of that folder */
  const collect = (files, prefix) => {
    const folders = new Set(files.flatMap((f) => f.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))));
    for (const folder of folders) {
      if (files.some((f) => f.startsWith(folder + '/') && !f.slice(folder.length + 1).includes('/') && INDEX.test(f.slice(folder.length + 1)))) continue;
      out.add(`${prefix}${folder.split('/').map(slugify).join('/')}/`);
    }
  };
  /** @type {(dir: string, rel?: string) => string[]} */
  const walk = (dir, rel = '') => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((ent) => {
      /** @type {string[]} */
      const none = [];
      if (ent.name.startsWith('.') || ent.name.startsWith('_') || ent.name === 'node_modules') return none;
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) return walk(path.join(dir, ent.name), r);
      return /\.(md|mdx|markdown|mdoc)$/i.test(ent.name) ? [r] : none;
    });
  };
  collect(walk(project.localDir), '/');
  for (const m of project.mounts) {
    const files = listMountFiles(m);
    if (files.length && !files.some((f) => INDEX.test(f))) out.add(`/${m.routeId}/`);
    collect(files, `/${m.routeId}/`);
  }
  return [...out].sort();
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
    head = [],
    markdown = {},
    social,
    ...rest
  } = /** @type {Record<string, any>} */ (options.starlight);
  const resolve = (/** @type {string} */ id) => resolveModulePath(id, root);

  return {
    title: options.name,
    description: options.tagline,
    favicon: options.favicon,
    social: social ?? [repoSocial(options.repo, format(options.labels.sourceCode))],
    // Local pages: <repo>/edit/<branch>/<project folder>/src/content/docs/...; mounted pages carry their own editUrl.
    ...(editBase ? { editLink: { baseUrl: editBase } } : {}),
    ...rest,
    // Code blocks: line numbers, collapsible sections, shell prompts, wrap toggle (src/markdown/expressive-code.mjs).
    expressiveCode: expressiveCodeConfig(options, rest.expressiveCode),
    components: {
      Header: own('overrides/Header.astro'),
      Footer: own('overrides/Footer.astro'),
      MobileMenuFooter: own('overrides/MobileMenuFooter.astro'),
      PageTitle: own('overrides/PageTitle.astro'),
      Sidebar: own('overrides/Sidebar.astro'),
      ...Object.fromEntries(Object.entries(components).map(([k, v]) => [k, resolve(v)])),
    },
    // theme.css first, then the project's site-wide CSS, then docs-only CSS.
    customCss: [own('styles/theme.css'), own('styles/docs.css'), ...paths.customCss, ...asArray(customCss).map(resolve)],
    sidebar: [...presentSidebar(buildSidebar(project, format(options.labels.overview)), countPages(project)), ...asArray(sidebar)],
    // The site-wide `head` option first, then docs-only `starlight.head`.
    // The layer order first of all (lib/layers.mjs).
    head: [{ tag: 'style', content: LAYER_ORDER }, ...options.head, ...asArray(head)],
    // Starlight's markdown features (heading anchors, asides, ...) only run on folders it knows about.
    markdown: { ...markdown, processedDirs: [...project.mounts.map((m) => m.dir), ...asArray(markdown.processedDirs).map(resolve)] },
    // og:image (and a large Twitter card) on every docs page, from the same hook as the other pages.
    routeMiddleware: [own('route-middleware.ts'), own('nav-middleware.ts'), ...asArray(routeMiddleware).map(resolve)],
    // Fails `astro build` on a broken internal link or #anchor in any docs page (local or mounted).
    plugins: [...linksValidator(options, overviewPaths(project)), ...asArray(plugins)],
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
