import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Creates a temp folder with the given files (`{ 'a/b.md': 'text' }`) and returns its path. */
export function fixture(/** @type {Record<string, string>} */ files) {
  const root = mkdtempSync(path.join(tmpdir(), 'project-site-test-'));
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return root;
}

/** Copies test/fixtures/<name> into a temp folder (its `_git` becomes `.git`) and returns the copy's path. */
export function copyFixture(/** @type {string} */ name) {
  const root = path.join(mkdtempSync(path.join(tmpdir(), 'project-site-repo-')), name);
  cpSync(new URL(`./fixtures/${name}`, import.meta.url), root, { recursive: true });
  if (existsSync(path.join(root, '_git'))) renameSync(path.join(root, '_git'), path.join(root, '.git'));
  return root;
}
