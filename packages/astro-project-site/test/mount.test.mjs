import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import {
  absolutizeLinks,
  buildSidebar,
  describe,
  editBaseUrl,
  editUrlFor,
  findTitle,
  idForFile,
  listMountFiles,
  resolveHref,
  resolveProject,
  rewriteLinks,
} from '../src/docs/mount.mjs';
import { fixture } from './helpers.mjs';

// A git repo holding a site/ folder and a docs/ folder next to it, mounted at /docs/reference/.
const repo = fixture({
  '.git/HEAD': 'ref: refs/heads/main\n',
  'docs/README.md': '# Reference\n\nThe reference.\n',
  'docs/api.md': '# API\n\nEvery export.\n\n## Exports\n',
  'docs/guide.md': '# The Guide\n\nRead [the API](api.md#exports) and [the title](api.md#api).\n',
  'docs/sub/README.md': '# Sub section\n',
  'docs/sub/deep.md': '# Deep\n',
  'docs/plans/secret.md': '# Plan\n',
  'src/index.js': 'export const x = 1;\n',
  'site/src/content/docs/docs/index.mdx': '---\ntitle: Intro\n---\n',
  'site/src/content/docs/docs/b-page.md': '---\ntitle: B\nsidebar:\n  order: 2\n---\n',
  'site/src/content/docs/docs/a-page.md': '---\ntitle: A\nsidebar:\n  order: 1\n---\n',
  'site/src/content/docs/docs/hidden.md': '---\ntitle: H\nsidebar:\n  hidden: true\n---\n',
  'site/src/content/docs/docs/template/x.md': '---\ntitle: X\n---\n',
});
const site = path.join(repo, 'site');
const options = {
  name: 'Lib',
  tagline: 't',
  url: 'https://lib.dev/',
  repo: 'https://github.com/me/lib/',
  repoBranch: 'dev',
  externalDocs: [{ dir: '../docs', route: 'Reference', label: 'Reference', order: ['guide.md'], exclude: ['plans/**'] }],
};
const project = resolveProject(options, site);
const mount = project.mounts[0];
const file = (/** @type {string} */ rel) => path.join(repo, 'docs', rel);

test('resolveProject: mounts, repo facts', () => {
  assert.equal(project.gitRoot, repo);
  assert.equal(project.repo, 'https://github.com/me/lib');
  assert.equal(project.branch, 'dev');
  assert.equal(mount.route, 'reference');
  assert.equal(mount.routeId, 'docs/reference');
  assert.equal(mount.relDir, '../docs');
});

test('idForFile: README/index are the folder, names are slugged', () => {
  assert.equal(idForFile(mount, 'README.md'), 'docs/reference');
  assert.equal(idForFile(mount, 'sub/README.md'), 'docs/reference/sub');
  assert.equal(idForFile(mount, 'API.md'), 'docs/reference/api');
  assert.equal(idForFile(mount, 'sub/Deep Dive.md'), 'docs/reference/sub/deep-dive');
});

test('listMountFiles honours exclude', () => {
  assert.deepEqual(listMountFiles(mount).sort(), ['README.md', 'api.md', 'guide.md', 'sub/README.md', 'sub/deep.md']);
});

test('edit URLs follow the file in the repo', () => {
  assert.equal(editBaseUrl(project), 'https://github.com/me/lib/edit/dev/site/');
  assert.equal(editUrlFor(project, file('api.md')), 'https://github.com/me/lib/edit/dev/docs/api.md');
  assert.equal(editUrlFor(project, '/elsewhere/x.md'), undefined);
});

test('resolveHref: links between mounted files become site routes', () => {
  const from = file('guide.md');
  assert.equal(resolveHref(project, from, 'api.md'), '/docs/reference/api/');
  assert.equal(resolveHref(project, from, 'api.md#exports'), '/docs/reference/api/#exports');
  // An anchor to the target's H1 is dropped: that heading becomes the page title.
  assert.equal(resolveHref(project, from, 'api.md#api'), '/docs/reference/api/');
  assert.equal(resolveHref(project, from, 'sub/'), '/docs/reference/sub/');
  assert.equal(resolveHref(project, file('sub/deep.md'), '../README.md'), '/docs/reference/');
  // Missing markdown still maps to a route, so the link validator flags it.
  assert.equal(resolveHref(project, from, 'missing.md'), '/docs/reference/missing/');
});

