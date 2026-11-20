import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { listMountFiles, resolveProject } from '../src/docs/mount.mjs';
import { init, resolveSource, slugify, starterDir, starterFiles, titleFrom } from '../src/init.mjs';
import { lit, note } from '../src/init/js.mjs';
import { parseOptions } from '../src/options.mjs';
import { copyFixture, fixture } from './helpers.mjs';

const quiet = () => {};
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const TODAY = '2026-11-20';
const run = (/** @type {import('../src/init.mjs').InitOptions} */ o) => init({ log: quiet, yes: true, today: TODAY, gitUser: 'Git User', ...o });

/**
 * The options object a generated astro.config.mjs passes to projectSite(), by running the file with
 * `astro/config` and `astro-project-site` swapped for stubs that capture it.
 */
async function configOptions(/** @type {string} */ site) {
  const text = readFileSync(path.join(site, 'astro.config.mjs'), 'utf8')
    .replace("import { defineConfig } from 'astro/config';", 'const defineConfig = (c) => c;')
    .replace("import projectSite from 'astro-project-site';", 'const projectSite = (o) => o;');
  const file = path.join(site, `config-under-test-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(file, text);
  const config = (await import(pathToFileURL(file).href)).default;
  return config.integrations[0];
}

/** Checks options against the schema; `blog` is not part of it on this branch, so it is checked separately. */
function validate(/** @type {any} */ options) {
  const { blog, ...rest } = options;
  assert.ok(blog === true || (typeof blog === 'object' && Object.values(blog.authors ?? {}).every((/** @type {any} */ a) => typeof a.name === 'string')), 'blog option shape');
  return parseOptions(rest);
}

/** Frontmatter of a blog post as key → raw value. */
function frontmatter(/** @type {string} */ text) {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
  return Object.fromEntries(fm.split('\n').map((l) => /^(\w+):\s*(.*)$/.exec(l)).filter((m) => m !== null).map((m) => [m[1], m[2]]));
}

test('starter file list: renames _gitignore, skips build output', () => {
  const files = starterFiles(starterDir()).map((f) => f.to);
  assert.ok(files.includes('.gitignore'));
  assert.ok(files.includes('astro.config.mjs'));
  assert.ok(files.includes('.github/workflows/site.yml'));
  assert.ok(!files.some((f) => /(^|\/)(node_modules|dist|\.astro)\//.test(f)));
});

test('names', () => {
  assert.equal(slugify('My Lib: Site!'), 'my-lib-site');
  assert.equal(slugify('@scope/my-lib'), 'my-lib');
  assert.equal(slugify('---'), 'project-site');
  assert.equal(titleFrom('my-lib_site'), 'My Lib Site');
});

test('config literals: quotes, template literals, comments, commented-out properties', () => {
  assert.equal(lit({ a: "it's", 'b-c': [1, true] }), "{ a: 'it\\'s', 'b-c': [1, true] }");
  assert.equal(lit('a`b${c}\nd'), '`a\\`b\\${c}\nd`');
  assert.equal(
    lit({ x: note('v', { comment: 'why' }), y: note('/og.png', { off: true, comment: 'maybe' }), z: note(undefined, { comment: 'hint' }) }),
    "{\n  // why\n  x: 'v',\n  // maybe\n  // y: '/og.png',\n  // hint\n}",
  );
});

test('--blank copies the plain starter and names it', async () => {
  const dir = path.join(fixture({}), 'pixel-docs');
  assert.equal(await init({ dir, log: quiet, packageSpec: 'file:/x', blank: true, yes: true }), 0);
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'pixel-docs');
  assert.equal(pkg.dependencies['astro-project-site'], 'file:/x');
  assert.match(readFileSync(path.join(dir, 'wrangler.jsonc'), 'utf8'), /"name": "pixel-docs"/);
  assert.match(readFileSync(path.join(dir, 'astro.config.mjs'), 'utf8'), /name: 'Pixel Docs',/);
  assert.ok(existsSync(path.join(dir, '.gitignore')));
  const workflow = readFileSync(path.join(dir, '.github/workflows/site.yml'), 'utf8');
  assert.match(workflow, new RegExp(`/deploy\\.yml@v${version.replace(/\./g, '\\.')},`));
  assert.ok(!workflow.includes('inherit'));
  assert.ok(existsSync(path.join(dir, 'src/content/gallery/hello.png')));
  assert.ok(!existsSync(path.join(dir, 'src/content/blog')));
});

test('a repository: config, docs mounts, gallery, blog post, CI, all from its files', async () => {
  const repo = copyFixture('node-lib');
  const site = path.join(repo, 'website');
  /** @type {string[]} */
  const lines = [];
  assert.equal(await run({ dir: 'website', cwd: repo, packageSpec: 'file:/pkg.tgz', log: (l) => lines.push(l) }), 0);
  const out = lines.join('\n');
  assert.match(out, /Found:\n {2}name +tiny-queue {2}\(README\.md\)/);
  assert.match(out, /docs +docs\/ \(3 pages\) → \/docs\/reference\//);
  assert.match(out, /project +README\.md, CHANGELOG\.md, CONTRIBUTING\.md → \/docs\/project\//);
  assert.match(out, /demos +examples\/ \(2\) → \/apps\/, 2 gallery entries/);
  assert.match(out, /Will write 15 files to website\//);
  assert.match(out, /Next:\n {2}cd website\n {2}npm install\n {2}npm run dev/);
  assert.match(out, /move website\/\.github\/workflows\/site\.yml to \.github\/workflows\//);

  const text = readFileSync(path.join(site, 'astro.config.mjs'), 'utf8');
  assert.match(text, /\/\/ Generated by `project-site init` from package\.json, README\.md, docs\/, git origin\./);
  assert.ok(!text.includes('TODO'), 'nothing is a placeholder here');
  const options = await configOptions(site);
  const parsed = validate(options);
  assert.equal(parsed.name, 'tiny-queue');
  assert.equal(parsed.tagline, 'A tiny promise queue with concurrency limits.');
  assert.equal(parsed.url, 'https://tiny-queue.dev');
  assert.equal(parsed.repo, 'https://github.com/acme/tiny-queue');
  assert.equal(parsed.repoBranch, 'trunk');
  assert.equal(parsed.versionFrom, '../package.json');
  assert.equal(parsed.install, 'npm install @acme/tiny-queue');
  assert.deepEqual(parsed.nav.map((n) => n.href), ['/docs/', '/blog/', '/gallery/']);
  assert.deepEqual(parsed.externalDocs, [
    { dir: '../docs', route: 'reference', label: 'Reference', order: ['guide.md'] },
    { dir: '..', route: 'project', label: 'Project', include: ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md'] },
  ]);
  assert.deepEqual(parsed.mirrors, [{ from: '..', to: 'apps', include: ['examples', 'docs', 'src'] }]);
  assert.deepEqual(parsed.footer, { note: 'Released under the Apache-2.0 licence.' });
  assert.deepEqual(options.blog, { authors: { 'ada-lovelace': { name: 'Ada Lovelace', url: 'https://ada.example.com' } } });
  const landing = /** @type {any} */ (parsed.landing);
  assert.equal(landing.hero.lead, 'Run promises with a concurrency limit, in order, with backpressure. See the guide and the changelog.');
  assert.deepEqual(landing.hero.primary, { label: 'Get started', href: '/docs/reference/guide/' });
  assert.equal(landing.features.title, 'Features');
  assert.equal(landing.features.items.length, 6);
  assert.deepEqual(landing.steps.items.map((/** @type {any} */ s) => [s.title, s.lang]), [['Installation', 'sh'], ['Usage', 'js']]);

  // The mounts resolve to the repo's files (and never the site itself).
  const project = resolveProject(parsed, site);
  assert.deepEqual(project.mounts.map((m) => listMountFiles(m).sort()), [
    ['README.md', 'guide.md', 'guides/advanced.md'],
    ['CHANGELOG.md', 'CONTRIBUTING.md', 'README.md'],
  ]);

  const docsIndex = readFileSync(path.join(site, 'src/content/docs/docs/index.md'), 'utf8');
  assert.match(docsIndex, /^---\ntitle: tiny-queue documentation\n/);
  assert.match(docsIndex, /- \[Reference\]\(\/docs\/reference\/\): the docs\/ folder of the repository \(3 pages\)\./);
  assert.match(docsIndex, /- \[Project\]\(\/docs\/project\/\): README\.md, CHANGELOG\.md, CONTRIBUTING\.md from the repository root\./);

  const gallery = readdirSync(path.join(site, 'src/content/gallery')).sort();
  assert.deepEqual(gallery, ['examples-basic-index.yaml', 'examples-race.yaml']);
  const basic = readFileSync(path.join(site, 'src/content/gallery/examples-basic-index.yaml'), 'utf8');
  assert.match(basic, /^title: Basic queue & workers$/m);
  assert.match(basic, /^description: Five tasks, two at a time\.$/m);
  assert.match(basic, /^href: \/apps\/examples\/basic\/$/m);
  assert.match(readFileSync(path.join(site, 'src/content/gallery/examples-race.yaml'), 'utf8'), /^href: \/apps\/examples\/race\.html$/m);

  const postFile = path.join(site, 'src/content/blog/2026-11-20-introducing-tiny-queue.md');
  const post = readFileSync(postFile, 'utf8');
  assert.deepEqual(frontmatter(post), {
    title: 'Introducing tiny-queue',
    description: 'A tiny promise queue with concurrency limits.',
    date: '2026-11-20',
    authors: '[ada-lovelace]',
    tags: '[announcement]',
    draft: 'true',
  });
  for (const heading of ['## What it is', '## Why', '## Getting started', "## What's next"]) assert.ok(post.includes(`\n${heading}\n`), heading);
  assert.match(post, /- \*\*Tiny\*\* — Under 1 kB, no dependencies\./);
  assert.match(post, /```sh\n\$ npm install @acme\/tiny-queue\n```/);
  assert.match(post, /\[changelog\]\(\/docs\/project\/changelog\/\)/);

  const pkg = JSON.parse(readFileSync(path.join(site, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'tiny-queue-site');
  assert.equal(pkg.dependencies['astro-project-site'], 'file:/pkg.tgz');
  assert.ok(pkg.scripts.dev && pkg.scripts.build);
  assert.match(readFileSync(path.join(site, 'wrangler.jsonc'), 'utf8'), /"name": "tiny-queue"/);
  const workflow = readFileSync(path.join(site, '.github/workflows/site.yml'), 'utf8');
  assert.match(workflow, new RegExp(`deploy\\.yml@v${version.replace(/\./g, '\\.')}, with: \\{ working-directory: website \\}, permissions`));
  assert.match(workflow, /secrets: \{ CLOUDFLARE_API_TOKEN: .*CLOUDFLARE_ACCOUNT_ID/);
  assert.match(readFileSync(path.join(site, 'docs-gen.config.mjs'), 'utf8'), /files: \['\.\.\/docs'\]/);
  assert.ok(existsSync(path.join(site, '.gitignore')));
  assert.ok(!existsSync(path.join(site, 'example')), 'no stand-in docs when the repo has its own');
  assert.ok(!existsSync(path.join(site, 'public/og.png')), 'the starter\'s "Example Project" image is not copied');
  // Nothing outside the site folder changed.
  assert.deepEqual(readdirSync(repo).sort(), ['.git', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE', 'README.md', 'docs', 'examples', 'package.json', 'src', 'website']);
});

test('README only: placeholders marked TODO, no gallery, a project mount', async () => {
  const repo = copyFixture('readme-only');
  const site = path.join(repo, 'website');
  assert.equal(await run({ dir: site, cwd: repo, gitUser: '' }), 0);
  const text = readFileSync(path.join(site, 'astro.config.mjs'), 'utf8');
  assert.match(text, /\/\/ TODO: the production URL/);
  assert.match(text, /\/\/ TODO: the source repository/);
  const parsed = validate(await configOptions(site));
  assert.equal(parsed.name, 'Hello Notes');
  assert.equal(parsed.gallery, false);
  assert.deepEqual(parsed.nav.map((n) => n.label), ['Docs', 'Blog']);
  assert.deepEqual(parsed.mirrors, []);
  assert.deepEqual(parsed.externalDocs, [{ dir: '..', route: 'project', label: 'Project', include: ['README.md'] }]);
  assert.equal(/** @type {any} */ (parsed.landing).features.title, 'Why');
  assert.equal((await configOptions(site)).blog, true, 'no author found: blog: true');
  const post = readFileSync(path.join(site, 'src/content/blog/2026-11-20-introducing-hello-notes.md'), 'utf8');
  assert.ok(!/^authors:/m.test(post));
  assert.match(post, /- \*\*Plain text\*\* — Any editor works\./);
  assert.deepEqual(readdirSync(path.join(site, 'src/content/gallery')), ['.gitkeep'], 'an empty folder, so the gallery loader does not warn');
});

test('an empty folder: placeholders and the example docs and apps', async () => {
  const dir = path.join(fixture({}), 'my-site');
  /** @type {string[]} */
  const lines = [];
  assert.equal(await run({ dir, cwd: path.dirname(dir), log: (l) => lines.push(l) }), 0);
  assert.match(lines.join('\n'), /Found nothing to build from/);
  const parsed = validate(await configOptions(dir));
  assert.deepEqual(parsed.externalDocs.map((d) => d.dir), ['./example/docs']);
  assert.deepEqual(parsed.mirrors, [{ from: './example/apps', to: 'apps' }]);
  assert.equal(parsed.ogImage, '/og.png');
  for (const f of ['example/docs/README.md', 'example/apps/hello/index.html', 'src/content/gallery/hello.yaml', 'src/content/docs/docs/index.mdx', 'public/og.png']) {
    assert.ok(existsSync(path.join(dir, f)), f);
  }
  const post = readdirSync(path.join(dir, 'src/content/blog'));
  assert.equal(post.length, 1);
  assert.match(readFileSync(path.join(dir, 'src/content/blog', post[0]), 'utf8'), /^authors: \[git-user\]$/m);
});

test('the default dependency spec is this version; other files are left alone', async () => {
  const dir = fixture({ 'unrelated.txt': 'kept' });
  assert.equal(await run({ dir, cwd: dir }), 0);
  assert.equal(JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).dependencies['astro-project-site'], `^${version}`);
  assert.equal(readFileSync(path.join(dir, 'unrelated.txt'), 'utf8'), 'kept');
});

test('never overwrites without --force', async () => {
  const repo = copyFixture('readme-only');
  const site = path.join(repo, 'website');
  mkdirSync(site);
  writeFileSync(path.join(site, 'astro.config.mjs'), 'mine');
  /** @type {string[]} */
  const lines = [];
  assert.equal(await run({ dir: site, cwd: repo, log: (l) => lines.push(l) }), 1);
  assert.equal(readFileSync(path.join(site, 'astro.config.mjs'), 'utf8'), 'mine');
  assert.deepEqual(readdirSync(site), ['astro.config.mjs'], 'nothing written');
  assert.match(lines.join('\n'), /astro\.config\.mjs {2}\(exists\)[\s\S]*1 file\(s\) already exist[\s\S]*--force/);

  assert.equal(await run({ dir: site, cwd: repo, force: true }), 0);
  assert.match(readFileSync(path.join(site, 'astro.config.mjs'), 'utf8'), /name: 'Hello Notes'/);

  // --blank too.
  const blank = fixture({ 'astro.config.mjs': 'mine' });
  assert.equal(await init({ dir: blank, name: "Bob's Lib", blank: true, yes: true, log: quiet }), 1);
  assert.equal(await init({ dir: blank, name: "Bob's Lib", blank: true, yes: true, force: true, log: quiet }), 0);
  assert.match(readFileSync(path.join(blank, 'astro.config.mjs'), 'utf8'), /name: 'Bob\\'s Lib',/);
});

test('--dry-run writes nothing; without a terminal --yes is required; the prompt can decline', async () => {
  const repo = copyFixture('readme-only');
  const site = path.join(repo, 'website');
  /** @type {string[]} */
  const lines = [];
  assert.equal(await init({ dir: site, cwd: repo, dryRun: true, log: (l) => lines.push(l) }), 0);
  assert.match(lines.join('\n'), /Will write \d+ files[\s\S]*Dry run: nothing was written\./);
  assert.ok(!existsSync(site));

  lines.length = 0;
  assert.equal(await init({ dir: site, cwd: repo, isTTY: false, log: (l) => lines.push(l) }), 1);
  assert.match(lines.join('\n'), /pass --yes to write the files, or --dry-run/);
  assert.ok(!existsSync(site));

  /** @type {string[]} */
  const asked = [];
  assert.equal(await init({ dir: site, cwd: repo, isTTY: true, confirm: async (q) => (asked.push(q), false), log: quiet }), 1);
  assert.match(asked[0], /^Write these \d+ files\? \[Y\/n\] $/);
  assert.ok(!existsSync(site));
  assert.equal(await init({ dir: site, cwd: repo, isTTY: true, confirm: async () => true, log: quiet, today: TODAY }), 0);
  assert.ok(existsSync(path.join(site, 'astro.config.mjs')));
});

test('which folder is read: --from, the parent inside a git repo, the repo root itself, else cwd', async () => {
  const repo = copyFixture('node-lib');
  assert.equal(resolveSource(path.join(repo, 'website'), undefined, '/elsewhere'), repo);
  assert.equal(resolveSource(path.join(repo, 'sites/web'), undefined, '/elsewhere'), path.join(repo, 'sites'));
  assert.equal(resolveSource(repo, undefined, '/elsewhere'), repo);
  assert.equal(resolveSource('/no/repo/site', 'lib', '/work'), '/work/lib');
  const plain = fixture({});
  assert.equal(resolveSource(path.join(plain, 'site'), undefined, plain), plain);

  // --from: a site anywhere, built from a repo elsewhere.
  const out = path.join(fixture({}), 'docs-site');
  assert.equal(await run({ dir: out, from: repo }), 0);
  const parsed = validate(await configOptions(out));
  assert.equal(parsed.name, 'tiny-queue');
  assert.equal(parsed.externalDocs[0].dir, path.relative(out, path.join(repo, 'docs')).split(path.sep).join('/'));

  /** @type {string[]} */
  const lines = [];
  assert.equal(await init({ dir: out, from: path.join(repo, 'nope'), log: (l) => lines.push(l) }), 1);
  assert.match(lines.join('\n'), /--from .*nope.* is not a folder/);
  assert.equal(await init({ dir: repo, from: path.join(repo, 'docs'), log: (l) => lines.push(l) }), 1);
  assert.match(lines.join('\n'), /must not be inside the site folder/);
});

test('init at the repository root reads names only and mounts nothing', async () => {
  const repo = copyFixture('node-lib');
  /** @type {string[]} */
  const lines = [];
  // Conflicts with README.md and package.json at the root: refused without --force.
  assert.equal(await run({ dir: repo, log: (l) => lines.push(l) }), 1);
  assert.match(lines.join('\n'), /The site folder is the repository root/);
  assert.match(lines.join('\n'), /package\.json {2}\(exists\)/);
});
