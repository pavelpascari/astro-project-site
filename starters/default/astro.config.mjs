// @ts-check
// The whole site is one integration. Options: https://github.com/pavelpascari/astro-project-site#options
import { defineConfig } from 'astro/config';
import projectSite from 'astro-project-site';

export default defineConfig({
  integrations: [
    projectSite({
      name: 'My Project',
      tagline: 'A small library that does one thing well.',
      url: 'https://my-project.example.workers.dev',
      repo: 'https://github.com/you/my-project',
      install: 'npm i my-project',
      // Your project's markdown docs, mounted under /docs/reference/, and static apps served as they are.
      externalDocs: [{ dir: './example/docs', route: 'reference', label: 'Reference', order: ['getting-started.md'] }],
      mirrors: [{ from: './example/apps', to: 'apps' }],
      nav: [{ label: 'Docs', href: '/docs/' }, { label: 'Gallery', href: '/gallery/' }, { label: 'Playground', href: '/apps/hello/' }],
      landing: { hero: { primary: { label: 'Get started', href: '/docs/' }, secondary: { label: 'Gallery', href: '/gallery/' } } },
      ogImage: '/og.png',
    }),
  ],
});
