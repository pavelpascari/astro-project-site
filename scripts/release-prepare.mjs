#!/usr/bin/env node
// Prepares a release by hand, without committing anything:
//
//   npm run release:prepare -- 0.1.0-beta.1 [--date 2026-11-21] [--dry-run]
//
// 1. sets `version` in packages/astro-project-site/package.json
// 2. sets the `astro-project-site` range in the workspace members that depend on it (site/, starters/*)
// 3. moves every `deploy.yml@v…` pin in tracked files to the new tag (the upgrading guide's before/after example
//    is left alone)
// 4. turns the CHANGELOG's `## Unreleased` notes into `## <version> - <date>` (or keeps an existing section for
//    that version); fails if there is nothing to release
// 5. refreshes package-lock.json
//
// Then: review `git diff`, commit (signed), `git tag -s v<version>`, push the commit and the tag. The tag runs
// .github/workflows/release.yml, which tests, packs, creates the GitHub release and publishes to npm.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE = 'astro-project-site';
const PACKAGE_DIR = 'packages/astro-project-site';
const CHANGELOG = `${PACKAGE_DIR}/CHANGELOG.md`;
/** Files whose `deploy.yml@v…` mentions are examples (of an upgrade, or test inputs), not pins to move. */
const PIN_EXAMPLES = new Set(['site/src/content/docs/docs/guides/upgrading.mdx', 'scripts/release-prepare.test.mjs']);

/** Semantic version, optionally with a pre-release (`1.2.3`, `0.1.0-beta.1`); no build metadata. */
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/** -1, 0 or 1, comparing two versions by semver precedence (pre-releases sort before their release). */
export function compareVersions(/** @type {string} */ a, /** @type {string} */ b) {
  const pa = /** @type {RegExpExecArray} */ (SEMVER.exec(a));
  const pb = /** @type {RegExpExecArray} */ (SEMVER.exec(b));
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d) return Math.sign(d);
  }
  if (!pa[4] || !pb[4]) return pa[4] === pb[4] ? 0 : pa[4] ? -1 : 1;
  const xa = pa[4].split('.');
  const xb = pb[4].split('.');
  for (let i = 0; i < Math.max(xa.length, xb.length); i++) {
    if (xa[i] === undefined) return -1;
    if (xb[i] === undefined) return 1;
    const na = /^\d+$/.test(xa[i]);
    const nb = /^\d+$/.test(xb[i]);
    if (na && nb && Number(xa[i]) !== Number(xb[i])) return Math.sign(Number(xa[i]) - Number(xb[i]));
    if (na !== nb) return na ? -1 : 1;
    if (xa[i] !== xb[i]) return xa[i] < xb[i] ? -1 : 1;
  }
  return 0;
}

/** Moves every `deploy.yml@v<anything>` pin in `text` to `version`. */
export function movePins(/** @type {string} */ text, /** @type {string} */ version) {
  return text.replace(/(\bdeploy\.yml)@v[0-9A-Za-z.-]+/g, `$1@v${version}`);
}

/**
 * The CHANGELOG with a section for `version`: the `## Unreleased` notes move under `## <version> - <date>`, and an
 * empty `## Unreleased` stays on top. An existing `## <version>` section is kept as it is.
 */
export function changelogFor(/** @type {string} */ text, /** @type {string} */ version, /** @type {string} */ date) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^## \\[?${escaped}\\]?(\\s|$)`, 'm').test(text)) return { text, created: false };
  const m = /^## \[?Unreleased\]?[^\n]*\n([\s\S]*?)(?=^## )/m.exec(text);
  if (!m) throw new Error(`${CHANGELOG} has no "## Unreleased" section and no "## ${version}" section.`);
  const notes = m[1].trim();
  if (!notes) {
    throw new Error(`${CHANGELOG}: "## Unreleased" is empty. Write what changed in ${version} there first.`);
  }
  const replacement = `## Unreleased\n\n## ${version} - ${date}\n\n${notes}\n\n`;
  return { text: text.slice(0, m.index) + replacement + text.slice(m.index + m[0].length), created: true };
}

