#!/usr/bin/env node
// OWNER: docs agent.
// Fills generated blocks in markdown files. Zero dependencies.
//
//   <!-- gen:name key=value key2="quoted value" -->
//   ...replaced by the output of generators.name(ctx)...
//   <!-- /gen -->
//
// Usage:  node scripts/docs-gen.mjs [--check] [--config docs-gen.config.mjs]
//   default  rewrite stale blocks in place (idempotent: a second run changes nothing)
//   --check  change nothing; exit 1 and print a diff for every stale block
//
// Config (default: docs-gen.config.mjs in the current folder; paths in it are relative to the config file):
//   export default {
//     files: ['docs', 'README.md', 'guides/**/*.md'],       // folders (all .md/.mdx inside), files or globs
//     generators: { name: async (ctx) => 'markdown' },      // ctx: { name, args, file, relFile, root, current }
//   };
// Marker lines must stand on their own line. Markers inside fenced code blocks are ignored.
// Unknown generator names, unclosed or nested blocks and throwing generators are errors (exit 1).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const OPEN = /^(\s*)<!--\s*gen:([\w.-]+)(.*?)-->\s*$/;
const CLOSE = /^\s*<!--\s*\/gen\s*-->\s*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const DOC_EXT = /\.(md|mdx|markdown)$/i;

const argv = process.argv.slice(2);
const check = argv.includes('--check');
const configArg = argv.includes('--config') ? argv[argv.indexOf('--config') + 1] : undefined;
const configPath = path.resolve(configArg ?? 'docs-gen.config.mjs');

if (!fs.existsSync(configPath)) fail(`docs-gen: config not found: ${configPath}`);
const root = path.dirname(configPath);
const config = (await import(pathToFileURL(configPath).href)).default;
if (!config || !Array.isArray(config.files) || typeof config.generators !== 'object') {
  fail(`docs-gen: ${rel(configPath)} must export default { files: [...], generators: { ... } }`);
}

const files = resolveFiles(config.files);
/** @type {string[]} */
const errors = [];
/** @type {string[]} */
const reports = [];
let stale = 0;
let written = 0;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const blocks = parseBlocks(file, text);
  if (!blocks) continue;
  const lines = text.split('\n');
  let changed = false;
  // Replace bottom-up so earlier line numbers stay valid.
  for (const block of [...blocks].reverse()) {
    const gen = config.generators[block.name];
    if (typeof gen !== 'function') {
      errors.push(`${rel(file)}:${block.start + 1}: unknown generator "gen:${block.name}" (known: ${Object.keys(config.generators).join(', ') || 'none'})`);
      continue;
    }
    const current = lines.slice(block.start + 1, block.end).join('\n');
    let output;
    try {
      output = await gen({ name: block.name, args: block.args, file, relFile: rel(file), root, current });
    } catch (err) {
      errors.push(`${rel(file)}:${block.start + 1}: gen:${block.name} threw: ${err instanceof Error ? err.stack : err}`);
      continue;
    }
    if (typeof output !== 'string') {
      errors.push(`${rel(file)}:${block.start + 1}: gen:${block.name} returned ${typeof output}, expected a string`);
      continue;
    }
    const next = output.replace(/^\n+|\s+$/g, '');
    if (current === next) continue;
    stale++;
    changed = true;
    if (check) reports.push(`${rel(file)}:${block.start + 1}: gen:${block.name} is stale\n${diff(current, next)}`);
    lines.splice(block.start + 1, block.end - block.start - 1, ...(next ? next.split('\n') : []));
  }
  if (changed && !check) {
    fs.writeFileSync(file, lines.join('\n'));
    written++;
    console.log(`updated ${rel(file)}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
if (check) {
  if (stale) {
    console.error(reports.join('\n\n'));
    console.error(`\ndocs-gen: ${stale} stale block(s). Run \`npm run docs:gen\` and commit the result.`);
    process.exit(1);
  }
  console.log(`docs-gen: ${files.length} file(s) checked, all generated blocks up to date.`);
} else {
  console.log(written ? `docs-gen: updated ${written} file(s).` : `docs-gen: ${files.length} file(s), nothing to update.`);
}

