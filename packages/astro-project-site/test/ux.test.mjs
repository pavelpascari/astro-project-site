// Static guards for the responsive/UX work. The browser check itself is test/ux/ux-check.mjs (needs Playwright and
// a running site; see the README's Development section).
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { codeComponentModule, vitePluginProjectSite } from '../src/virtual.mjs';
import { parseOptions } from '../src/options.mjs';

const src = (/** @type {string} */ rel) => readFileSync(path.resolve(import.meta.dirname, '../src', rel), 'utf8');

test('<Code> for <Live> comes from Expressive Code directly, not the Starlight barrel (which drags its CSS along)', () => {
  const file = codeComponentModule();
  assert.ok(path.isAbsolute(file) && existsSync(file), file);
  assert.match(file, /astro-expressive-code/);
  const options = parseOptions({ name: 'Lib', tagline: 't', url: 'https://lib.dev', repo: 'https://github.com/me/lib' });
  const plugin = vitePluginProjectSite({
    options,
    paths: { components: {}, customCss: [] },
    version: undefined,
    search: { show: true, Search: 'S', ThemeSelect: 'T' },
  });
  const id = /** @type {string} */ (plugin.resolveId('virtual:astro-project-site/code'));
  assert.equal(plugin.load(id), `export { Code } from ${JSON.stringify(file)};`);
  assert.match(src('components/live/Live.astro'), /from 'virtual:astro-project-site\/code'/);
  assert.doesNotMatch(src('components/live/Live.astro'), /from '@astrojs\/starlight\/components'/);
});

test('the shared stylesheet keeps touch, contrast and focus rules', () => {
  const theme = src('styles/theme.css');
  assert.match(theme, /@media \(pointer: coarse\)[^}]*--sl-menu-button-size: 2\.75rem/);
  assert.match(theme, /@media \(prefers-contrast: more\)/);
  assert.match(theme, /\[data-scroll-region\]:focus-visible/);
});

test('the viewport meta allows zooming', () => {
  const head = src('components/chrome/SiteHead.astro');
  const meta = /<meta name="viewport" content="([^"]+)"/.exec(head)?.[1] ?? '';
  assert.ok(meta.includes('width=device-width'));
  assert.doesNotMatch(meta, /user-scalable=no|maximum-scale/);
});

test('each component slot has its own virtual module, so an override is bundled only where it renders', () => {
  const options = parseOptions({ name: 'Lib', tagline: 't', url: 'https://lib.dev', repo: 'https://github.com/me/lib' });
  const plugin = vitePluginProjectSite({
    options,
    paths: { components: { Landing: '/abs/MyLanding.astro' }, customCss: [] },
    version: undefined,
    search: { show: true, Search: 'S', ThemeSelect: 'T' },
  });
  const load = (/** @type {string} */ id) => String(plugin.load(/** @type {string} */ (plugin.resolveId(id))));
  assert.equal(load('virtual:astro-project-site/components/Landing'), 'export { default } from "/abs/MyLanding.astro";');
  assert.match(load('virtual:astro-project-site/components/Header'), /chrome\/SiteHeader\.astro/);
  for (const file of ['overrides/Header.astro', 'overrides/Footer.astro', 'components/layouts/BaseLayout.astro'])
    assert.doesNotMatch(src(file), /from 'virtual:astro-project-site\/components'/, file);
});

test('OPTION_NAMES lists every top-level option', async () => {
  const { OPTION_NAMES, COMPONENT_NAMES } = await import('../src/index.mjs');
  for (const name of ['name', 'tagline', 'url', 'repo', 'landing', 'components', 'starlight']) assert.ok(OPTION_NAMES.includes(name), name);
  assert.ok(Object.isFrozen(OPTION_NAMES));
  assert.deepEqual([...COMPONENT_NAMES], ['Header', 'Footer', 'Hero', 'Landing', 'GalleryCard', 'Gallery', 'BlogIndex', 'BlogPost', 'BlogCard']);
});

test('base.css element rules only apply to BaseLayout pages, at element specificity', () => {
  const css = src('styles/base.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selector] of css.matchAll(/(?:^|})\s*([^{}@]+?)\s*{/g)) {
    for (const part of selector.split(/,(?![^(]*\))/).map((p) => p.trim())) {
      if (part.startsWith('.') || part.startsWith(':root[') || /^(from|to|\d)/.test(part)) continue;
      assert.match(part, /\[data-site-page\]/, `unscoped selector in base.css: ${part}`);
    }
  }
  assert.match(src('components/layouts/BaseLayout.astro'), /<html [^>]*data-site-page/);
});

test('lang/dir come from Starlight locales; `head` reaches docs pages before starlight.head', async () => {
  const { siteLocale } = await import('../src/virtual.mjs');
  assert.deepEqual(siteLocale({}), { lang: 'en', dir: 'ltr' });
  assert.deepEqual(siteLocale({ locales: { root: { label: 'العربية', lang: 'ar', dir: 'rtl' } } }), { lang: 'ar', dir: 'rtl' });
  assert.deepEqual(siteLocale({ defaultLocale: 'fr', locales: { fr: { label: 'Français' }, en: { label: 'English' } } }), { lang: 'fr', dir: 'ltr' });
  const { starlightOptions } = await import('../src/starlight.mjs');
  const options = parseOptions({
    name: 'Lib', tagline: 't', url: 'https://lib.dev', repo: 'https://github.com/me/lib',
    head: [{ tag: 'meta', attrs: { name: 'a', content: '1' } }],
    starlight: { head: [{ tag: 'meta', attrs: { name: 'b', content: '2' } }] },
  });
  const opts = /** @type {any} */ (starlightOptions(options, { customCss: [] }, process.cwd()));
  // First the cascade-layer order (lib/layers.mjs), then the popover fallback (docs/popover-fallback.mjs), then
  // `head`, then `starlight.head`.
  assert.equal(opts.head[0].tag, 'style');
  assert.match(opts.head[0].content, /^@layer project-site\.fallback, starlight\.base, starlight\.reset, starlight\.core/);
  assert.equal(opts.head[1].tag, 'script');
  assert.deepEqual(opts.head.slice(2).map((/** @type {any} */ h) => h.attrs.name), ['a', 'b']);
  assert.match(src('components/chrome/SiteHead.astro'), /site\.head\.map/);
});

test('one glob dialect: {a,b} and [..] work in externalDocs exclude too', async () => {
  const { globToRegExp } = await import('../src/docs/mount.mjs');
  assert.ok(globToRegExp('{drafts,internal}/**').test('internal/a/b.md'));
  assert.ok(globToRegExp('notes-[0-9].md').test('notes-3.md'));
  assert.ok(!globToRegExp('*.md').test('a/b.md'));
});

test('styles use logical directions, so right-to-left pages mirror', () => {
  /** @type {string[]} */
  const offenders = [];
  const walk = (/** @type {string} */ dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(astro|css)$/.test(name)) {
        const text = readFileSync(full, 'utf8');
        // Only CSS: <style> blocks in components, whole files for .css.
        const css = name.endsWith('.css') ? text : [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
        for (const m of css.matchAll(/^\s*((?:margin|padding|border)-(?:left|right)|left|right|text-align:\s*(?:left|right)|float:\s*(?:left|right))\b[^;]*;/gm)) {
          offenders.push(`${path.relative(path.resolve(import.meta.dirname, '../src'), full)}: ${m[0].trim()}`);
        }
      }
    }
  };
  walk(path.resolve(import.meta.dirname, '../src'));
  assert.deepEqual(offenders, []);
});