test('resolveHref: other relative links go to the repo, absolute ones stay', () => {
  const from = file('guide.md');
  assert.equal(resolveHref(project, from, '../src/index.js'), 'https://github.com/me/lib/blob/dev/src/index.js');
  assert.equal(resolveHref(project, from, '../src/'), 'https://github.com/me/lib/tree/dev/src');
  assert.equal(resolveHref(project, from, 'plans/secret.md'), 'https://github.com/me/lib/blob/dev/docs/plans/secret.md');
  for (const href of ['https://x.dev/a.md', '/docs/', '#top', '?q=1', 'mailto:a@b.c', '']) {
    assert.equal(resolveHref(project, from, href), undefined, href);
  }
  // Outside the repo: left alone.
  assert.equal(resolveHref(project, from, '../../../../../outside.txt'), undefined);
});

test('rewriteLinks: inline, reference and html links; code is untouched', () => {
  const md = [
    'See [API](api.md) and [`greet`](api.md#exports).',
    '[ref]: guide.md "Guide"',
    '<a href="sub/deep.md">deep</a>',
    'Inline `[not](api.md)` code.',
    '![img](diagram.png)',
    '```md',
    '[inside](api.md)',
    '```',
  ].join('\n');
  const out = rewriteLinks(project, file('README.md'), md).split('\n');
  assert.equal(out[0], 'See [API](/docs/reference/api/) and [`greet`](/docs/reference/api/#exports).');
  assert.equal(out[1], '[ref]: /docs/reference/guide/ "Guide"');
  assert.equal(out[2], '<a href="/docs/reference/sub/deep/">deep</a>');
  assert.equal(out[3], 'Inline `[not](api.md)` code.');
  assert.equal(out[4], '![img](diagram.png)');
  assert.equal(out[6], '[inside](api.md)');
});

test('titles and descriptions from markdown', () => {
  assert.deepEqual(findTitle('\n# The `API` [ref](x)\n\ntext'), { title: 'The API ref', line: 1, leading: true });
  assert.equal(findTitle('```\n# not a title\n```\nno title'), undefined);
  assert.equal(describe('Intro paragraph that is long enough to be a sentence. Second one.\n\n## Heading'), 'Intro paragraph that is long enough to be a sentence.');
  assert.equal(describe('## Heading first\n\ntext'), undefined);
});

test('buildSidebar: local pages by order, mounts, then local subfolders', () => {
  const sidebar = buildSidebar(project);
  assert.deepEqual(sidebar.slice(0, 3), [{ slug: 'docs' }, { slug: 'docs/a-page' }, { slug: 'docs/b-page' }]);
  const ref = sidebar[3];
  assert.equal(ref.label, 'Reference');
  assert.deepEqual(ref.items.slice(0, 3), [
    { slug: 'docs/reference', label: 'Overview' },
    { slug: 'docs/reference/guide' },
    { slug: 'docs/reference/api' },
  ]);
  assert.equal(ref.items[3].label, 'Sub section');
  assert.deepEqual(sidebar[4], { label: 'Template', collapsed: true, items: [{ autogenerate: { directory: 'docs/template' } }] });
  assert.equal(sidebar.length, 5);
});

test('absolutizeLinks makes root-relative links absolute outside code', () => {
  const out = absolutizeLinks('[a](/docs/x/) <a href="/y">y</a> [b](//cdn.x/z)\n```\n[c](/docs/)\n```', 'https://lib.dev');
  assert.equal(out, '[a](https://lib.dev/docs/x/) <a href="https://lib.dev/y">y</a> [b](//cdn.x/z)\n```\n[c](/docs/)\n```');
});
