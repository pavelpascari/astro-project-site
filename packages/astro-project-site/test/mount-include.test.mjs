// externalDocs `include`: mounting picked files (README, CHANGELOG, ...) from the repository root.
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import {
  accepts,
  buildSidebar,
  idForFile,
  listMountFiles,
  mountFor,
  mountGlobPatterns,
  resolveHref,
  resolveProject,
  rewriteLinks,
} from '../src/docs/mount.mjs';
import { parseOptions } from '../src/options.mjs';
import { fixture } from './helpers.mjs';

// A repo with the site in website/, a docs/ folder, and top-level project files.
const repo = fixture({
  '.git/HEAD': 'ref: refs/heads/main\n',
  'README.md': '# Lib\n\nSee [the changelog](CHANGELOG.md), [the guide](docs/guide.md), [docs](docs/) and [src](src/index.js).\n',
  'CHANGELOG.md': '# Changelog\n\nBack to the [readme](README.md#lib) or [contributing](./CONTRIBUTING.md#setup).\n',
  'CONTRIBUTING.md': '# Contributing\n\n## Setup\n',
  'NOTES.md': '# Not included\n',
  'docs/README.md': '# Docs\n\nUp to the [project readme](../README.md).\n',
  'docs/guide.md': '# Guide\n\nRead the [changelog](../CHANGELOG.md) and [notes](../NOTES.md).\n',
  'packages/a/README.md': '# Package A\n',
  'node_modules/dep/README.md': '# dep\n',
  '.github/README.md': '# hidden\n',
  'src/index.js': 'export {};\n',
  'website/README.md': '# The site itself\n',
  'website/node_modules/x/CHANGELOG.md': '# x\n',
  'website/src/content/docs/docs/index.md': '---\ntitle: Docs\n---\n',
});
const site = path.join(repo, 'website');
const options = {
  name: 'Lib',
  tagline: 't',
  url: 'https://lib.dev',
  repo: 'https://github.com/me/lib',
  externalDocs: [
    { dir: '..', route: 'project', label: 'Project', include: ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md'] },
    { dir: '../docs', route: 'reference', label: 'Reference' },
  ],
};
const project = resolveProject(options, site);
const [top, docs] = project.mounts;
const at = (/** @type {string} */ rel) => path.join(repo, rel);

test('include is validated as a non-empty list of globs', () => {
  assert.deepEqual(parseOptions(options).externalDocs[0].include, ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md']);
  assert.throws(() => parseOptions({ ...options, externalDocs: [{ dir: '..', route: 'p', label: 'P', include: [] }] }), /externalDocs\[0\]\.include/);
});

test('a repo-root mount lists only the included files, never the site, dot-folders or node_modules', () => {
  assert.deepEqual(listMountFiles(top).sort(), ['CHANGELOG.md', 'CONTRIBUTING.md', 'README.md']);
  assert.deepEqual(top.skip, [site]);
  // Without include, the site folder is still skipped.
  const all = resolveProject({ ...options, externalDocs: [{ dir: '..', route: 'all', label: 'All' }] }, site).mounts[0];
  assert.deepEqual(listMountFiles(all).sort(), ['CHANGELOG.md', 'CONTRIBUTING.md', 'NOTES.md', 'README.md', 'docs/README.md', 'docs/guide.md', 'packages/a/README.md']);
  assert.deepEqual(mountGlobPatterns(all), ['**/*.md', '!**/node_modules/**', '!website/**']);
});

test('include globs: whole-path names, folders cover their contents, wildcards', () => {
  const m = (/** @type {string[]} */ include) => ({ ...top, include, exclude: [] });
  assert.ok(accepts(m(['README.md']), 'README.md'));
  assert.ok(!accepts(m(['README.md']), 'packages/a/README.md'));
  assert.ok(accepts(m(['packages']), 'packages/a/README.md'));
  assert.ok(accepts(m(['*.md']), 'NOTES.md'));
  assert.ok(accepts(m(['**/README.md']), 'packages/a/README.md'));
  assert.ok(!accepts({ ...m(['*.md']), exclude: ['NOTES.md'] }, 'NOTES.md'));
  assert.deepEqual(listMountFiles(m(['packages', 'CHANGELOG.md'])).sort(), ['CHANGELOG.md', 'packages/a/README.md']);
  assert.deepEqual(listMountFiles(m(['**/README.md'])).sort(), ['README.md', 'docs/README.md', 'packages/a/README.md']);
});

test('the loader gets the exact file list for an include mount', () => {
  assert.deepEqual(mountGlobPatterns(top).sort(), ['CHANGELOG.md', 'CONTRIBUTING.md', 'README.md']);
  const odd = { ...top, dir: repo, include: ['docs'] };
  assert.deepEqual(mountGlobPatterns(odd).sort(), ['docs/README.md', 'docs/guide.md']);
});

test('README is the section index; ids follow file names', () => {
  assert.equal(idForFile(top, 'README.md'), 'docs/project');
  assert.equal(idForFile(top, 'CHANGELOG.md'), 'docs/project/changelog');
  const sidebar = buildSidebar(project);
  assert.deepEqual(sidebar[1], {
    label: 'Project',
    items: [{ slug: 'docs/project', label: 'Overview' }, { slug: 'docs/project/changelog' }, { slug: 'docs/project/contributing' }],
  });
  assert.equal(sidebar[2].label, 'Reference');
});

test('a file belongs to the deepest mount that accepts it', () => {
  assert.equal(mountFor(project, at('docs/guide.md')), docs);
  assert.equal(mountFor(project, at('README.md')), top);
  // Inside `..` but not included: no accepting mount, so the containing one is reported (links go to the repo).
  assert.equal(mountFor(project, at('NOTES.md')), top);
});

test('links between included files, into other mounts and to repo files', () => {
  const readme = at('README.md');
  assert.equal(resolveHref(project, readme, 'CHANGELOG.md'), '/docs/project/changelog/');
  assert.equal(resolveHref(project, readme, 'docs/guide.md'), '/docs/reference/guide/');
  assert.equal(resolveHref(project, readme, 'docs/'), '/docs/reference/');
  assert.equal(resolveHref(project, readme, 'src/index.js'), 'https://github.com/me/lib/blob/main/src/index.js');
  assert.equal(resolveHref(project, readme, 'NOTES.md'), 'https://github.com/me/lib/blob/main/NOTES.md');
  assert.equal(resolveHref(project, readme, 'website/README.md'), 'https://github.com/me/lib/blob/main/website/README.md');
  const changelog = at('CHANGELOG.md');
  assert.equal(resolveHref(project, changelog, 'README.md#lib'), '/docs/project/', 'anchor to the H1 dropped');
  assert.equal(resolveHref(project, changelog, './CONTRIBUTING.md#setup'), '/docs/project/contributing/#setup');
  assert.equal(resolveHref(project, at('docs/README.md'), '../README.md'), '/docs/project/');
  assert.equal(resolveHref(project, at('docs/guide.md'), '../CHANGELOG.md'), '/docs/project/changelog/');
  assert.equal(
    rewriteLinks(project, readme, '[c](CHANGELOG.md) [g](docs/guide.md)'),
    '[c](/docs/project/changelog/) [g](/docs/reference/guide/)',
  );
});
