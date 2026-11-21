// externalDocs `git` sources, against local repositories (file://), so no network is needed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { cacheName, fetchGitDocs, gitEnvFor, GitDocsError, webUrl } from '../src/docs/git-source.mjs';
import { editUrlFor, listMountFiles, resolveHref, resolveProject } from '../src/docs/mount.mjs';
import { parseOptions } from '../src/options.mjs';
import { fixture } from './helpers.mjs';

// Git without the user's config (signing, hooks, default branch).
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const git = (/** @type {string} */ cwd, /** @type {string[]} */ args) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();

/** A repository with docs/, src/ and a README, tagged v1 (annotated) on main; returns its path and file:// URL. */
function remote() {
  const dir = fixture({
    'README.md': '# Lib\n',
    'docs/README.md': '# Lib docs\n\nSee [the guide](guide.md), [the source](../src/x.js), [src](../src/) and [up](../../elsewhere.md).\n',
    'docs/guide.md': '# Guide\n',
    'docs/plans/p.md': '# Plan\n',
    'src/x.js': 'export {};\n',
  });
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'one']);
  git(dir, ['tag', '-a', 'v1', '-m', 'v1']);
  return { dir, url: pathToFileURL(dir).href };
}

const base = { name: 'Site', tagline: 't', url: 'https://site.dev', repo: 'https://github.com/me/site' };
const quiet = () => {
  /** @type {string[]} */
  const warnings = [];
  return { warnings, logger: { info() {}, warn: (/** @type {string} */ m) => warnings.push(m) } };
};
function setup(/** @type {object} */ gitSpec, extra = {}) {
  const root = fixture({ 'package.json': '{}' });
  const options = parseOptions({ ...base, externalDocs: [{ git: gitSpec, route: 'lib', label: 'Lib', ...extra }] });
  return { root, options, cacheDir: path.join(root, 'node_modules/.astro') };
}

test('git options: give dir or git, and the git values are limited to what git should see', () => {
  assert.throws(() => parseOptions({ ...base, externalDocs: [{ route: 'x', label: 'X' }] }), /either `dir`.*or `git`/);
  assert.throws(
    () => parseOptions({ ...base, externalDocs: [{ dir: 'd', git: { repo: 'https://h/r', ref: 'v1' }, route: 'x', label: 'X' }] }),
    /not both/,
  );
  const bad = (/** @type {object} */ g) => () => parseOptions({ ...base, externalDocs: [{ git: g, route: 'x', label: 'X' }] });
  assert.throws(bad({ repo: '--upload-pack=x', ref: 'v1' }), /externalDocs\[0\]\.git\.repo: must be a git URL/);
  assert.throws(bad({ repo: 'https://h/r', ref: '--force' }), /git\.ref/);
  assert.throws(bad({ repo: 'https://h/r', ref: 'a..b' }), /git\.ref/);
  assert.throws(bad({ repo: 'https://h/r', ref: 'v1', path: '../up' }), /git\.path: must be a folder inside/);
  assert.throws(bad({ repo: 'https://h/r', ref: 'v1', path: '/abs' }), /git\.path/);
  // Printed in logs and errors: no credentials in the URL.
  assert.throws(bad({ repo: 'https://x-access-token:ghp_secret@github.com/o/r', ref: 'v1' }), /git\.repo: must not contain credentials/);
  assert.throws(bad({ repo: 'http://user@host/r', ref: 'v1' }), /must not contain credentials/);
  const ok = parseOptions({ ...base, externalDocs: [{ git: { repo: 'git@github.com:o/r.git', ref: 'release/1.0', path: './docs/' }, route: 'x', label: 'X' }] });
  assert.equal(ok.externalDocs[0].git?.path, 'docs');
  assert.equal(parseOptions({ ...base, externalDocs: [{ git: { repo: 'https://h/r', ref: 'v1' }, route: 'x', label: 'X' }] }).externalDocs[0].git?.path, '');
});

test('webUrl: browser URLs from https, ssh and scp-style clone URLs; none for file://', () => {
  assert.equal(webUrl('https://github.com/o/r.git'), 'https://github.com/o/r');
  assert.equal(webUrl('https://user:secret@gitlab.com/g/s/r/'), 'https://gitlab.com/g/s/r');
  assert.equal(webUrl('git@github.com:o/r.git'), 'https://github.com/o/r');
  assert.equal(webUrl('ssh://git@codeberg.org:22/o/r.git'), 'https://codeberg.org/o/r');
  assert.equal(webUrl('file:///tmp/r'), undefined);
});

