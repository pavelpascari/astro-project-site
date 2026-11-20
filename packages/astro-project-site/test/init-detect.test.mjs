// Detection: what `project-site init` reads from a repository. Pure functions, fixture repos.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  detectDemos,
  detectDocs,
  detectLicense,
  detectProject,
  htmlMeta,
  identifyLicense,
  normalizeRepoUrl,
  parseCargoToml,
  parseComposerJson,
  parseGemspec,
  parseGitConfig,
  parseGoMod,
  parsePackageJson,
  parsePerson,
  parsePyproject,
  parseReadme,
  readGit,
  splitFeature,
} from '../src/detect/index.mjs';
import { copyFixture, fixture } from './helpers.mjs';

test('repository URLs are normalised to https', () => {
  for (const url of [
    'git@github.com:acme/lib.git',
    'ssh://git@github.com/acme/lib.git',
    'git+ssh://git@github.com/acme/lib.git',
    'git+https://github.com/acme/lib.git',
    'https://user@github.com/acme/lib',
    'https://github.com/acme/lib/',
    'git://github.com/acme/lib.git',
    'github:acme/lib',
    'acme/lib',
  ]) {
    assert.equal(normalizeRepoUrl(url), 'https://github.com/acme/lib', url);
  }
  assert.equal(normalizeRepoUrl('git@gitlab.com:group/sub/lib.git'), 'https://gitlab.com/group/sub/lib');
  assert.equal(normalizeRepoUrl('not a url'), undefined);
  assert.equal(normalizeRepoUrl(undefined), undefined);
});

test('git config and refs: origin, default branch, user', () => {
  const cfg = parseGitConfig('[remote "origin"]\n\turl = git@github.com:a/b.git # comment\n[user]\n  name = "Ada L"\n');
  assert.equal(cfg['remote "origin"'].url, 'git@github.com:a/b.git');
  assert.equal(cfg.user.name, 'Ada L');

  const repo = copyFixture('node-lib');
  const git = readGit(path.join(repo, 'docs'));
  assert.equal(git?.root, repo);
  assert.equal(git?.origin, 'https://github.com/acme/tiny-queue');
  assert.equal(git?.branch, 'trunk', "origin's HEAD wins over the checked-out branch");
  assert.equal(git?.userName, 'Repo User');

  // No origin HEAD: main/master when present, else the checked-out branch.
  const plain = fixture({ '.git/HEAD': 'ref: refs/heads/dev\n', '.git/config': '', '.git/refs/heads/master': 'x' });
  assert.equal(readGit(plain)?.branch, 'master');
  const onlyDev = fixture({ '.git/HEAD': 'ref: refs/heads/dev\n', '.git/config': '' });
  assert.equal(readGit(onlyDev)?.branch, 'dev');
  // A worktree: .git is a file pointing at the real git dir; config lives in the common dir.
  const main = fixture({ 'repo/.git/config': '[remote "origin"]\nurl = https://github.com/w/t.git\n', 'repo/.git/worktrees/wt/HEAD': 'ref: refs/heads/topic\n', 'repo/.git/worktrees/wt/commondir': '../..\n' });
  const wt = path.join(main, 'wt');
  mkdirSync(wt);
  writeFileSync(path.join(wt, '.git'), `gitdir: ${path.join(main, 'repo/.git/worktrees/wt')}\n`);
  assert.deepEqual(readGit(wt), { root: wt, origin: 'https://github.com/w/t', branch: 'topic', userName: undefined });
});

