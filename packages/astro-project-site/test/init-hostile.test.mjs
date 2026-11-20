// A repository whose files try to inject code into what `project-site init` generates: line terminators
// (\n, \r, U+2028, U+2029) to end a `//` comment, `*/`, backticks and `${}` for template literals, quotes.
// The generated config must evaluate to the same strings without running anything; YAML must read back the same.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { detectManifest } from '../src/detect/manifest.mjs';
import { init } from '../src/init.mjs';
import { comment, str } from '../src/init/js.mjs';
import { yaml } from '../src/init/generate.mjs';
import { fixture } from './helpers.mjs';

const LS = '\u2028';
const PS = '\u2029';
const g = /** @type {any} */ (globalThis);

const evilName = `evil\n\`\${globalThis.PWNED='name'}\`*/${LS}'"pkg`;
const evilDescription = `Desc */ globalThis.PWNED='desc' //\n\`\${globalThis.PWNED='desc2'}\`${PS} 'q' "dq"\r end`;
const evilInstall = "npm i evil`${globalThis.PWNED='install'}`";

function hostileRepo() {
  return fixture({
    '.git/HEAD': 'ref: refs/heads/main\n',
    '.git/config': `[remote "origin"]\n\turl = git@github.com:a/b.git\${globalThis.PWNED}\n[user]\n\tname = Eve${LS}globalThis.PWNED='user'\n`,
    'package.json': JSON.stringify({
      name: evilName,
      description: evilDescription,
      version: "1.0.0\nglobalThis.PWNED='version'",
      license: "MIT\n*/ globalThis.PWNED='licence'",
      homepage: "https://x.dev/\nglobalThis.PWNED='home'",
      author: { name: `Eve${LS}globalThis.PWNED='author'`, url: "javascript:globalThis.PWNED='url'" },
      repository: "git@github.com:a/b.git\nglobalThis.PWNED='repo'",
    }),
    'README.md': [
      `# Evil${LS}\`\${globalThis.PWNED='title'}\`*/ 'x'`,
      '',
      `Intro with */ and \`\${x}\` and ${LS} globalThis.PWNED='intro' and more words here.`,
      '',
      '## Features',
      '',
      `- **A${PS}\`b\`** — c */ d \${globalThis.PWNED='feature'}`,
      '',
      '## Install',
      '',
      '```sh',
      evilInstall,
      '```',
      '',
    ].join('\n'),
    'CHANGELOG.md': '# Changelog\n',
    [`examples/a'b${LS}c.html`]: `<title>T */ ${LS}globalThis.PWNED='gallery' "q" \`x\`</title>`,
  });
}

async function evaluateConfig(/** @type {string} */ site) {
  const text = readFileSync(path.join(site, 'astro.config.mjs'), 'utf8')
    .replace("import { defineConfig } from 'astro/config';", 'const defineConfig = (c) => c;')
    .replace("import projectSite from 'astro-project-site';", 'const projectSite = (o) => o;');
  const file = path.join(site, 'config-under-test.mjs');
  writeFileSync(file, text);
  return (await import(pathToFileURL(file).href)).default.integrations[0];
}

/** A top-level YAML scalar as written by the generator: plain, or a double-quoted (JSON) string. */
function yamlValue(/** @type {string} */ text, /** @type {string} */ key) {
  const raw = new RegExp(`^${key}: (.*)$`, 'm').exec(text)?.[1];
  return raw?.startsWith('"') ? JSON.parse(raw) : raw;
}

test('comments, string literals and YAML scalars cannot be broken out of', () => {
  assert.equal(comment(`a\nb\r\nc${LS}d${PS}e */ f`), 'a b c d e * / f');
  for (const s of [evilName, evilDescription, 'a\\`${b}`\r\n', `x${LS}y${PS}z`, "it's \"q\""]) {
    // Round trip: the literal str() writes evaluates back to the same string (inputs are this test's constants).
    assert.equal(new Function(`return ${str(s)};`)(), s, JSON.stringify(s));
    const y = yaml(s);
    assert.ok(!/[\n\r\u2028\u2029\u0085]/.test(y), `one physical line: ${JSON.stringify(y)}`);
    assert.equal(y.startsWith('"') ? JSON.parse(y) : y, s);
  }
  assert.equal(yaml('Plain words'), 'Plain words');
  for (const s of ['true', 'no', '1.5', '- a', 'a: b', '#x', '[x]', '{x}', '*x', '&x', '!x', '|', '>', '%x', '@x', '`x`', 'a, b']) {
    assert.ok(yaml(s).startsWith('"'), `${s} is quoted`);
  }
});

