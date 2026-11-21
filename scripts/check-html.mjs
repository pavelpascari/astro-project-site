#!/usr/bin/env node
// Accessibility and language checks on a built site (the HTML in dist/), without a browser:
//
//   node scripts/check-html.mjs site/dist [--lang fr] [--dir rtl]
//
// 1. html-validate's `a11y` rules (WCAG techniques: names for buttons, links, landmarks and form fields, alt
//    text, heading levels, unique ids, valid ARIA) on every page.
// 2. Checks of our own on every page: <html lang> (and `--lang`/`--dir` when given), one <h1>, a <main>.
//
// A few findings come from markup we do not own; ALLOWED lists them with the reason. Anything else fails.
import fs from 'node:fs';
import path from 'node:path';
import { HtmlValidate, StaticConfigLoader } from 'html-validate';

const RULES = {
  extends: ['html-validate:a11y'],
  rules: {
    // `role="list"` on unstyled lists is deliberate: Safari drops list semantics when `list-style: none`.
    // The table roles come from the responsive-table script, which keeps semantics on `display: block` tables.
    'no-redundant-role': 'off',
    // A <button> without `type` only submits inside a <form>; the template has no forms, and Starlight's and
    // Expressive Code's buttons are outside any.
    'no-implicit-button-type': 'off',
  },
};

/** Findings in markup we do not own. Each: rule, a selector fragment, and why it is accepted. */
const ALLOWED = [
  {
    rule: 'unique-landmark',
    match: /starlight-toc > nav$/,
    why: "Starlight's two tables of contents (wide and narrow screens) share the name \"On this page\"; only one is shown at a time.",
  },
  {
    rule: 'unique-landmark',
    match: /^html > body > div > div > div > aside$/,
    why: "Starlight's right-hand sidebar is an unnamed <aside> around the table of contents (which is named).",
  },
];

/** @param {string} dir */
function htmlFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

/**
 * Problems on one page from our own checks.
 * @param {string} html
 * @param {{ lang?: string, dir?: string }} expect
 */
export function pageProblems(html, expect) {
  /** @type {string[]} */
  const problems = [];
  const root = /<html\b([^>]*)>/i.exec(html)?.[1] ?? '';
  const lang = /\blang="([^"]*)"/.exec(root)?.[1];
  const dir = /\bdir="([^"]*)"/.exec(root)?.[1];
  if (!lang) problems.push('<html> has no lang');
  else if (expect.lang && lang.toLowerCase() !== expect.lang.toLowerCase()) problems.push(`<html lang="${lang}">, expected "${expect.lang}"`);
  if (expect.dir && (dir ?? 'ltr') !== expect.dir) problems.push(`<html dir="${dir ?? ''}">, expected "${expect.dir}"`);
  const h1 = (html.match(/<h1\b/gi) ?? []).length;
  if (h1 !== 1) problems.push(`${h1} <h1> elements (expected exactly one)`);
  if (!/<main\b/i.test(html)) problems.push('no <main>');
  return problems;
}

async function main(/** @type {string[]} */ argv) {
  const flag = (/** @type {string} */ name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const dirs = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
  if (!dirs.length) throw new Error('usage: node scripts/check-html.mjs <dist> [<dist>…] [--lang fr] [--dir rtl] [--skip apps]');
  // Folders copied byte for byte (mirrors, `--skip apps`) are the project's own pages, not the template's: skipped.
  const skip = (flag('skip') ?? '').split(',').filter(Boolean);
  const validator = new HtmlValidate(new StaticConfigLoader(RULES));
  let failures = 0;
  let pages = 0;
  let allowed = 0;
  for (const dist of dirs) {
    for (const file of htmlFiles(dist)) {
      const rel = path.relative(dist, file);
      if (skip.some((s) => rel.startsWith(`${s}/`))) continue;
      pages++;
      const html = fs.readFileSync(file, 'utf8');
      // Astro's dev-only redirect pages (<meta http-equiv="refresh">) have no content to check.
      if (/<meta http-equiv="refresh"/i.test(html) && !/<main\b/i.test(html)) continue;
      const own = pageProblems(html, { lang: flag('lang'), dir: flag('dir') });
      const report = await validator.validateString(html, file);
      const found = report.results.flatMap((r) => r.messages);
      const kept = found.filter((m) => {
        const ok = ALLOWED.some((a) => a.rule === m.ruleId && a.match.test(m.selector ?? ''));
        if (ok) allowed++;
        return !ok;
      });
      for (const p of own) console.error(`${path.join(path.basename(dist), rel)}: ${p}`);
      for (const m of kept) console.error(`${path.join(path.basename(dist), rel)}:${m.line}:${m.column} [${m.ruleId}] ${m.message}\n    at ${m.selector}`);
      failures += own.length + kept.length;
    }
  }
  console.log(`check-html: ${pages} pages, ${failures} problem(s), ${allowed} known third-party finding(s) accepted.`);
  if (failures) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`check-html: ${error.message}`);
    process.exit(1);
  });
}
