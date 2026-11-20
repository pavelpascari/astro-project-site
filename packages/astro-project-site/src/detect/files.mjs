// What sits in the repository: a docs folder, project files (README, CHANGELOG, CONTRIBUTING), a licence and
// folders of static HTML demos. Reads the file system under `root` only.
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'target', 'coverage', 'vendor']);

/** Files under `dir` (posix, relative), skipping dot-folders, node_modules, build output and the `skip` folders. */
export function listFiles(/** @type {string} */ dir, { skip = /** @type {string[]} */ ([]), maxDepth = 8 } = {}) {
  /** @type {string[]} */
  const out = [];
  const walk = (/** @type {string} */ abs, /** @type {string} */ rel, /** @type {number} */ depth) => {
    if (depth > maxDepth) return;
    for (const ent of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ent.name.startsWith('.') || SKIP_DIRS.has(ent.name)) continue;
      const a = path.join(abs, ent.name);
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        if (!skip.includes(a)) walk(a, r, depth + 1);
      } else if (ent.isFile()) out.push(r);
    }
  };
  if (fs.existsSync(dir)) walk(dir, '', 0);
  return out;
}

/** A file in `root` whose name matches case-insensitively, with its real spelling. */
export function findFile(/** @type {string} */ root, /** @type {string[]} */ names) {
  if (!fs.existsSync(root)) return undefined;
  const entries = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isFile());
  for (const name of names) {
    const hit = entries.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (hit) return hit.name;
  }
  return undefined;
}

const FIRST_PAGES = ['getting-started', 'getting_started', 'quickstart', 'quick-start', 'introduction', 'intro', 'installation', 'install', 'usage', 'guide', 'tutorial'];

/**
 * The docs folder: docs/, doc/ or documentation/ holding markdown.
 * @returns {{ dir: string, pages: string[], order: string[], hasIndex: boolean } | undefined}
 */
export function detectDocs(/** @type {string} */ root, /** @type {string[]} */ skip = []) {
  for (const dir of ['docs', 'doc', 'documentation']) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory() || skip.includes(abs)) continue;
    const pages = listFiles(abs, { skip }).filter((f) => /\.md$/i.test(f));
    if (!pages.length) continue;
    const top = pages.filter((p) => !p.includes('/'));
    const order = FIRST_PAGES.map((n) => top.find((p) => p.replace(/\.md$/i, '').toLowerCase() === n)).filter((p) => p !== undefined).slice(0, 1);
    const hasIndex = top.some((p) => /^(readme|index)\.md$/i.test(p));
    return { dir, pages, order, hasIndex };
  }
  return undefined;
}

/** README, CHANGELOG and CONTRIBUTING (markdown) at the root, with their real file names. */
export function detectProjectFiles(/** @type {string} */ root) {
  return {
    readme: findFile(root, ['README.md', 'readme.markdown']),
    changelog: findFile(root, ['CHANGELOG.md', 'HISTORY.md', 'CHANGES.md']),
    contributing: findFile(root, ['CONTRIBUTING.md']),
  };
}

/** SPDX id of a licence text, when it is one of the common ones. */
export function identifyLicense(/** @type {string} */ text) {
  const t = text.replace(/\s+/g, ' ');
  if (/MIT License|Permission is hereby granted, free of charge/i.test(t)) return 'MIT';
  if (/Apache License,? Version 2\.0/i.test(t)) return 'Apache-2.0';
  if (/GNU AFFERO GENERAL PUBLIC LICENSE/i.test(t)) return 'AGPL-3.0';
  if (/GNU LESSER GENERAL PUBLIC LICENSE/i.test(t)) return /Version 2\.1/i.test(t) ? 'LGPL-2.1' : 'LGPL-3.0';
  if (/GNU GENERAL PUBLIC LICENSE/i.test(t)) return /Version 2,/i.test(t) ? 'GPL-2.0' : 'GPL-3.0';
  if (/Mozilla Public License,? (Version|v\.?) ?2\.0/i.test(t)) return 'MPL-2.0';
  if (/ISC License|Permission to use, copy, modify, and\/or distribute this software for any purpose/i.test(t)) return 'ISC';
  if (/This is free and unencumbered software released into the public domain/i.test(t)) return 'Unlicense';
  if (/Redistribution and use in source and binary forms/i.test(t)) return /Neither the name/i.test(t) ? 'BSD-3-Clause' : 'BSD-2-Clause';
  return undefined;
}