test('a tag: only the folder (and root files) is downloaded, then mounted; later builds reuse it offline', () => {
  const src = remote();
  const { root, options, cacheDir } = setup({ repo: src.url, ref: 'v1', path: 'docs' }, { exclude: ['plans/**'] });
  const { warnings, logger } = quiet();
  fetchGitDocs(options, root, { cacheDir, logger });
  const entry = /** @type {any} */ (options.externalDocs[0]);
  const checkout = path.join(cacheDir, 'project-site-git', cacheName({ repo: src.url, ref: 'v1', path: 'docs' }));
  assert.equal(entry.dir, path.relative(root, path.join(checkout, 'docs')));
  assert.equal(entry.source.ref, 'v1');
  assert.equal(entry.source.editBranch, 'main');
  assert.match(entry.source.commit, /^[0-9a-f]{40}$/);
  assert.ok(existsSync(path.join(checkout, 'docs/guide.md')));
  assert.ok(!existsSync(path.join(checkout, 'src')), 'folders outside `path` are not downloaded');
  assert.deepEqual(warnings, []);

  const project = resolveProject(options, root);
  assert.deepEqual(listMountFiles(project.mounts[0]).sort(), ['README.md', 'guide.md']);

  // The remote is gone: a tag is not fetched again.
  renameSync(src.dir, src.dir + '-gone');
  const again = parseOptions({ ...base, externalDocs: [{ git: { repo: src.url, ref: 'v1', path: 'docs' }, route: 'lib', label: 'Lib' }] });
  fetchGitDocs(again, root, { cacheDir, logger });
  assert.equal(/** @type {any} */ (again.externalDocs[0]).dir, entry.dir);
  assert.deepEqual(warnings, []);
});

test('links from downloaded docs go to their repository; edit links to its default branch', () => {
  const root = fixture({ 'node_modules/.astro/g/docs/README.md': '# Docs\n', 'node_modules/.astro/g/docs/guide.md': '# Guide\n' });
  const options = parseOptions({ ...base, externalDocs: [{ git: { repo: 'https://github.com/org/lib', ref: 'v1', path: 'docs' }, route: 'lib', label: 'Lib' }] });
  Object.assign(options.externalDocs[0], {
    dir: 'node_modules/.astro/g/docs',
    source: { root: 'node_modules/.astro/g', web: 'https://github.com/org/lib', ref: 'v1', editBranch: 'main' },
  });
  const project = resolveProject(options, root);
  const readme = path.join(root, 'node_modules/.astro/g/docs/README.md');
  assert.equal(resolveHref(project, readme, 'guide.md'), '/docs/lib/guide/');
  assert.equal(resolveHref(project, readme, '../src/x.js#L2'), 'https://github.com/org/lib/blob/v1/src/x.js#L2');
  assert.equal(resolveHref(project, readme, '../src/'), 'https://github.com/org/lib/tree/v1/src');
  assert.equal(resolveHref(project, readme, '..'), 'https://github.com/org/lib/tree/v1');
  // Outside the other repository: left as written, never a link into this site's node_modules.
  assert.equal(resolveHref(project, readme, '../../elsewhere.md'), undefined);
  assert.equal(editUrlFor(project, readme), 'https://github.com/org/lib/edit/main/docs/README.md');

  // A file:// source has no web page: links stay as written and there is no edit link.
  /** @type {any} */ (options.externalDocs[0]).source = { root: 'node_modules/.astro/g', ref: 'v1' };
  const local = resolveProject(options, root);
  assert.equal(resolveHref(local, readme, '../src/x.js'), undefined);
  assert.equal(editUrlFor(local, readme), undefined);
});

test('a branch is fetched on every build (with a warning), and the cached copy is used when that fails', () => {
  const src = remote();
  const { root, options, cacheDir } = setup({ repo: src.url, ref: 'main', path: 'docs' });
  const { warnings, logger } = quiet();
  fetchGitDocs(options, root, { cacheDir, logger });
  assert.match(warnings[0], /"main" is a branch/);
  const first = /** @type {any} */ (options.externalDocs[0]).source.commit;

  writeFileSync(path.join(src.dir, 'docs/new.md'), '# New\n');
  git(src.dir, ['add', '.']);
  git(src.dir, ['commit', '-qm', 'two']);
  const second = parseOptions({ ...base, externalDocs: [{ git: { repo: src.url, ref: 'main', path: 'docs' }, route: 'lib', label: 'Lib' }] });
  fetchGitDocs(second, root, { cacheDir, logger });
  const entry = /** @type {any} */ (second.externalDocs[0]);
  assert.notEqual(entry.source.commit, first);
  assert.ok(existsSync(path.join(root, entry.dir, 'new.md')));

  renameSync(src.dir, src.dir + '-gone');
  const offline = quiet();
  const third = parseOptions({ ...base, externalDocs: [{ git: { repo: src.url, ref: 'main', path: 'docs' }, route: 'lib', label: 'Lib' }] });
  fetchGitDocs(third, root, { cacheDir, logger: offline.logger });
  assert.equal(/** @type {any} */ (third.externalDocs[0]).source.commit, entry.source.commit);
  assert.match(offline.warnings[0], /could not fetch .*using the copy from/);
});

