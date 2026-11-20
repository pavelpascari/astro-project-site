import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { parseOptions, ProjectSiteOptionsError, resolveModulePath, resolveOptionPaths } from '../src/options.mjs';
import { fixture } from './helpers.mjs';

const base = { name: 'Lib', tagline: 'Does a thing.', url: 'https://lib.dev/', repo: 'https://github.com/me/lib' };

/** The problems a call reports, or [] when it passes. */
function problems(/** @type {unknown} */ input) {
  try {
    parseOptions(input);
    return [];
  } catch (error) {
    assert.ok(error instanceof ProjectSiteOptionsError, String(error));
    return error.problems;
  }
}

test('minimal options get defaults', () => {
  const o = parseOptions(base);
  assert.equal(o.url, 'https://lib.dev');
  assert.equal(o.repoBranch, 'main');
  assert.deepEqual(o.nav, [{ label: 'Docs', href: '/docs/' }, { label: 'Gallery', href: '/gallery/' }]);
  assert.deepEqual(o.externalDocs, []);
  assert.deepEqual(o.mirrors, []);
  assert.equal(o.favicon, '/favicon.svg');
  assert.equal(o.llms, true);
  assert.deepEqual(o.landing, {});
});

test('gallery: false drops the Gallery nav default', () => {
  assert.deepEqual(parseOptions({ ...base, gallery: false }).nav, [{ label: 'Docs', href: '/docs/' }]);
});

test('non-object input is rejected with a hint', () => {
  assert.match(problems(undefined)[0], /expects an options object/);
  assert.match(problems([])[0], /expects an options object/);
});

test('missing required fields are each named', () => {
  const p = problems({ name: 'Lib' });
  assert.ok(p.some((m) => m.startsWith('tagline:')), p.join('\n'));
  assert.ok(p.some((m) => m.startsWith('url:')));
  assert.ok(p.some((m) => m.startsWith('repo:')));
});

test('unknown options are named, at any depth', () => {
  assert.deepEqual(problems({ ...base, navv: [] }), ['unknown option "navv"']);
  assert.deepEqual(problems({ ...base, landing: { hero: { titel: 'x' } } }), ['landing.hero: unknown option "titel"']);
  assert.deepEqual(problems({ ...base, components: { Navbar: './x.astro' } }), ['components: unknown option "Navbar"']);
});

test('nested type errors name the path', () => {
  const p = problems({ ...base, landing: { hero: { primary: { label: 'Go' } } } });
  assert.equal(p.length, 1);
  assert.match(p[0], /^landing\.hero\.primary\.href: /);
  assert.match(problems({ ...base, url: 'not a url' })[0], /^url: /);
});

test('mirror prefixes must stay inside the site', () => {
  for (const to of ['', '/', '..', 'a/../b', '.hidden', 'a//b']) {
    const p = problems({ ...base, mirrors: [{ from: './x', to }] });
    assert.match(p[0] ?? '', /^mirrors\[0\]\.to: /, `to=${JSON.stringify(to)}`);
  }
  assert.deepEqual(problems({ ...base, mirrors: [{ from: './x', to: '/pixel/src/' }] }), []);
});

test('landing: false and the section shorthand', () => {
  assert.equal(parseOptions({ ...base, landing: false }).landing, false);
  const o = parseOptions({ ...base, landing: { features: [{ title: 'A', body: 'b' }], steps: { title: 'Steps', items: [] } } });
  assert.ok(o.landing);
  assert.deepEqual(o.landing.features, { title: 'Why it exists', intro: 'The short version, for people deciding whether to read on.', items: [{ title: 'A', body: 'b' }] });
  assert.deepEqual(o.landing.steps, { title: 'Steps', items: [] });
});

test('a bad union member reports the closest branch, not "invalid input"', () => {
  const p = problems({ ...base, landing: { features: { items: [{ title: 'A' }] } } });
  assert.equal(p.length, 1);
  assert.match(p[0], /^landing\.features\.items\[0\]\.body: /);
});

test('starlight options pass through untouched', () => {
  const starlight = { sidebar: [{ label: 'Extra', link: '/x/' }], pagefind: false };
  assert.deepEqual(parseOptions({ ...base, starlight }).starlight, starlight);
});

test('resolveModulePath: relative and absolute paths resolve, specifiers stay', () => {
  assert.equal(resolveModulePath('./src/A.astro', '/proj'), path.resolve('/proj/src/A.astro'));
  assert.equal(resolveModulePath('../shared/A.astro', '/proj'), path.resolve('/shared/A.astro'));
  assert.equal(resolveModulePath('/abs/A.astro', '/proj'), '/abs/A.astro');
  assert.equal(resolveModulePath('some-pkg/A.astro', '/proj'), 'some-pkg/A.astro');
});

test('resolveOptionPaths: resolves against the root and names missing files', () => {
  const root = fixture({ 'src/Header.astro': '', 'src/site.css': '', 'package.json': '{}' });
  const ok = resolveOptionPaths(
    parseOptions({ ...base, components: { Header: './src/Header.astro' }, customCss: ['./src/site.css'], versionFrom: './package.json' }),
    root,
  );
  assert.equal(ok.components.Header, path.join(root, 'src/Header.astro'));
  assert.deepEqual(ok.customCss, [path.join(root, 'src/site.css')]);
  assert.equal(ok.versionFrom, path.join(root, 'package.json'));

  assert.throws(
    () => resolveOptionPaths(parseOptions({ ...base, components: { Footer: './src/Nope.astro' }, externalDocs: [{ dir: './docs', route: 'r', label: 'R' }] }), root),
    (error) => {
      assert.ok(error instanceof ProjectSiteOptionsError);
      assert.match(error.problems[0], /^components\.Footer: "\.\/src\/Nope\.astro" resolves to .*Nope\.astro, which does not exist/);
      assert.match(error.problems[1], /^externalDocs\[0\]\.dir: /);
      return true;
    },
  );
});
