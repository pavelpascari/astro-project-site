import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { EN, format, LABEL_NAMES, resolveLabels, siteLocale, TRANSLATIONS } from '../src/labels.mjs';

const SRC = path.resolve(import.meta.dirname, '../src');

test('resolveLabels: closest translation, English for gaps, overrides on top', () => {
  assert.equal(resolveLabels('fr').copy, 'Copier');
  assert.equal(resolveLabels('fr-CA').copy, 'Copier', 'a region falls back to its language');
  assert.equal(resolveLabels('DE').copy, 'Kopieren', 'case does not matter');
  assert.equal(resolveLabels('ja').copy, 'Copy', 'no translation: English');
  assert.equal(resolveLabels('fr', { copy: 'Copie' }).copy, 'Copie');
  assert.equal(resolveLabels('fr', { copy: 'Copie' }).copied, 'Copié');
});

test('format: placeholders and plural forms by language', () => {
  assert.equal(format('Page {n} of {total}', { n: 2, total: 5 }), 'Page 2 of 5');
  assert.equal(format('{missing} stays', {}), '{missing} stays');
  assert.equal(format(EN.pageCount, { n: 1 }, 'en'), '1 page');
  assert.equal(format(EN.pageCount, { n: 4 }, 'en'), '4 pages');
  // French puts 0 and 1 in "one"; English puts 0 in "other".
  assert.equal(format(/** @type {any} */ (TRANSLATIONS.fr.pageCount), { n: 0 }, 'fr'), '0 page');
  assert.equal(format(EN.pageCount, { n: 0 }, 'en'), '0 pages');
  assert.equal(format({ zero: 'none', other: '{n}' }, { n: 0 }, 'en'), 'none');
  assert.equal(format(EN.pageCount, { n: 3 }, 'not a language!'), '3 pages', 'a bad tag does not throw');
});

test('every translation covers every label, with the same placeholders', () => {
  const holes = (/** @type {unknown} */ v) =>
    [...new Set((typeof v === 'string' ? v : Object.values(/** @type {object} */ (v)).join(' ')).match(/\{\w+\}/g) ?? [])].sort().join();
  for (const [lang, labels] of Object.entries(TRANSLATIONS)) {
    if (lang === 'en') continue;
    assert.deepEqual(Object.keys(labels).sort(), [...LABEL_NAMES].sort(), `${lang}: missing or extra labels`);
    for (const name of LABEL_NAMES) {
      const value = /** @type {any} */ (labels)[name];
      assert.equal(typeof value, typeof EN[name], `${lang}.${name}: string vs plural forms`);
      if (typeof value === 'object') assert.ok(value.other, `${lang}.${name}: plural forms need "other"`);
      assert.equal(holes(value), holes(EN[name]), `${lang}.${name}: placeholders differ from English`);
    }
  }
});

test('siteLocale: root locale, else the default locale, else English', () => {
  assert.deepEqual(siteLocale(undefined), { lang: 'en', dir: 'ltr' });
  assert.deepEqual(siteLocale({ locales: { root: { label: 'العربية', lang: 'ar', dir: 'rtl' } } }), { lang: 'ar', dir: 'rtl' });
  assert.deepEqual(siteLocale({ defaultLocale: 'de', locales: { de: { label: 'Deutsch' }, en: { label: 'English' } } }), { lang: 'de', dir: 'ltr' });
});

test('every label is used somewhere, and every t() name exists', () => {
  /** @type {string[]} */
  const files = [];
  const walk = (/** @type {string} */ dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(astro|ts|mjs)$/.test(name) && name !== 'labels.mjs') files.push(full);
    }
  };
  walk(SRC);
  const code = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const used = new Set([...code.matchAll(/\b(?:t|label|text)\('(\w+)'/g), ...code.matchAll(/labels(?:For\(\w*\))?\??\.(\w+)/g)].map((m) => m[1]));
  // Read by name elsewhere: the alert titles (markdown/index.mjs, by kind).
  for (const name of ['note', 'tip', 'important', 'warning', 'caution']) used.add(name);
  const tNames = [...code.matchAll(/\b(?:t|label)\('(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(tNames.filter((n) => !(n in EN)), [], 'names passed to t() that are not labels');
  assert.deepEqual(LABEL_NAMES.filter((n) => !used.has(n)), [], 'labels nothing uses');
});

test('component templates have no English left in them: words come from labels', () => {
  /** @type {string[]} */
  const offenders = [];
  const walk = (/** @type {string} */ dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.astro')) {
        const source = readFileSync(full, 'utf8');
        // The template: after the frontmatter, without <style>/<script> blocks, comments and {expressions}.
        let html = source.replace(/^---[\s\S]*?\n---/, '');
        html = html.replace(/<(style|script)\b[\s\S]*?<\/\1>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
        let depth = 0;
        let text = '';
        for (const ch of html) {
          if (ch === '{') depth++;
          else if (ch === '}') depth = Math.max(0, depth - 1);
          else if (depth === 0) text += ch;
        }
        for (const m of text.matchAll(/>([^<>]*)</g)) {
          const words = m[1].replace(/&\w+;|[^\p{L}]+/gu, ' ').trim();
          if (/\p{L}{2,}/u.test(words)) offenders.push(`${path.relative(SRC, full)}: "${words}"`);
        }
        for (const m of text.matchAll(/\s(aria-label|title|placeholder|alt)="([^"]*\p{L}{2,}[^"]*)"/gu)) {
          offenders.push(`${path.relative(SRC, full)}: ${m[1]}="${m[2]}"`);
        }
      }
    }
  };
  walk(SRC);
  assert.deepEqual(offenders, []);
});
