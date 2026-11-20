// projectSite(): the one integration a project adds. It sets up Starlight (with the docs pipeline), the mirrors,
// the shared chrome and theme, and injects the landing page, the gallery and llms.txt.
//
//   // astro.config.mjs
//   import { defineConfig } from 'astro/config';
//   import projectSite from 'astro-project-site';
//   export default defineConfig({ integrations: [projectSite({ name, tagline, url, repo, ... })] });
//
// Options are validated here, before Astro starts, so a typo fails with the field's name.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AstroError } from 'astro/errors';
import { blogHeadTags } from './blog/options.mjs';
import { editBaseUrl, resolveProject } from './docs/mount.mjs';
import { mirror } from './mirror.mjs';
import { own } from './own.mjs';
import { parseOptions, ProjectSiteOptionsError, resolveOptionPaths } from './options.mjs';
import { starlightIntegration } from './starlight.mjs';
import { vitePluginProjectSite } from './virtual.mjs';


/**
 * @param {import('./index').ProjectSiteOptions} userOptions
 * @returns {import('astro').AstroIntegration}
 */
export default function projectSite(userOptions) {
  const options = withReadableErrors(() => parseOptions(userOptions));
  // The blog's feed is announced on every page (docs included) through the `head` option.
  options.head = [...blogHeadTags(options.blog, options.name), ...options.head];

  return {
    name: 'astro-project-site',
    hooks: {
      'astro:config:setup': ({ config, updateConfig, injectRoute, addWatchFile, logger }) => {
        const root = path.resolve(fileURLToPath(config.root));
        const paths = withReadableErrors(() => resolveOptionPaths(options, root));
        const pagesDir = path.join(fileURLToPath(config.srcDir), 'pages');
        const ownsRoute = (/** @type {string[]} */ candidates) => candidates.find((c) => existsSync(path.join(pagesDir, c)));

        const version = readVersion(paths.versionFrom, options.versionFrom, logger);
        if (paths.versionFrom) addWatchFile(paths.versionFrom);

        // The blog's "edit this post" links need the site's place in its repo.
        const blog = options.blog;
        if (blog) blog.editBase = editBaseUrl(resolveProject(options, root));

        // Routes: each can be switched off, and a page of the project's own at the same URL always wins.
        const routes = [
          { on: options.landing !== false, pattern: '/', entry: 'routes/index.astro', files: ['index.astro', 'index.md', 'index.mdx', 'index.html'] },
          { on: options.gallery !== false, pattern: '/gallery', entry: 'routes/gallery.astro', files: ['gallery.astro', 'gallery/index.astro', 'gallery/index.md', 'gallery/index.mdx'] },
          { on: options.llms, pattern: '/llms.txt', entry: 'routes/llms.txt.ts', files: ['llms.txt.ts', 'llms.txt.js'] },
          { on: options.llms, pattern: '/llms-full.txt', entry: 'routes/llms-full.txt.ts', files: ['llms-full.txt.ts', 'llms-full.txt.js'] },
          // One route for the post list, its pages, the posts and the tag pages (see routes/blog/[...path].astro).
          ...(blog
            ? [
                { on: true, pattern: `/${blog.route}/[...path]`, entry: 'routes/blog/[...path].astro', files: [`${blog.route}/[...path].astro`, `${blog.route}/[...slug].astro`] },
                { on: blog.rss, pattern: `/${blog.route}/rss.xml`, entry: 'routes/blog/rss.xml.ts', files: [`${blog.route}/rss.xml.ts`, `${blog.route}/rss.xml.js`] },
              ]
            : []),
        ];
        for (const route of routes) {
          if (!route.on) continue;
          const mine = ownsRoute(route.files);
          if (mine) logger.info(`src/pages/${mine} replaces the built-in ${route.pattern} page.`);
          else injectRoute({ pattern: route.pattern, entrypoint: own(route.entry), prerender: true });
        }

        const starlight = starlightIntegration(options, paths, root);
        // These are set from `name`, `tagline` and `favicon`; a value under `starlight` wins on docs pages only.
        const shadowed = { title: 'name', description: 'tagline', favicon: 'favicon' };
        for (const [key, ours] of Object.entries(shadowed)) {
          if (key in options.starlight)
            logger.warn(`starlight.${key} replaces the \`${ours}\` option on docs pages only; set \`${ours}\` instead to change it everywhere.`);
        }
        updateConfig({
          site: config.site ?? options.url,
          integrations: [starlight.integration, mirror(options.mirrors)],
          vite: {
            plugins: [vitePluginProjectSite({ options, paths, version, search: starlight.search })],
            // starlight-links-validator adds a route middleware by bare specifier, which Starlight imports from the
            // project root. It is this package's dependency, not the project's: point the specifier at our copy so
            // it resolves without hoisting (pnpm, file: links).
            resolve: { alias: [{ find: /^starlight-links-validator\/middleware$/, replacement: fileURLToPath(import.meta.resolve('starlight-links-validator/middleware')) }] },
          },
        });
      },

      'astro:config:done': ({ injectTypes }) => {
        // Types for the virtual modules the components read (and that a project may import too).
        injectTypes({ filename: 'virtual.d.ts', content: readFileSync(own('virtual.d.ts'), 'utf8') });
      },
    },
  };
}

/** Re-throws option problems as an AstroError so Astro prints them as a readable list. */
function withReadableErrors(/** @type {() => any} */ fn) {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ProjectSiteOptionsError) {
      throw new AstroError(error.message, 'Check the options passed to projectSite() in astro.config.mjs.');
    }
    throw error;
  }
}

/** `version` from the package.json at `file`, or undefined (with a warning) when unreadable. */
function readVersion(/** @type {string | undefined} */ file, /** @type {string | undefined} */ label, /** @type {import('astro').AstroIntegrationLogger} */ logger) {
  if (!file) return undefined;
  try {
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof pkg.version === 'string') return pkg.version;
    logger.warn(`${label} has no "version" field; the header shows no version.`);
  } catch (error) {
    logger.warn(`Could not read versionFrom (${file}): ${/** @type {Error} */ (error).message}`);
  }
  return undefined;
}

export { mirror } from './mirror.mjs';
export { COMPONENT_NAMES, OPTION_NAMES } from './options.mjs';
