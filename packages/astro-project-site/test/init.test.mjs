import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { init, slugify, starterDir, starterFiles, titleFrom } from '../src/init.mjs';
import { fixture } from './helpers.mjs';

const quiet = () => {};

test('starter file list: renames _gitignore, skips build output', () => {
  const files = starterFiles(starterDir()).map((f) => f.to);
  assert.ok(files.includes('.gitignore'));
  assert.ok(files.includes('astro.config.mjs'));
  assert.ok(files.includes('.github/workflows/site.yml'));
  assert.ok(!files.some((f) => /(^|\/)(node_modules|dist|\.astro)\//.test(f)));
});

test('names', () => {
  assert.equal(slugify('My Lib: Site!'), 'my-lib-site');
  assert.equal(slugify('---'), 'project-site');
  assert.equal(titleFrom('my-lib_site'), 'My Lib Site');
});

test('init copies the starter and names it', async () => {
  const dir = path.join(fixture({}), 'pixel-docs');
  assert.equal(await init({ dir, log: quiet, packageSpec: 'file:/x' }), 0);
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'pixel-docs');
  assert.equal(pkg.dependencies['astro-project-site'], 'file:/x');
  assert.match(readFileSync(path.join(dir, 'wrangler.jsonc'), 'utf8'), /"name": "pixel-docs"/);
  assert.match(readFileSync(path.join(dir, 'astro.config.mjs'), 'utf8'), /name: 'Pixel Docs',/);
  assert.ok(existsSync(path.join(dir, '.gitignore')));
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const workflow = readFileSync(path.join(dir, '.github/workflows/site.yml'), 'utf8');
  assert.match(workflow, new RegExp(`/deploy\\.yml@v${version.replace(/\./g, '\\.')},`));
  assert.ok(!workflow.includes('inherit'));
  assert.ok(existsSync(path.join(dir, 'src/content/gallery/hello.png')));
});

test('init never overwrites without --force', async () => {
  const dir = fixture({ 'astro.config.mjs': 'mine' });
  /** @type {string[]} */
  const lines = [];
  assert.equal(await init({ dir, name: "Bob's Lib", log: (l) => lines.push(l) }), 1);
  assert.equal(readFileSync(path.join(dir, 'astro.config.mjs'), 'utf8'), 'mine');
  assert.ok(!existsSync(path.join(dir, 'package.json')), 'nothing written');
  assert.match(lines.join('\n'), /1 file\(s\) already exist[\s\S]*astro\.config\.mjs[\s\S]*--force/);

  assert.equal(await init({ dir, name: "Bob's Lib", force: true, log: quiet }), 0);
  assert.match(readFileSync(path.join(dir, 'astro.config.mjs'), 'utf8'), /name: 'Bob\\'s Lib',/);
  assert.equal(JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).name, 'bob-s-lib');
});

test('the default dependency spec is this version', async () => {
  const dir = fixture({});
  writeFileSync(path.join(dir, 'unrelated.txt'), 'kept');
  assert.equal(await init({ dir, log: quiet }), 0);
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  assert.equal(JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).dependencies['astro-project-site'], `^${version}`);
  assert.equal(readFileSync(path.join(dir, 'unrelated.txt'), 'utf8'), 'kept');
});
