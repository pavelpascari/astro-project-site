// prepack: copies the repo's starters/default into the package as starter/, so `project-site init` works from
// the published package. postpack (--clean) removes the copy again.
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = path.resolve(fileURLToPath(import.meta.url), '../..');
const target = path.join(pkgDir, 'starter');
rmSync(target, { recursive: true, force: true });
if (!process.argv.includes('--clean')) {
  const source = path.resolve(pkgDir, '../../starters/default');
  if (!existsSync(source)) throw new Error(`starter not found at ${source}`);
  const skip = new Set(['node_modules', 'dist', '.astro', '.wrangler', 'package-lock.json']);
  cpSync(source, target, { recursive: true, filter: (src) => !skip.has(path.basename(src)) });
}