// ---------- helpers ----------

/** @returns {{ name: string, args: Record<string, string>, start: number, end: number }[] | undefined} */
function parseBlocks(/** @type {string} */ file, /** @type {string} */ text) {
  const blocks = [];
  /** @type {any} */
  let open = null;
  /** @type {string | null} */
  let fence = null;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const f = FENCE.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      continue;
    }
    if (f) { fence = f[1]; continue; }
    const o = OPEN.exec(line);
    if (o) {
      if (open) { errors.push(`${rel(file)}:${i + 1}: gen:${o[2]} opened inside gen:${open.name} (line ${open.start + 1}); blocks cannot nest`); return; }
      open = { name: o[2], args: parseArgs(o[3]), start: i };
    } else if (CLOSE.test(line)) {
      if (!open) { errors.push(`${rel(file)}:${i + 1}: <!-- /gen --> without an opening <!-- gen:name -->`); return; }
      blocks.push({ ...open, end: i });
      open = null;
    }
  }
  if (open) { errors.push(`${rel(file)}:${open.start + 1}: gen:${open.name} is never closed with <!-- /gen -->`); return; }
  return blocks;
}

function parseArgs(/** @type {string} */ s) {
  /** @type {Record<string, string>} */
  const args = {};
  for (const m of s.matchAll(/([\w.-]+)=(?:"([^"]*)"|'([^']*)'|(\S+))/g)) args[m[1]] = m[2] ?? m[3] ?? m[4];
  return args;
}

/** Config `files` entries → absolute file list: folders recurse for .md/.mdx, globs support `**`, `*`, `?`. */
function resolveFiles(/** @type {string[]} */ entries) {
  const out = new Set();
  for (const entry of entries) {
    if (/[*?]/.test(entry)) {
      const segments = entry.replace(/^\.\//, '').split('/');
      const base = segments.slice(0, segments.findIndex((seg) => /[*?]/.test(seg))).join('/');
      const re = globToRegExp(segments.join('/'));
      for (const f of walk(path.resolve(root, base))) if (re.test(rel(f, root))) out.add(f);
    } else {
      const abs = path.resolve(root, entry);
      if (!fs.existsSync(abs)) fail(`docs-gen: listed in config but missing: ${entry}`);
      if (fs.statSync(abs).isDirectory()) walk(abs).filter((f) => DOC_EXT.test(f)).forEach((f) => out.add(f));
      else out.add(abs);
    }
  }
  return [...out].sort();
}

function walk(/** @type {string} */ dir) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function globToRegExp(/** @type {string} */ glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** Line diff (LCS) of a block: `-` current, `+` expected, two lines of context. */
function diff(/** @type {string} */ a, /** @type {string} */ b) {
  const x = a ? a.split('\n') : [];
  const y = b ? b.split('\n') : [];
  const lcs = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) {
    lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  /** @type {[string, string][]} */
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) { ops.push([' ', x[i]]); i++; j++; }
    else if (j < y.length && (i >= x.length || lcs[i][j + 1] >= lcs[i + 1][j])) ops.push(['+', y[j++]]);
    else ops.push(['-', x[i++]]);
  }
  const keep = ops.map((op, k) => op[0] !== ' ' || ops.slice(Math.max(0, k - 2), k + 3).some((o) => o[0] !== ' '));
  /** @type {string[]} */
  const out = [];
  ops.forEach((op, k) => {
    if (keep[k]) out.push(`  ${op[0]} ${op[1]}`);
    else if (keep[k - 1]) out.push('    ...');
  });
  return out.join('\n');
}

function rel(/** @type {string} */ p, from = process.cwd()) {
  return path.relative(from, p).split(path.sep).join('/');
}

function fail(/** @type {string} */ msg) {
  console.error(msg);
  process.exit(1);
}
