// GitHub-flavoured markdown everywhere markdown renders: the `project-site:markdown` integration.
//
// It registers the plugins in plugins.mjs on Astro's global markdown processor (so docs, mounted folders, blog
// posts and a project's own .md pages all get them), loads markdown.css on every page, adds the small Mermaid
// loader to every page (Mermaid itself is fetched only where a diagram is), and serves KaTeX's stylesheet and fonts
// under /_project-site/katex-<version>/ for the pages with math. Code blocks are configured separately, through
// Starlight's `expressiveCode` option (expressive-code.mjs).
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveProject } from '../docs/mount.mjs';
import { mirror } from '../mirror.mjs';
import { own } from '../own.mjs';
import { existsSync } from 'node:fs';
import { ecConfigModule } from './expressive-code.mjs';
import { markdownPlugins } from './plugins.mjs';

export { expressiveCodeConfig } from './expressive-code.mjs';

const require = createRequire(import.meta.url);

/** Whether `name` resolves from the project (its own node_modules or a parent's). */
export function hasPackage(/** @type {string} */ name, /** @type {string} */ root) {
  try {
    createRequire(path.join(root, 'package.json')).resolve(`${name}/package.json`);
    return true;
  } catch {
    return false;
  }
}

/** Folder of KaTeX's dist/ (stylesheet and fonts) and its version. */
export function katexAssets() {
  const dist = path.dirname(require.resolve('katex'));
  const { version } = require(path.join(dist, '../package.json'));
  return { dist, path: `_project-site/katex-${version}` };
}

/** Default for each switch in the `markdown` option. */
export const MARKDOWN_DEFAULTS = { alerts: true, emoji: true, math: true, mermaid: true, headingLinks: true, codeWrapToggle: true };

/**
 * Starlight runs its markdown plugins (heading anchors, asides) on src/content/docs and `markdown.processedDirs`:
 * our heading links stay out of those files so headings do not get two.
 * @param {import('../index').ResolvedOptions} options
 * @param {string} root
 * @param {URL} srcDir
 */
export function starlightDirs(options, root, srcDir) {
  const user = /** @type {{ markdown?: { processedDirs?: string[] } }} */ (options.starlight).markdown?.processedDirs ?? [];
  const dirs = [
    fileURLToPath(new URL('content/docs/', srcDir)),
    ...resolveProject(options, root).mounts.map((m) => m.dir),
    ...user.map((d) => path.resolve(root, d)),
  ];
  return dirs.map((d) => d.split(path.sep).join('/').replace(/\/?$/, '/'));
}

/**
 * @param {import('../index').ResolvedOptions} options
 * @returns {import('astro').AstroIntegration}
 */
export function markdownIntegration(options) {
  const features = { ...MARKDOWN_DEFAULTS, ...options.markdown };
  return {
    name: 'project-site:markdown',
    hooks: {
      'astro:config:setup': ({ config, injectScript, updateConfig, logger }) => {
        const root = path.resolve(fileURLToPath(config.root));
        const katex = katexAssets();
        const base = (config.base ?? '/').replace(/\/?$/, '/');
        const dirs = starlightDirs(options, root, config.srcDir);
        const isStarlightFile = (/** @type {URL | undefined} */ url) => {
          if (!url || url.protocol !== 'file:') return false;
          const file = fileURLToPath(url).split(path.sep).join('/');
          return dirs.some((d) => file.startsWith(d));
        };

        // Mermaid is an optional peer dependency (it is large): diagrams are drawn only when the project installs it.
        const mermaidInstalled = features.mermaid && hasPackage('mermaid', root);
        const processor = /** @type {any} */ (config.markdown)?.processor;
        if (processor?.name === 'satteri' && Array.isArray(processor.options?.hastPlugins)) {
          const f = (processor.options.features ??= {});
          if (features.math) f.math ??= true;
          // GitHub keeps `--` as typed (CLI flags in prose); Astro's smart punctuation would make it an en dash.
          // Quotes and ellipses stay smart. An explicit setting (here or Astro's `smartypants`) wins.
          if (f.smartPunctuation === undefined && /** @type {any} */ (config.markdown).smartypants === undefined) {
            f.smartPunctuation = { quotes: true, dashes: false, ellipses: true };
          }
          let warned = false;
          const { first, rest } = markdownPlugins({
            features,
            katexCss: `${base}${katex.path}/katex.min.css`,
            isStarlightFile,
            mermaidInstalled,
            onMissingMermaid: (file) => {
              if (warned) return;
              warned = true;
              const where = file?.protocol === 'file:' ? path.relative(root, fileURLToPath(file)) : 'a page';
              logger.warn(
                `${where} has a \`\`\`mermaid diagram, but the optional \`mermaid\` package is not installed, so diagrams show ` +
                  'their source. To draw them: npm i mermaid (or set markdown.mermaid: false to silence this).',
              );
            },
          });
          // First: math and mermaid blocks must be replaced before Expressive Code sees them as code.
          processor.options.hastPlugins.unshift(...first);
          processor.options.hastPlugins.push(...rest);
        } else {
          logger.warn(
            `markdown.processor "${processor?.name ?? 'unknown'}" is not Sätteri (Astro's default): GitHub alerts, emoji, math and ` +
              'mermaid diagrams are not rendered.',
          );
        }

        injectScript('page-ssr', `import ${JSON.stringify(own('styles/markdown.css'))};`);
        if (mermaidInstalled) {
          injectScript('page', `import ${JSON.stringify(own('markdown/client/mermaid-loader.ts'))};`);
          // Mermaid's lazily loaded chunks (layout engines, diagram types) are large by nature; they are fetched only
          // by pages with diagrams. Keep Vite's chunk-size warning for the project's own code at a level they pass.
          const limit = /** @type {any} */ (config.vite)?.build?.chunkSizeWarningLimit;
          if (limit === undefined) updateConfig({ vite: { build: { chunkSizeWarningLimit: 1600 } } });
          // Mermaid's optional ELK layout engine is EPL-2.0: replaced by a stub (see client/elk-stub.ts).
          updateConfig({ vite: { resolve: { alias: [{ find: /^elkjs\/lib\/elk\.bundled\.js$/, replacement: own('markdown/client/elk-stub.ts') }] } } });
        }
        // Expressive Code's <Code> component reads its plugins from the project's ec.config.mjs; without one, serve ours.
        const EC_CONFIG = 'virtual:astro-expressive-code/ec-config';
        const RESOLVED = '\0project-site:ec-config';
        if (!existsSync(path.join(root, 'ec.config.mjs'))) {
          updateConfig({
            vite: {
              plugins: [
                {
                  name: 'project-site:ec-config',
                  enforce: 'pre',
                  resolveId: (/** @type {string} */ id) => (id === EC_CONFIG ? RESOLVED : undefined),
                  load: (/** @type {string} */ id) => (id === RESOLVED ? ecConfigModule({ wrapToggle: features.codeWrapToggle }) : undefined),
                },
              ],
            },
          });
        }
        if (features.math) {
          const katexMirror = mirror([{ from: katex.dist, to: katex.path, include: ['katex.min.css', 'fonts/*.woff2'] }]);
          updateConfig({ integrations: [{ ...katexMirror, name: 'project-site:katex' }] });
        }
      },
    },
  };
}