/** Sets the `astro-project-site` dependency range to `^version` wherever a package.json declares one. */
export function setDependencyRange(/** @type {string} */ text, /** @type {string} */ version) {
  const json = JSON.parse(text);
  let changed = false;
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (json[field]?.[PACKAGE] && !String(json[field][PACKAGE]).startsWith('file:')) {
      json[field][PACKAGE] = `^${version}`;
      changed = true;
    }
  }
  return changed ? `${JSON.stringify(json, null, 2)}\n` : text;
}

function main(/** @type {string[]} */ argv) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = argv.filter((a) => !a.startsWith('--'));
  const flag = (/** @type {string} */ name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const dryRun = argv.includes('--dry-run');
  const version = (args[0] ?? '').replace(/^v/, '');
  const date = flag('date') ?? new Date().toISOString().slice(0, 10);
  if (!SEMVER.test(version)) throw new Error(`usage: npm run release:prepare -- <version> [--date YYYY-MM-DD] [--dry-run] (got "${args[0] ?? ''}")`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`--date must be YYYY-MM-DD (got "${date}")`);

  const git = (/** @type {string[]} */ ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
  const pkgPath = path.join(root, PACKAGE_DIR, 'package.json');
  const current = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  if (compareVersions(version, current) <= 0) throw new Error(`${version} is not newer than the current ${current}.`);
  if (git('tag', '--list', `v${version}`)) throw new Error(`Tag v${version} already exists.`);

  /** @type {Map<string, string>} */
  const writes = new Map();
  const read = (/** @type {string} */ rel) => writes.get(rel) ?? fs.readFileSync(path.join(root, rel), 'utf8');
  const stage = (/** @type {string} */ rel, /** @type {string} */ text) => {
    if (text !== read(rel)) writes.set(rel, text);
  };

  const pkgText = read(`${PACKAGE_DIR}/package.json`);
  stage(`${PACKAGE_DIR}/package.json`, pkgText.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`));

  const tracked = git('ls-files').split('\n');
  for (const rel of tracked.filter((f) => /^(site|starters\/[^/]+)\/package\.json$/.test(f))) {
    stage(rel, setDependencyRange(read(rel), version));
  }
  for (const rel of tracked) {
    if (PIN_EXAMPLES.has(rel) || rel.startsWith('node_modules/') || !/\.(ya?ml|md|mdx|mjs|ts)$/.test(rel)) continue;
    const text = read(rel);
    if (text.includes('deploy.yml@v')) stage(rel, movePins(text, version));
  }
  const log = changelogFor(read(CHANGELOG), version, date);
  stage(CHANGELOG, log.text);

  console.log(`${current} → ${version}${dryRun ? ' (dry run: nothing written)' : ''}\n`);
  for (const rel of writes.keys()) console.log(`  ${rel}`);
  console.log(log.created ? `\n  CHANGELOG: "## Unreleased" notes moved under "## ${version} - ${date}"` : `\n  CHANGELOG: kept the existing "## ${version}" section`);
  if (dryRun) return;

  for (const [rel, text] of writes) fs.writeFileSync(path.join(root, rel), text);
  // The npm that runs this script (`npm run release:prepare`), not whichever `npm` is first on PATH.
  const npm = process.env.npm_execpath ? [process.execPath, process.env.npm_execpath] : ['npm'];
  execFileSync(npm[0], [...npm.slice(1), 'install', '--package-lock-only', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
  console.log(`
Next:
  git diff                                   # review
  git commit -S -am "Release ${version}"
  git tag -s v${version} -m "astro-project-site ${version}"
  git push && git push origin v${version}    # the tag runs .github/workflows/release.yml`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`release:prepare: ${/** @type {Error} */ (error).message}`);
    process.exit(1);
  }
}
