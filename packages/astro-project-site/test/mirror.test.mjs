import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { collect, compileGlob, resolveMirror, resolveRequest } from '../src/mirror.mjs';
import { fixture } from './helpers.mjs';

const root = fixture({
  'apps/hello/index.html': '<h1>hi</h1>',
  'apps/hello/app.js': '',
  'apps/hello/app.test.js': '',
  'apps/.env': 'SECRET=1',
  'apps/.git/config': '',
  'apps/node_modules/x/index.js': '',
  'apps/data/a.json': '{}',
  'secret.txt': 'outside the mirror',
  'site/package.json': '{}',
});
const site = path.join(root, 'site');
const out = path.join(site, 'dist');
const apps = resolveMirror({ from: '../apps', to: '/apps/', exclude: ['*.test.js'] }, 0, site, out);

test('resolveMirror validates entries', () => {
  assert.equal(apps.to, 'apps');
  assert.equal(apps.from, path.join(root, 'apps'));
  assert.throws(() => resolveMirror({ from: './nope', to: 'x' }, 2, site, out), /mirrors\[2\]\.from "\.\/nope" resolves to .*, which is not a folder/);
  assert.throws(() => resolveMirror({ from: '../apps', to: '../x' }, 0, site, out), /must be a URL prefix/);
  // A mirror of a folder containing the site skips the site itself.
  assert.deepEqual(resolveMirror({ from: '..', to: 'all' }, 0, site, out).skip, [site, out]);
});

test('resolveRequest serves files and folder indexes', async () => {
  assert.deepEqual(await resolveRequest([apps], '/apps/hello/app.js'), { file: path.join(root, 'apps/hello/app.js') });
  assert.deepEqual(await resolveRequest([apps], '/apps/hello/'), { file: path.join(root, 'apps/hello/index.html') });
  assert.deepEqual(await resolveRequest([apps], '/apps/hello?x=1'), { redirect: '/apps/hello/?x=1' });
  assert.deepEqual(await resolveRequest([apps], '/apps'), { redirect: '/apps/' });
  assert.equal(await resolveRequest([apps], '/other/hello/'), null);
  assert.equal(await resolveRequest([apps], '/apps/missing.js'), null);
});

test('resolveRequest refuses traversal, hidden paths, node_modules and excluded files', async () => {
  for (const url of [
    '/apps/../secret.txt',
    '/apps/%2e%2e/secret.txt',
    '/apps/hello/%2E%2E/%2E%2E/secret.txt',
    '/apps/..%2fsecret.txt',
    '/apps/..%5csecret.txt',
    '/apps/.env',
    '/apps/.git/config',
    '/apps/node_modules/x/index.js',
    '/apps/hello/app.test.js',
    '/apps/%00',
    '/apps/%E0%A4%A',
  ]) {
    assert.equal(await resolveRequest([apps], url), null, url);
  }
});

test('collect lists what a build copies', async () => {
  assert.deepEqual(await collect(apps), ['data/a.json', 'hello/app.js', 'hello/index.html']);
  const only = resolveMirror({ from: '../apps', to: 'x', include: ['hello'], exclude: ['*.html'] }, 0, site, out);
  assert.deepEqual(await collect(only), ['hello/app.js', 'hello/app.test.js']);
});

test('compileGlob: segment rules, any-depth names, folders cover their contents', () => {
  const g = (/** @type {string} */ p, /** @type {string} */ path) => compileGlob(p).test(path, path.split('/').at(-1) ?? '');
  assert.ok(g('*.js', 'a/b/c.js'));
  assert.ok(!g('src/*.js', 'src/a/b.js'));
  assert.ok(g('src/**/*.js', 'src/a/b.js'));
  assert.ok(g('src/**/*.js', 'src/b.js'));
  assert.ok(g('{a,b}.md', 'b.md'));
  assert.ok(g('docs/[A-Z]*.md', 'docs/SPEC.md'));
  assert.ok(!g('docs/[A-Z]*.md', 'docs/spec.md'));
  assert.ok(compileGlob('src/deep/*.js').couldMatchBelow('src'));
  assert.ok(!compileGlob('src/deep/*.js').couldMatchBelow('test'));
  assert.ok(compileGlob('src/**').couldMatchBelow('src/a/b'));
});
