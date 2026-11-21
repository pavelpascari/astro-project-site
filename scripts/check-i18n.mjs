#!/usr/bin/env node
// Builds the i18n fixture (packages/astro-project-site/test/fixtures/i18n-site) once per language and checks:
//   - every page passes scripts/check-html.mjs with the right <html lang> and dir;
//   - the template's words are in that language (built-in French; Arabic, right to left, through `labels`);
//   - none of the English they replace is left.
//
//   npm run test:i18n            (needs Node 22.23.4+, like Astro)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'packages/astro-project-site/test/fixtures/i18n-site');

/** Per language: <html> attributes, words each page must show, and English that must be gone. */
const CASES = {
  fr: {
    dir: 'ltr',
    pages: {
      'index.html': {
        has: ['Aller au contenu', '>Copier<', 'Galerie', 'Voir toute la galerie', '© 2026 Fixture contributors', 'Codeberg', '2 pages', '1 page'],
        not: ['Skip to content', '>Copy<', 'See the whole gallery', 'Source code'],
      },
      'docs/index.html': {
        has: ['Copier la page', 'Remarque', 'Retour à la ligne', 'Menu du site'],
        not: ['Copy page', '>Note<', 'Wrap lines'],
      },
      'docs/guide/index.html': { has: ["Vue d'ensemble"], not: ['>Overview<'] },
      'blog/hello/index.html': {
        has: ['Ada</span> et <span', 'min de lecture', 'Étiquettes'],
        not: ['min read', ' and <span'],
      },
      'blog/tags/news/index.html': { has: ['Articles étiquetés « news »'], not: ['Posts tagged'] },
      'gallery/index.html': { has: ['(site externe)', 'Démos, exemples et outils, en direct.'], not: ['(external site)'] },
    },
  },
  ar: {
    dir: 'rtl',
    pages: {
      'index.html': { has: ['انتقل إلى المحتوى', '>نسخ<', 'صفحة واحدة'], not: ['Skip to content', '>Copy<'] },
      // No built-in Arabic: labels not overridden stay English.
      'docs/index.html': { has: ['Copy page'], not: [] },
    },
  },
};

const year = String(new Date().getFullYear());
let failures = 0;
for (const [lang, spec] of Object.entries(CASES)) {
  const dist = path.join(fixture, 'dist', lang);
  fs.rmSync(dist, { recursive: true, force: true });
  console.log(`check-i18n: building the fixture in "${lang}"…`);
  execFileSync('npx', ['astro', 'build'], { cwd: fixture, env: { ...process.env, FIXTURE_LANG: lang }, stdio: ['ignore', 'ignore', 'inherit'] });

  for (const [rel, { has, not }] of Object.entries(spec.pages)) {
    const file = path.join(dist, rel);
    if (!fs.existsSync(file)) {
      console.error(`${lang}/${rel}: missing`);
      failures++;
      continue;
    }
    // Apostrophes come out as &#39; or ’ depending on who rendered them: compare with both made plain.
    const html = fs.readFileSync(file, 'utf8').replaceAll('&#39;', "'").replaceAll('’', "'");
    for (const text of has) {
      const want = text.replace('2026', year);
      if (!html.includes(want)) {
        console.error(`${lang}/${rel}: expected "${want}"`);
        failures++;
      }
    }
    for (const text of not) {
      if (html.includes(text)) {
        console.error(`${lang}/${rel}: still has "${text}"`);
        failures++;
      }
    }
  }
  try {
    execFileSync(process.execPath, [path.join(root, 'scripts/check-html.mjs'), dist, '--lang', lang, '--dir', spec.dir], { stdio: 'inherit' });
  } catch {
    failures++;
  }
}
console.log(`check-i18n: ${failures ? `${failures} problem(s)` : 'all languages OK'}.`);
if (failures) process.exit(1);
