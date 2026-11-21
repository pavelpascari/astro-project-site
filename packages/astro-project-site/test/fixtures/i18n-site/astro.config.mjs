// @ts-check
// The i18n fixture: one small site built per language (FIXTURE_LANG=fr | ar) and checked by
// scripts/check-i18n.mjs and scripts/check-html.mjs. French uses the built-in translation; Arabic (right to left)
// has none, so it gets English labels with a few overridden through `labels`.
import { defineConfig } from 'astro/config';
import projectSite from 'astro-project-site';

const lang = process.env.FIXTURE_LANG ?? 'fr';
const LOCALES = {
  fr: { label: 'Français', lang: 'fr' },
  ar: { label: 'العربية', lang: 'ar', dir: 'rtl' },
};
const locale = LOCALES[/** @type {keyof typeof LOCALES} */ (lang)];
if (!locale) throw new Error(`FIXTURE_LANG must be one of ${Object.keys(LOCALES).join(', ')}`);

export default defineConfig({
  outDir: `./dist/${lang}`,
  integrations: [
    projectSite({
      name: 'Fixture',
      tagline: 'A site for checking languages and accessibility.',
      url: 'https://fixture.example',
      repo: 'https://codeberg.org/someone/fixture',
      install: 'npm i fixture',
      blog: { authors: { ada: { name: 'Ada' }, grace: { name: 'Grace' } } },
      footer: { copyright: '© {year} Fixture contributors' },
      ...(lang === 'ar'
        ? { labels: { copy: 'نسخ', skipToContent: 'انتقل إلى المحتوى', pageCount: { one: 'صفحة واحدة', other: '{n} صفحات' } } }
        : {}),
      linksValidator: false,
      starlight: { locales: { root: locale } },
    }),
  ],
});
