// `project-site init [dir]`: reads the repository the site is for and writes a ready site into `dir`: a landing
// page from the README, the repo's markdown mounted as docs, demo pages in the gallery, a blog with a drafted
// first post. `--blank` copies the plain starter instead. Never writes outside `dir`, never overwrites without
// --force, asks before writing (--yes skips; --dry-run only prints).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { detectProject, findGitRoot, readGlobalGitUser, slugify, titleFrom } from './detect/index.mjs';
import { APPS_ROUTE, planFiles } from './init/generate.mjs';

export { slugify, titleFrom };

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

/**
 * Text replacements that name the plain starter (--blank). The starter uses fixed values (it builds as is in this repo).
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
    // The CI workflow calls this release's reusable workflow.
    '.github/workflows/site.yml': (text) => text.replace(/(astro-project-site\/\.github\/workflows\/deploy\.yml)@[\w.-]+/, `$1@v${pkg.version}`),
    'astro.config.mjs': (text) => text.replace(/name: '[^']*'/, () => `name: '${title.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`),
  };
}

/**
 * The repository to read: --from, else the target's parent when the target is inside a git repo (the target
 * itself when it is the repo root), else the current folder.
 */
export function resolveSource(/** @type {string} */ target, /** @type {string | undefined} */ from, /** @type {string} */ cwd) {
  if (from) return path.resolve(cwd, from);
  let probe = target;
  while (!existsSync(probe) && path.dirname(probe) !== probe) probe = path.dirname(probe);
  const gitRoot = findGitRoot(probe);
  if (gitRoot) return path.resolve(target) === gitRoot ? gitRoot : path.dirname(target);
  return cwd;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * @typedef {{
 *   dir?: string, from?: string, name?: string, packageSpec?: string, force?: boolean, yes?: boolean,
 *   dryRun?: boolean, blank?: boolean, cwd?: string, today?: string, gitUser?: string,
 *   log?: (line: string) => void, isTTY?: boolean, confirm?: (question: string) => Promise<boolean>,
 * }} InitOptions
 */

/** @param {InitOptions} opts @returns {Promise<0 | 1>} exit code */
export async function init(opts) {
  const { dir = '.', force = false, log = console.log, cwd = process.cwd() } = opts;
  const target = path.resolve(cwd, dir);
  const fail = (/** @type {string} */ msg) => {
    log(`project-site init: ${msg}`);
    return /** @type {1} */ (1);
  };
  if (existsSync(target) && !statSync(target).isDirectory()) return fail(`${target} is a file, not a folder.`);
  const packageSpec = opts.packageSpec ?? `^${pkg.version}`;
  const rel = path.relative(cwd, target) || '.';

  /** @type {{ to: string, content?: string, from?: string }[]} */
  let files;
  /** @type {string[]} */
  let found = [];
  /** @type {string[]} */
  let then = [];
  let title;
  if (opts.blank) {
    const source = starterDir();
    title = opts.name ?? titleFrom(path.basename(target));
    const rename = namers({ slug: slugify(opts.name ?? path.basename(target)), title, packageSpec });
    files = starterFiles(source).map((f) => {
      const fix = rename[f.to];
      return fix ? { to: f.to, content: fix(readFileSync(path.join(source, f.from), 'utf8')) } : { to: f.to, from: path.join(source, f.from) };
    });
    then = ['Then edit astro.config.mjs (name, url, repo, docs, mirrors) and the name in wrangler.jsonc.'];
  } else {
    const root = resolveSource(target, opts.from, cwd);
    if (!existsSync(root) || !statSync(root).isDirectory()) return fail(`--from ${opts.from}: ${root} is not a folder.`);
    if (root !== target && !path.relative(target, root).startsWith('..')) return fail(`the repository (${root}) must not be inside the site folder (${target}).`);
    const gitUser = opts.gitUser ?? readGlobalGitUser(path.join(os.homedir(), '.gitconfig'));
    const d = detectProject({ root, site: target, name: opts.name, gitUser });
    const plan = planFiles(d, { packageSpec, version: pkg.version, today: opts.today ?? today(), starter: starterDir() });
    files = plan.files;
    title = d.name.value;
    found = foundLines(d, plan.model, root, cwd);
    then = nextSteps(d, plan.model, files);
  }

  // Never outside the target folder.
  for (const f of files) {
    const abs = path.resolve(target, f.to);
    if (path.relative(target, abs).startsWith('..') || path.isAbsolute(path.relative(target, abs))) return fail(`refusing to write ${f.to}: outside ${target}.`);
  }

  if (found.length) for (const line of found) log(line);
  const existing = files.filter((f) => existsSync(path.join(target, f.to)));
  log(`Will write ${files.length} files to ${rel === '.' ? 'this folder' : `${rel}/`}${existing.length && force ? ` (${existing.length} overwritten: --force)` : ''}:`);
  for (const line of fileTree(files.map((f) => f.to), existing.map((f) => f.to))) log(`  ${line}`);
  log('');

  if (existing.length && !force) {
    log(`project-site init: ${existing.length} file(s) already exist in ${target}:`);
    for (const f of existing.slice(0, 10)) log(`  ${f.to}`);
    if (existing.length > 10) log(`  … and ${existing.length - 10} more`);
    log('Nothing was written. Use another folder, or --force to overwrite.');
    return 1;
  }
  if (opts.dryRun) {
    log('Dry run: nothing was written.');
    return 0;
  }
  if (!opts.yes) {
    const tty = opts.isTTY ?? (process.stdin.isTTY && process.stdout.isTTY);
    if (!tty) return fail('not a terminal, so there is no one to confirm: pass --yes to write the files, or --dry-run to only list them.');
    const ok = await (opts.confirm ?? ask)(`Write these ${files.length} files? [Y/n] `);
    if (!ok) {
      log('Nothing was written.');
      return 1;
    }
  }

  for (const f of files) {
    const to = path.join(target, f.to);
    await mkdir(path.dirname(to), { recursive: true });
    if (f.content !== undefined) await writeFile(to, f.content);
    else await copyFile(/** @type {string} */ (f.from), to);
  }

  log(`Created "${title}" in ${target} (${files.length} files${existing.length ? `, ${existing.length} overwritten` : ''}).`);
  log('');
  log('Next:');
  if (rel !== '.') log(`  cd ${rel}`);
  log('  npm install');
  log('  npm run dev        # http://localhost:4321');
  if (then.length) {
    log('');
    log('Then:');
    for (const line of then) log(`  - ${line}`);
  }
  return 0;
}

async function ask(/** @type {string} */ question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === '' || answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

/**
 * The "Found" summary: one line per fact, with its source; placeholders marked TODO.
 * @param {import('./detect/index.mjs').Detected} d @param {ReturnType<typeof planFiles>['model']} m
 */
function foundLines(d, m, /** @type {string} */ root, /** @type {string} */ cwd) {
  const rows = /** @type {[string, string][]} */ ([]);
  const fact = (/** @type {string} */ label, /** @type {{ value: string, from?: string, todo?: boolean } | undefined} */ f, /** @type {string} */ extra = '') => {
    if (f) rows.push([label, f.todo ? `TODO (placeholder: ${f.value})` : `${f.value}${extra}  (${f.from})`]);
  };
  const where = path.relative(cwd, root) || '.';
  const lines = [`Reading ${where === '.' ? 'the current folder' : where === root ? root : `${where} (${root})`}`, ''];
  if (d.sameFolder) {
    lines.push('The site folder is the repository root: only names are read, nothing is mounted. Run init in a subfolder');
    lines.push('(e.g. `project-site init website`) to build the site from the repository\'s files.', '');
  }
  if (m.example) {
    lines.push('Found nothing to build from (no README, manifest, docs or demos): using placeholders and example docs/apps.', '');
  }
  fact('name', d.name);
  fact('tagline', d.tagline);
  fact('repository', d.repo, d.branch.todo ? '' : `, branch ${d.branch.value}`);
  fact('url', d.url);
  if (d.version) fact('version', d.version, d.versionFrom ? ' (header badge)' : '');
  fact('install', d.install);
  if (d.license) rows.push(['licence', `${d.license.spdx ?? 'unknown'}  (${d.license.file ?? d.manifest?.file})`]);
  if (d.authors.length) rows.push(['author', d.authors.map((a) => `${a.name}  (${a.from})`).join(', ')]);
  if (d.readme) {
    const r = d.readme;
    const parts = [r.title && 'title', r.intro && 'intro', r.features.length && `${r.features.length} features`, r.steps.length && `${r.steps.length} step${r.steps.length === 1 ? '' : 's'} ("${r.stepsHeading}")`].filter(Boolean);
    rows.push(['README', `${parts.join(', ') || 'nothing usable'}  (${d.readmeFile})`]);
  }
  for (const x of m.mounts) {
    const folder = m.example ? x.dir.replace(/^\.\//, '') : d.docs?.dir;
    rows.push([x.route === 'project' ? 'project' : 'docs', `${x.include ? x.include.join(', ') : `${folder}/ (${x.pages} pages)`} → /docs/${x.route}/`]);
  }
  if (d.demos.dirs.length) {
    rows.push(['demos', `${d.demos.dirs.map((x) => `${x.dir}/ (${x.pages.length})`).join(', ')} → /${APPS_ROUTE}/, ${m.gallery.length} gallery entries`]);
    if (d.demos.needs.length) rows.push(['', `also mirrored, the pages load from them: ${d.demos.needs.map((n) => `${n}/`).join(', ')}`]);
  }
  for (const e of d.errors) rows.push(['skipped', e]);
  const missing = [
    !d.manifest && 'manifest',
    !d.readme && !d.sameFolder && 'README',
    !d.docs && !d.sameFolder && 'docs folder',
    !d.demos.dirs.length && !d.sameFolder && 'demo pages',
    !d.git && 'git repository',
  ].filter(Boolean);
  if (missing.length) rows.push(['not found', missing.join(', ')]);
  const width = Math.max(...rows.map(([k]) => k.length));
  lines.push('Found:');
  for (const [k, v] of rows) lines.push(`  ${k.padEnd(width)}  ${v}`);
  lines.push('');
  return lines;
}

/** Folders with many files collapse to one line: `example/ (14 files)`. */
function fileTree(/** @type {string[]} */ files, /** @type {string[]} */ existing) {
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  for (const f of files) {
    const dir = /^(example|src\/content\/gallery)\//.exec(f)?.[1];
    const k = dir ? `${dir}/` : f;
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  return [...groups].map(([k, list]) => {
    const mark = list.some((f) => existing.includes(f)) ? '  (exists)' : '';
    return list.length > 3 ? `${k} (${list.length} files)${mark}` : list.map((f) => `${f}${existing.includes(f) ? '  (exists)' : ''}`).join('\n  ');
  });
}

/** @param {import('./detect/index.mjs').Detected} d @param {ReturnType<typeof planFiles>['model']} m */
function nextSteps(d, m, /** @type {{ to: string }[]} */ files) {
  const post = files.find((f) => f.to.startsWith('src/content/blog/'))?.to;
  const out = [];
  if (post) out.push(`read the drafted post ${post}, then set \`draft: false\``);
  const todos = [d.name.todo && 'name', d.tagline.todo && 'tagline', d.url.todo && 'url', d.repo.todo && 'repo', d.branch.todo && 'repoBranch'].filter(Boolean);
  if (todos.length) out.push(`fill in the TODOs in astro.config.mjs (${todos.join(', ')})`);
  if (m.example) out.push('point `externalDocs` and `mirrors` at your own docs and apps, then delete example/');
  if (!d.sameFolder) {
    const sub = path.relative(d.git?.root ?? d.root, d.site).split(path.sep).join('/');
    out.push(`move ${sub}/.github/workflows/site.yml to .github/workflows/ at the repo root (GitHub runs workflows from there only)`);
  }
  out.push('deploy: `npx wrangler login`, then `npm run deploy`');
  return out;
}
