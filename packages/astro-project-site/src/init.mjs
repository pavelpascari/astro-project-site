// `project-site init [dir]`: copies the starter into `dir` and names it. Never overwrites a file without --force.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, '../package.json'), 'utf8'));

/** The starter: packed into the package as starter/ (see the `prepack` script), or the repo's starters/default. */
export function starterDir() {
  const candidates = [path.join(here, '../starter'), path.join(here, '../../../starters/default')];
  const found = candidates.find((dir) => existsSync(path.join(dir, 'astro.config.mjs')));
  if (!found) throw new Error(`The starter is missing (looked in ${candidates.join(', ')}).`);
  return found;
}

const SKIP = new Set(['node_modules', 'dist', '.astro', '.wrangler', 'package-lock.json']);
/** npm never packs a file named .gitignore, so the starter ships it as _gitignore. */
const RENAME = /** @type {Record<string, string>} */ ({ _gitignore: '.gitignore' });

/** Starter files as posix paths relative to the starter root, with their target names. */
export function starterFiles(/** @type {string} */ root) {
  /** @type {{ from: string, to: string }[]} */
  const out = [];
  const walk = (/** @type {string} */ rel) => {
    for (const name of readdirSync(path.join(root, rel)).sort()) {
      if (SKIP.has(name) || name === '.DS_Store') continue;
      const relPath = rel ? `${rel}/${name}` : name;
      if (statSync(path.join(root, relPath)).isDirectory()) walk(relPath);
      else out.push({ from: relPath, to: rel ? `${rel}/${RENAME[name] ?? name}` : (RENAME[name] ?? name) });
    }
  };
  walk('');
  return out;
}

/** `my-lib-site` from a folder name or project name. */
export const slugify = (/** @type {string} */ s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project-site';

/** "My Lib Site" from a folder name. */
export const titleFrom = (/** @type {string} */ s) =>
  s.replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()) || 'My Project';

/**
 * Text replacements that name the new project. The starter uses fixed values (it builds as is in this repo).
 * @param {{ slug: string, title: string, packageSpec: string }} names
 * @returns {Record<string, (text: string) => string>}
 */
export function namers({ slug, title, packageSpec }) {
  return {
    'package.json': (text) => {
      const json = JSON.parse(text);
      json.name = slug;
      json.dependencies = { ...json.dependencies, 'astro-project-site': packageSpec };
      return `${JSON.stringify(json, null, 2)}\n`;
    },
    'wrangler.jsonc': (text) => text.replace(/"name":\s*"[^"]*"/, `"name": "${slug}"`),
    'astro.config.mjs': (text) => text.replace(/name: '[^']*'/, () => `name: '${title.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`),
  };
}

/**
 * @param {{ dir: string, name?: string, packageSpec?: string, force?: boolean, log?: (line: string) => void }} opts
 * @returns {Promise<0 | 1>} exit code
 */
export async function init({ dir, name, packageSpec, force = false, log = console.log }) {
  const target = path.resolve(dir);
  const base = path.basename(target);
  const title = name ?? titleFrom(base);
  const slug = slugify(name ?? base);
  const source = starterDir();
  const files = starterFiles(source);

  const existing = files.filter((f) => existsSync(path.join(target, f.to)));
  if (existing.length && !force) {
    log(`project-site init: ${existing.length} file(s) already exist in ${target}:`);
    for (const f of existing.slice(0, 10)) log(`  ${f.to}`);
    if (existing.length > 10) log(`  … and ${existing.length - 10} more`);
    log('Nothing was written. Use another folder, or --force to overwrite.');
    return 1;
  }

  const rename = namers({ slug, title, packageSpec: packageSpec ?? `^${pkg.version}` });
  for (const f of files) {
    const to = path.join(target, f.to);
    await mkdir(path.dirname(to), { recursive: true });
    const fix = rename[f.to];
    if (fix) await writeFile(to, fix(readFileSync(path.join(source, f.from), 'utf8')));
    else await copyFile(path.join(source, f.from), to);
  }

  const rel = path.relative(process.cwd(), target) || '.';
  log(`Created "${title}" in ${target} (${files.length} files${existing.length ? `, ${existing.length} overwritten` : ''}).`);
  log('');
  log('Next:');
  if (rel !== '.') log(`  cd ${rel}`);
  log('  npm install');
  log('  npm run dev        # http://localhost:4321');
  log('');
  log('Then edit astro.config.mjs (name, url, repo, docs, mirrors) and the name in wrangler.jsonc.');
  return 0;
}