test('a full commit SHA works; a short one, an unknown ref or a missing folder fails naming the entry', () => {
  const src = remote();
  const sha = git(src.dir, ['rev-parse', 'HEAD']);
  const ok = setup({ repo: src.url, ref: sha, path: 'docs' });
  fetchGitDocs(ok.options, ok.root, { cacheDir: ok.cacheDir, logger: quiet().logger });
  assert.equal(/** @type {any} */ (ok.options.externalDocs[0]).source.commit, sha);

  const fails = (/** @type {object} */ spec, /** @type {RegExp} */ message) => {
    const s = setup(spec);
    assert.throws(() => fetchGitDocs(s.options, s.root, { cacheDir: s.cacheDir, logger: quiet().logger }), (error) => {
      assert.ok(error instanceof GitDocsError);
      assert.match(error.message, /^externalDocs\[0\]\.git \(/);
      assert.match(error.message, message);
      return true;
    });
    assert.ok(!existsSync(path.join(s.cacheDir, 'project-site-git', cacheName(/** @type {any} */ ({ path: '', ...spec })))));
  };
  fails({ repo: src.url, ref: sha.slice(0, 8), path: 'docs' }, /full 40-character SHA/);
  fails({ repo: src.url, ref: 'v9', path: 'docs' }, /no tag or branch "v9"/);
  fails({ repo: src.url, ref: 'v1', path: 'manual' }, /no folder "manual"/);
  fails({ repo: pathToFileURL(src.dir + '-missing').href, ref: 'v1' }, /\S/);
});

test('GITHUB_TOKEN goes to github.com through the environment, never on the command line or in a config file', () => {
  const env = gitEnvFor('https://github.com/org/private', { GITHUB_TOKEN: 'ghp_secret', GIT_CONFIG_COUNT: '1' });
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(env.GIT_CONFIG_COUNT, '2');
  assert.equal(env.GIT_CONFIG_KEY_1, 'http.https://github.com/.extraheader');
  assert.equal(env.GIT_CONFIG_VALUE_1, `AUTHORIZATION: basic ${Buffer.from('x-access-token:ghp_secret').toString('base64')}`);
  // Other hosts never get it.
  for (const repo of ['https://gitlab.com/o/r', 'https://github.com.evil.dev/o/r', 'git@github.com:o/r.git'])
    assert.equal(gitEnvFor(repo, { GITHUB_TOKEN: 'ghp_secret' }).GIT_CONFIG_COUNT, undefined, repo);

  // And a real fetch with a token set leaves nothing of it in the checkout.
  const src = remote();
  const { root, options, cacheDir } = setup({ repo: src.url, ref: 'v1', path: 'docs' });
  fetchGitDocs(options, root, { cacheDir, logger: quiet().logger, env: { ...GIT_ENV, GITHUB_TOKEN: 'ghp_secret' } });
  const checkout = path.join(cacheDir, 'project-site-git', cacheName({ repo: src.url, ref: 'v1', path: 'docs' }));
  assert.doesNotMatch(readFileSync(path.join(checkout, '.git/config'), 'utf8'), /ghp_secret|extraheader/i);
});

test('a symlink in the other repository is checked out as a plain file, never followed', () => {
  const secret = fixture({ 'id_key': 'PRIVATE KEY\n' });
  const src = remote();
  symlinkSync(path.join(secret, 'id_key'), path.join(src.dir, 'docs/leak.md'));
  symlinkSync('/', path.join(src.dir, 'docs/root'));
  git(src.dir, ['add', '.']);
  git(src.dir, ['commit', '-qm', 'links']);
  git(src.dir, ['tag', '-a', 'v2', '-m', 'v2']);
  const { root, options, cacheDir } = setup({ repo: src.url, ref: 'v2', path: 'docs' });
  fetchGitDocs(options, root, { cacheDir, logger: quiet().logger });
  const dir = path.join(root, /** @type {any} */ (options.externalDocs[0]).dir);
  assert.ok(!lstatSync(path.join(dir, 'leak.md')).isSymbolicLink());
  assert.equal(readFileSync(path.join(dir, 'leak.md'), 'utf8'), path.join(secret, 'id_key'));
  assert.ok(lstatSync(path.join(dir, 'root')).isFile());
  assert.ok(!listMountFiles(resolveProject(options, root).mounts[0]).some((f) => f.startsWith('root/')));
});