test('manifests: npm, cargo, python, go, composer, gem', () => {
  const npm = parsePackageJson(JSON.stringify({ name: '@a/b', version: '1.0.0', description: 'D', license: 'MIT', author: 'Ada <a@b.c> (https://ada.dev)', repository: 'github:a/b', homepage: 'https://b.dev' }));
  assert.deepEqual(npm, { ecosystem: 'npm', name: '@a/b', description: 'D', version: '1.0.0', license: 'MIT', homepage: 'https://b.dev', repository: 'https://github.com/a/b', authors: [{ name: 'Ada', url: 'https://ada.dev' }], private: false, install: 'npm i @a/b' });
  assert.equal(parsePackageJson('{"name":"x","private":true}').install, undefined, 'a private package has no install command');
  assert.deepEqual(parsePerson({ name: 'Bob', url: 'https://bob.dev' }), { name: 'Bob', url: 'https://bob.dev' });

  const cargo = parseCargoToml(`[package]\nname = "fastq"\nversion = "0.3.1"\ndescription = "Fast queues" # trailing\nlicense = "MIT OR Apache-2.0"\nrepository = "https://github.com/a/fastq"\nauthors = [\n  "Ada <a@b.c>",\n]\n\n[dependencies]\nserde = "1"\n`);
  assert.equal(cargo.name, 'fastq');
  assert.equal(cargo.description, 'Fast queues');
  assert.equal(cargo.license, 'MIT OR Apache-2.0');
  assert.equal(cargo.repository, 'https://github.com/a/fastq');
  assert.deepEqual(cargo.authors, [{ name: 'Ada', url: undefined }]);
  assert.equal(cargo.install, 'cargo add fastq');

  const py = parsePyproject(`[project]\nname = "snake-q"\nversion = "1.2"\ndescription = 'Queues for Python'\nlicense = { text = "BSD-3-Clause" }\nauthors = [{ name = "Ada", email = "a@b.c" }]\n\n[project.urls]\nHomepage = "https://snake.dev"\n"Source Code" = "https://github.com/a/snake-q"\n`);
  assert.deepEqual([py.name, py.license, py.homepage, py.repository, py.install], ['snake-q', 'BSD-3-Clause', 'https://snake.dev', 'https://github.com/a/snake-q', 'pip install snake-q']);
  assert.deepEqual(py.authors, [{ name: 'Ada', url: undefined }]);
  const poetry = parsePyproject('[tool.poetry]\nname = "po"\ndescription = "P"\nrepository = "https://github.com/a/po"\n');
  assert.deepEqual([poetry.name, poetry.repository], ['po', 'https://github.com/a/po']);

  const go = parseGoMod('module github.com/acme/goq/v2\n\ngo 1.22\n');
  assert.deepEqual([go.name, go.repository, go.install], ['goq', 'https://github.com/acme/goq', 'go get github.com/acme/goq/v2']);

  const composer = parseComposerJson(JSON.stringify({ name: 'acme/phpq', description: 'PHP queues', license: ['MIT'], authors: [{ name: 'Ada' }] }));
  assert.deepEqual([composer.name, composer.license, composer.install, composer.authors[0].name], ['phpq', 'MIT', 'composer require acme/phpq', 'Ada']);

  const gem = parseGemspec(`Gem::Specification.new do |spec|\n  spec.name = "rubyq"\n  spec.version = "0.1.0"\n  spec.summary = 'Ruby queues'\n  spec.license = "MIT"\n  spec.authors = ["Ada"]\n  spec.homepage = "https://github.com/a/rubyq"\nend\n`);
  assert.deepEqual([gem.name, gem.version, gem.description, gem.license, gem.repository, gem.install, gem.authors[0].name], ['rubyq', '0.1.0', 'Ruby queues', 'MIT', 'https://github.com/a/rubyq', 'gem install rubyq', 'Ada']);
});

