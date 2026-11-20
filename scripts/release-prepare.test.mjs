import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changelogFor, compareVersions, movePins, setDependencyRange, SEMVER } from './release-prepare.mjs';

test('versions: semver precedence, pre-releases before releases', () => {
  assert.equal(compareVersions('0.1.0-beta.1', '0.1.0-beta.0'), 1);
  assert.equal(compareVersions('0.1.0-beta.10', '0.1.0-beta.9'), 1);
  assert.equal(compareVersions('0.1.0', '0.1.0-beta.9'), 1);
  assert.equal(compareVersions('0.1.0-beta.0', '0.1.0'), -1);
  assert.equal(compareVersions('0.2.0-alpha.0', '0.1.9'), 1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.ok(!SEMVER.test('1.0'));
  assert.ok(!SEMVER.test('01.0.0'));
  assert.ok(SEMVER.test('0.1.0-beta.1'));
});

test('pins move to the new tag, whatever they were', () => {
  const text = 'uses: o/r/.github/workflows/deploy.yml@v0.1.0-beta.0\n# deploy.yml@v0.1.0, ok';
  assert.equal(movePins(text, '0.1.0-beta.1'), 'uses: o/r/.github/workflows/deploy.yml@v0.1.0-beta.1\n# deploy.yml@v0.1.0-beta.1, ok');
});

test('changelog: Unreleased notes become the version section; empty Unreleased fails', () => {
  const log = '# Changelog\n\n## Unreleased\n\n- Fixed a thing.\n\n## 0.1.0-beta.0 - 2026-11-20\n\nFirst.\n';
  const out = changelogFor(log, '0.1.0-beta.1', '2026-11-21');
  assert.equal(out.created, true);
  assert.equal(out.text, '# Changelog\n\n## Unreleased\n\n## 0.1.0-beta.1 - 2026-11-21\n\n- Fixed a thing.\n\n## 0.1.0-beta.0 - 2026-11-20\n\nFirst.\n');
  assert.throws(() => changelogFor(out.text, '0.1.0-beta.2', '2026-11-22'), /is empty/);
  assert.equal(changelogFor(out.text, '0.1.0-beta.1', '2026-11-22').created, false, 'an existing section is kept');
});

test('dependency ranges follow the version; file: links are left alone', () => {
  const pkg = JSON.stringify({ dependencies: { 'astro-project-site': '^0.1.0-beta.0', astro: '^7' } });
  assert.equal(JSON.parse(setDependencyRange(pkg, '0.1.0-beta.1')).dependencies['astro-project-site'], '^0.1.0-beta.1');
  const linked = JSON.stringify({ dependencies: { 'astro-project-site': 'file:../x.tgz' } });
  assert.equal(setDependencyRange(linked, '0.1.0-beta.1'), linked);
});
