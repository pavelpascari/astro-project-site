import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mermaidSourceOnly } from '../src/markdown/plugins.mjs';
import { hasPackage } from '../src/markdown/index.mjs';
import { packageJson } from '../src/init/generate.mjs';
import { detectProject } from '../src/detect/index.mjs';

test('a diagram without the mermaid package keeps its source and says how to draw it', () => {
  const fig = /** @type {any} */ (mermaidSourceOnly('graph TD; A-->B'));
  assert.equal(fig.tagName, 'figure');
  assert.equal(fig.properties['data-mermaid'], undefined, 'no script picks it up');
  const text = JSON.stringify(fig);
  assert.match(text, /graph TD; A-->B/);
  assert.match(text, /npm i mermaid/);
});

test('hasPackage resolves from the project root only', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-mermaid-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  assert.equal(hasPackage('definitely-not-installed-xyz', dir), false);
  fs.mkdirSync(path.join(dir, 'node_modules/fake-pkg'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'node_modules/fake-pkg/package.json'), '{"name":"fake-pkg"}');
  assert.equal(hasPackage('fake-pkg', dir), true);
});

test('init adds mermaid only when the mounted markdown has a diagram', () => {
  const starter = JSON.stringify({ name: 'x', dependencies: { astro: '^7' } });
  assert.equal(JSON.parse(packageJson(starter, 'site', 'file:x')).dependencies.mermaid, undefined);
  assert.ok(JSON.parse(packageJson(starter, 'site', 'file:x', true)).dependencies.mermaid);

  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-repo-'));
  fs.writeFileSync(path.join(repo, 'README.md'), '# Lib\n\nA lib.\n');
  fs.mkdirSync(path.join(repo, 'docs'));
  fs.writeFileSync(path.join(repo, 'docs/arch.md'), '# Arch\n\n```mermaid\ngraph TD; A-->B\n```\n');
  const site = path.join(repo, 'website');
  assert.equal(detectProject({ root: repo, site }).usesMermaid, true);
  fs.writeFileSync(path.join(repo, 'docs/arch.md'), '# Arch\n\n```js\nx\n```\n');
  assert.equal(detectProject({ root: repo, site }).usesMermaid, false);
});