test('README: title, intro without badges or images, features, steps, install', () => {
  const repo = copyFixture('node-lib');
  const r = parseReadme(readFileSync(path.join(repo, 'README.md'), 'utf8'));
  assert.equal(r.title, 'tiny-queue');
  assert.equal(r.intro, 'Run promises with a concurrency limit, in order, with backpressure. See the guide and the changelog.');
  assert.equal(r.tagline, 'Run promises with a concurrency limit, in order, with backpressure.');
  assert.equal(r.featuresHeading, 'Features');
  assert.deepEqual(r.features, [
    { title: 'Tiny', body: 'Under 1 kB, no dependencies.' },
    { title: 'Ordered', body: 'Results come back in the order tasks were added.' },
    { title: 'Backpressure', body: 'add() waits when the queue is full.' },
    { title: 'Typed', body: 'Ships its own TypeScript types.' },
    { title: 'Works everywhere. Node, Deno, Bun and browsers.', body: '' },
    { title: 'Cancellation', body: '' },
  ]);
  assert.equal(r.install, 'npm install @acme/tiny-queue');
  assert.deepEqual(r.steps, [
    { title: 'Installation', body: '', code: '$ npm install @acme/tiny-queue', lang: 'sh' },
    { title: 'Usage', body: 'Create a queue and add tasks', code: "import { Queue } from '@acme/tiny-queue';\nconst q = new Queue({ concurrency: 2 });\nawait q.add(() => fetch('/a'));", lang: 'js' },
  ]);
  assert.equal(r.stepsHeading, 'Installation');
});

test('README edge cases', () => {
  assert.deepEqual(parseReadme('Setext Title\n============\n\nJust text here, long enough.\n'), {
    title: 'Setext Title', intro: 'Just text here, long enough.', tagline: 'Just text here, long enough.',
    features: [], featuresHeading: undefined, steps: [], stepsHeading: undefined, install: undefined,
  });
  const html = parseReadme('<h1 align="center">Html Title</h1>\n\n<p align="center">An HTML paragraph &amp; tagline.</p>\n');
  assert.equal(html.title, 'Html Title');
  assert.equal(html.intro, 'An HTML paragraph & tagline.');
  // No Install/Usage heading: the section holding the first install command.
  const odd = parseReadme('# X\n\n## Five minutes to a demo\n\n```sh\nnpm i x   # tiny\n```\n\n```js\nx();\n```\n');
  assert.equal(odd.install, 'npm i x');
  assert.deepEqual(odd.steps.map((s) => s.title), ['Install', 'Use it in code']);
  assert.equal(parseReadme('```\n# not a title\n```\n').title, undefined);
  assert.deepEqual(splitFeature('🚀 **Fast.** Really fast'), { title: 'Fast', body: 'Really fast' });
  assert.deepEqual(splitFeature('Zero config – just works'), { title: 'Zero config', body: 'Just works' });
  assert.deepEqual(splitFeature('A sentence. With a colon: here'), { title: 'A sentence. With a colon: here', body: '' });
});

test('docs folder, licence, demos', () => {
  const repo = copyFixture('node-lib');
  assert.deepEqual(detectDocs(repo), { dir: 'docs', pages: ['guide.md', 'guides/advanced.md', 'README.md'], order: ['guide.md'], hasIndex: true });
  assert.equal(detectDocs(repo, [path.join(repo, 'docs')]), undefined, 'a skipped folder is not docs');
  assert.deepEqual(detectLicense(repo, 'MIT'), { file: 'LICENSE', spdx: 'Apache-2.0' }, 'the licence text wins over the manifest');
  assert.equal(identifyLicense('MIT License\n\nCopyright'), 'MIT');
  assert.equal(identifyLicense('Redistribution and use in source and binary forms ... Neither the name'), 'BSD-3-Clause');
  assert.deepEqual(detectLicense(fixture({}), 'ISC'), { file: undefined, spdx: 'ISC' });
  assert.equal(detectLicense(fixture({}), undefined), undefined);

  assert.deepEqual(htmlMeta('<title>A &lt;b&gt; &amp; c</title><meta content="Desc" name="description">'), { title: 'A <b> & c', description: 'Desc' });
  const demos = detectDemos(repo);
  assert.deepEqual(demos.dirs, [{
    dir: 'examples',
    pages: [
      { file: 'examples/basic/index.html', title: 'Basic queue & workers', description: 'Five tasks, two at a time.' },
      { file: 'examples/race.html', title: 'Race', description: undefined },
    ],
  }]);
  assert.deepEqual(demos.needs, ['docs', 'src'], 'folders the pages load from (../../src/index.js, ../../docs/guide.md)');

  // Any top-level folder with an index.html is a demo, except site/docs/build folders and the site itself.
  const other = fixture({ 'studio/index.html': '<title>Studio</title>', 'site/index.html': 'x', 'website/index.html': 'x', 'web2/index.html': 'x', 'notes/a.html': 'x' });
  assert.deepEqual(detectDemos(other, [path.join(other, 'web2')]).dirs.map((d) => d.dir), ['studio']);
});

