import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { parseOptions } from '../src/options.mjs';
import { resolveProject } from '../src/docs/mount.mjs';
import { COLLAPSE_ABOVE, linksValidator, overviewPaths, presentSidebar, starlightOptions } from '../src/starlight.mjs';
import { publicConfig } from '../src/virtual.mjs';
import { fixture } from './helpers.mjs';

const root = fixture({ 'docs/README.md': '# Docs\n', 'src/docs.css': '', 'src/Search.astro': '' });
const base = { name: 'Lib', tagline: 't', url: 'https://lib.dev', repo: 'https://gitlab.com/me/lib' };
const own = (/** @type {string} */ rel) => path.resolve(import.meta.dirname, '../src', rel);

test('Starlight options: ours first, passthrough lists appended, components overridable', () => {
  const options = parseOptions({
    ...base,
    externalDocs: [{ dir: './docs', route: 'ref', label: 'Ref' }],
    starlight: {
      sidebar: [{ label: 'Extra', link: '/extra/' }],
      customCss: ['./src/docs.css'],
      components: { Search: './src/Search.astro' },
      routeMiddleware: './src/mw.ts',
      markdown: { headingLinks: false },
      lastUpdated: true,
    },
  });
  const opts = /** @type {any} */ (starlightOptions(options, { customCss: ['/abs/site.css'] }, root));
  assert.equal(opts.title, 'Lib');
  assert.deepEqual(opts.social, [{ icon: 'gitlab', label: 'GitLab', href: 'https://gitlab.com/me/lib' }]);
  assert.equal(opts.lastUpdated, true);
  assert.deepEqual(opts.customCss, [own('styles/theme.css'), own('styles/docs.css'), '/abs/site.css', path.join(root, 'src/docs.css')]);
  assert.equal(opts.components.Header, own('overrides/Header.astro'));
  assert.equal(opts.components.Search, path.join(root, 'src/Search.astro'));
  assert.deepEqual(opts.sidebar.at(-1), { label: 'Extra', link: '/extra/' });
  assert.equal(opts.sidebar[0].label, 'Ref');
  assert.deepEqual(opts.markdown, { headingLinks: false, processedDirs: [path.join(root, 'docs')] });
  assert.deepEqual(opts.routeMiddleware, [own('route-middleware.ts'), own('nav-middleware.ts'), path.join(root, 'src/mw.ts')]);
  assert.equal(opts.plugins.length, 1);
  // Not in a git repo: the project root is taken as the repo root.
  assert.deepEqual(opts.editLink, { baseUrl: 'https://gitlab.com/me/lib/edit/main/' });
});

test('linksValidator: false turns it off', () => {
  assert.deepEqual(linksValidator(parseOptions({ ...base, linksValidator: false })), []);
  assert.equal(linksValidator(parseOptions(base)).length, 1);
});

test('the config module carries what components need, not setup-only options', () => {
  const config = publicConfig(parseOptions({ ...base, components: { Header: './x' }, mirrors: [{ from: '.', to: 'x' }] }), '1.2.3');
  assert.equal(config.version, '1.2.3');
  for (const key of ['components', 'starlight', 'customCss', 'ogImageFor', 'mirrors']) assert.ok(!(key in config), key);
});

test('generated sidebar groups: open in a small site, collapsed in a large one; links untouched', () => {
  const items = [{ slug: 'docs' }, { label: 'Guides', collapsed: true, items: [{ slug: 'a' }, { label: 'Deep', items: [{ slug: 'b' }] }] }];
  const small = presentSidebar(items, COLLAPSE_ABOVE);
  assert.deepEqual(small[0], { slug: 'docs' });
  assert.equal(small[1].collapsed, false);
  assert.equal(small[1].items[1].collapsed, false);
  const large = presentSidebar(items, COLLAPSE_ABOVE + 1);
  assert.equal(large[1].collapsed, true);
  assert.equal(large[1].items[1].collapsed, true);
  assert.equal(items[1].collapsed, true, 'input not mutated');
});

test('overviewPaths: docs folders without an index page, local and mounted', () => {
  const root = fixture({
    'src/content/docs/docs/index.mdx': '',
    'src/content/docs/docs/guides/a.md': '',
    'src/content/docs/docs/reference/index.md': '',
    'src/content/docs/docs/reference/b.md': '',
    'ext/README.md': '# Ext\n',
    'ext/How To/deploy.md': '',
    'bare/x.md': '',
  });
  const options = parseOptions({
    ...base,
    externalDocs: [
      { dir: './ext', route: 'ext', label: 'Ext' },
      { dir: './bare', route: 'bare', label: 'Bare' },
    ],
  });
  const opts = /** @type {any} */ (starlightOptions(options, { customCss: [] }, root));
  assert.ok(opts.plugins.length >= 1);
  assert.deepEqual(overviewPaths(resolveProject(options, root)), ['/docs/bare/', '/docs/ext/how-to/', '/docs/guides/']);
});