/** @returns {{ file?: string, spdx?: string } | undefined} */
export function detectLicense(/** @type {string} */ root, /** @type {string | undefined} */ manifestLicense) {
  const file = findFile(root, ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'LICENCE.txt', 'COPYING', 'COPYING.md']);
  const spdx = (file && identifyLicense(fs.readFileSync(path.join(root, file), 'utf8'))) || manifestLicense;
  return file || spdx ? { file, spdx } : undefined;
}

const DEMO_DIRS = ['examples', 'example', 'demo', 'demos', 'playground'];
/** Folders that are not demos even when they hold an index.html. */
const NOT_DEMOS = new Set(['site', 'website', 'web', 'www', 'docs', 'doc', 'documentation', 'public', 'static', 'test', 'tests', 'spec', 'fixtures', 'templates', ...SKIP_DIRS]);

/**
 * @typedef {{ file: string, title: string, description?: string }} DemoPage  file: posix, relative to root
 * @typedef {{ dir: string, pages: DemoPage[] }} DemoDir
 */

/** `<title>` and `<meta name="description">` of an HTML page, entities decoded. */
export function htmlMeta(/** @type {string} */ html) {
  const decode = (/** @type {string} */ s) =>
    s.replace(/\s+/g, ' ').trim()
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
      .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const tag = /<meta\s[^>]*name=["']description["'][^>]*>/i.exec(html)?.[0];
  const content = tag && /content=(?:"([^"]*)"|'([^']*)')/i.exec(tag);
  const description = content ? (content[1] ?? content[2]) : undefined;
  return { title: title ? decode(title) || undefined : undefined, description: description ? decode(description) || undefined : undefined };
}

/**
 * Demo folders: examples/, demo/, demos/, playground/ with HTML pages, plus any other top-level folder with an
 * index.html (a studio, a tool), except docs, site and build folders. Pages at most two levels down.
 * @returns {{ dirs: DemoDir[], needs: string[] }} needs: other top-level folders the pages reference (`../src/x.js`)
 */
export function detectDemos(/** @type {string} */ root, /** @type {string[]} */ skip = []) {
  if (!fs.existsSync(root)) return { dirs: [], needs: [] };
  const top = fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !skip.includes(path.join(root, e.name)))
    .map((e) => e.name)
    .sort();
  const candidates = [
    ...DEMO_DIRS.filter((d) => top.includes(d)),
    ...top.filter((d) => !DEMO_DIRS.includes(d) && !NOT_DEMOS.has(d.toLowerCase()) && fs.existsSync(path.join(root, d, 'index.html'))),
  ];
  /** @type {DemoDir[]} */
  const dirs = [];
  const needs = new Set();
  for (const dir of candidates) {
    const files = listFiles(path.join(root, dir), { skip, maxDepth: 2 });
    const html = files.filter((f) => /\.html?$/i.test(f));
    if (!html.length) continue;
    dirs.push({
      dir,
      pages: html.map((f) => {
        const meta = htmlMeta(fs.readFileSync(path.join(root, dir, f), 'utf8'));
        return { file: `${dir}/${f}`, title: meta.title ?? f.replace(/\.html?$/i, ''), description: meta.description };
      }),
    });
    // Relative references that climb out of the folder: `../src/x.js`, `fetch('../figures/a.json')`.
    for (const f of files.filter((x) => /\.(html?|m?js|css)$/i.test(x))) {
      const text = fs.readFileSync(path.join(root, dir, f), 'utf8');
      for (const m of text.matchAll(/(?:^|["'`(\s=])((?:\.\.\/)+)([\w@.-]+)(?=\/|["'`)\s])/g)) {
        const target = path.resolve(path.join(root, dir, path.dirname(f)), m[1], m[2]);
        const rel = path.relative(root, target).split(path.sep);
        const first = rel[0];
        if (!first || first === '..' || first.startsWith('.') || SKIP_DIRS.has(first)) continue;
        const abs = path.join(root, first);
        if (skip.includes(abs) || !fs.existsSync(abs)) continue;
        needs.add(first);
      }
    }
  }
  const demoDirs = new Set(dirs.map((d) => d.dir));
  return { dirs, needs: [...needs].filter((n) => !demoDirs.has(n)).sort() };
}