test('manifest file names: only plain *.gemspec names are read', () => {
  const dir = fixture({ 'evil name.gemspec': 'spec.name = "x"\n', 'ok.gemspec': 'spec.name = "ok"\n' });
  assert.equal(detectManifest(dir).manifest?.file, 'ok.gemspec');
  assert.equal(detectManifest(fixture({ 'a;b.gemspec': 'spec.name = "x"\n' })).manifest, undefined);
});

test('a hostile repository: the generated files evaluate to its text, and nothing runs', async () => {
  const repo = hostileRepo();
  const site = path.join(repo, 'website');
  delete g.PWNED;
  /** @type {string[]} */
  const lines = [];
  assert.equal(await init({ dir: site, cwd: repo, yes: true, today: '2026-11-20', gitUser: '', log: (l) => lines.push(l) }), 0);
  for (const line of lines) assert.ok(!/[\r\u2028\u2029]/.test(line), `terminal line: ${JSON.stringify(line)}`);

  const options = await evaluateConfig(site);
  assert.equal(g.PWNED, undefined, 'nothing in the generated config ran');

  // Text is kept (on one line), never executed.
  // The README title, as plain text (inline code and emphasis markers dropped).
  assert.equal(options.name, "Evil ${globalThis.PWNED='title'}/ 'x'");
  assert.equal(options.tagline, `Desc */ globalThis.PWNED='desc' // \`\${globalThis.PWNED='desc2'}\` 'q' "dq" end`);
  assert.equal(options.install, evilInstall);
  assert.equal(options.landing.steps.items[0].code, evilInstall);
  assert.deepEqual(options.landing.features.items, [{ title: 'A b', body: "C / d ${globalThis.PWNED='feature'}" }]);
  assert.equal(options.landing.hero.lead, `Intro with / and \${x} and globalThis.PWNED='intro' and more words here.`);
  // Values that cannot be trusted are dropped: version, licence, homepage, repository URL, author URL.
  assert.equal(options.versionFrom, undefined);
  assert.equal(options.footer, undefined);
  assert.equal(options.url, 'https://evil-globalthis-pwned-name-pkg.example.workers.dev');
  assert.equal(options.repo, 'https://github.com/OWNER/evil-globalthis-pwned-name-pkg');
  assert.deepEqual(options.blog, { authors: { 'eve-globalthis-pwned-author': { name: "Eve globalThis.PWNED='author'" } } });

  // Frontmatter and gallery YAML read back to the same strings.
  const post = readFileSync(path.join(site, 'src/content/blog/2026-11-20-introducing-evil-globalthis-pwned-name-pkg.md'), 'utf8');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(post)?.[1] ?? '';
  assert.equal(yamlValue(fm, 'title'), `Introducing ${options.name}`);
  assert.equal(yamlValue(fm, 'description'), options.tagline);
  assert.equal(fm.split('\n').length, 6, 'frontmatter keeps its six lines');
  const docsIndex = readFileSync(path.join(site, 'src/content/docs/docs/index.md'), 'utf8');
  assert.equal(yamlValue(docsIndex, 'title'), `${options.name} documentation`);
  const entries = readdirSync(path.join(site, 'src/content/gallery'));
  assert.equal(entries.length, 1);
  assert.match(entries[0], /^[\w-]+\.yaml$/);
  const entry = readFileSync(path.join(site, 'src/content/gallery', entries[0]), 'utf8');
  assert.equal(yamlValue(entry, 'title'), `T */ globalThis.PWNED='gallery' "q" \`x\``);
  assert.equal(yamlValue(entry, 'href'), `/apps/examples/a'b${LS}c.html`);
  assert.equal(entry.split('\n').length, 9, 'no extra YAML lines (2 comments, 6 fields, final newline)');

  // Names that reach config files outside JS: a safe Worker name and package name.
  assert.match(readFileSync(path.join(site, 'wrangler.jsonc'), 'utf8'), /"name": "evil-globalthis-pwned-name-pkg"/);
  assert.equal(JSON.parse(readFileSync(path.join(site, 'package.json'), 'utf8')).name, 'evil-globalthis-pwned-name-pkg-site');
  assert.equal(g.PWNED, undefined);
});