test('detectProject: facts with their sources', () => {
  const repo = copyFixture('node-lib');
  const d = detectProject({ root: repo, site: path.join(repo, 'website'), gitUser: 'Global User' });
  assert.equal(d.toRoot, '..');
  assert.deepEqual(d.name, { value: 'tiny-queue', from: 'README.md' });
  assert.equal(d.slug, 'tiny-queue');
  assert.deepEqual(d.tagline, { value: 'A tiny promise queue with concurrency limits.', from: 'package.json' });
  assert.equal(d.lead, 'Run promises with a concurrency limit, in order, with backpressure. See the guide and the changelog.');
  assert.deepEqual(d.repo, { value: 'https://github.com/acme/tiny-queue', from: 'git origin' });
  assert.deepEqual(d.branch, { value: 'trunk', from: 'git' });
  assert.deepEqual(d.url, { value: 'https://tiny-queue.dev', from: 'package.json homepage' });
  assert.deepEqual(d.install, { value: 'npm install @acme/tiny-queue', from: 'README.md' });
  assert.equal(d.versionFrom, '../package.json');
  assert.deepEqual(d.authors, [{ key: 'ada-lovelace', name: 'Ada Lovelace', url: 'https://ada.example.com', from: 'package.json' }]);
  assert.deepEqual(d.project, { readme: 'README.md', changelog: 'CHANGELOG.md', contributing: 'CONTRIBUTING.md' });
  assert.equal(d.empty, false);
});

test('detectProject: README only, nothing, and the site at the repo root', () => {
  const readmeOnly = copyFixture('readme-only');
  const r = detectProject({ root: readmeOnly, site: path.join(readmeOnly, 'site') });
  assert.deepEqual(r.name, { value: 'Hello Notes', from: 'README.md' });
  assert.equal(r.slug, 'hello-notes');
  assert.deepEqual(r.tagline, { value: 'A plain-text note format that diffs well and reads well.', from: 'README.md' });
  assert.equal(r.repo.todo, true);
  assert.equal(r.url.todo, true);
  assert.deepEqual(r.authors, []);
  assert.equal(r.readme?.features.length, 2);
  assert.equal(r.readme?.steps[0].lang, 'text');

  const empty = fixture({});
  const e = detectProject({ root: empty, site: path.join(empty, 'my-site'), gitUser: 'Git User' });
  assert.equal(e.empty, true);
  assert.deepEqual(e.name, { value: 'My Site', from: 'folder name', todo: true });
  const generic = detectProject({ root: empty, site: path.join(empty, 'website') });
  assert.equal(generic.name.value, path.basename(empty).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), 'a generic site folder name falls back to the repo folder');
  assert.equal(e.tagline.todo, true);
  assert.deepEqual(e.authors, [{ key: 'git-user', name: 'Git User', url: undefined, from: 'git user.name' }]);

  const same = copyFixture('node-lib');
  const s = detectProject({ root: same, site: same });
  assert.equal(s.sameFolder, true);
  assert.equal(s.docs, undefined, 'nothing is mounted from the site folder itself');
  assert.equal(s.demos.dirs.length, 0);
  assert.equal(s.versionFrom, undefined);
  assert.equal(s.repo.value, 'https://github.com/acme/tiny-queue');
});
