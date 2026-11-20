import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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
