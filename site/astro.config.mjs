// @ts-check
// astro-project-site's own website, built with astro-project-site. This file is the whole site config, and the
// landing page shows it, live. Docs options are in docs.config.mjs; the landing page is src/pages/index.astro.
import { defineConfig } from 'astro/config';
import projectSite from 'astro-project-site';
import docs from './docs.config.mjs';

export default defineConfig({
  integrations: [
    projectSite({
      ...docs,
      name: 'astro-project-site',
      tagline: 'A whole site for your open-source project, from one Astro integration.',
      url: 'https://astro-project-site.workers.dev',
      repo: 'https://github.com/pavelpascari/astro-project-site',
      versionFrom: '../packages/astro-project-site/package.json',
      install: 'npx project-site init my-site',
      nav: [
        { label: 'Docs', href: '/docs/' },
        { label: 'Gallery', href: '/gallery/' },
      ],
      mirrors: [{ from: '../starters/default/example/apps', to: 'apps' }],
      theme: { accent: '#b93b0e', accentDark: '#ff7a4d' },
      customCss: ['./src/styles/brand.css'],
      gallery: { title: 'Gallery', description: 'The parts of this site, each one running.' },
      ogImage: '/og.png',
      footer: { note: 'MIT licence. This site is built with itself.' },
    }),
  ],
});
