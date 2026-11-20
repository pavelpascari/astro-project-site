// @ts-check
// The template's own website. It uses the package exactly like any project would; the example docs and apps it
// mounts and mirrors are the starter's fixtures (../starters/default/example), so they exist only once.
import { defineConfig } from 'astro/config';
import projectSite from 'astro-project-site';
import docs from './docs.config.mjs';

const example = '../starters/default/example';

export default defineConfig({
  integrations: [
    projectSite({
      ...docs,
      name: 'Example Project',
      tagline: 'A small library that does one thing well.',
      url: 'https://example-project.workers.dev',
      repo: 'https://github.com/you/example-project',
      versionFrom: '../packages/astro-project-site/package.json',
      nav: [
        { label: 'Docs', href: '/docs/' },
        { label: 'Gallery', href: '/gallery/' },
        { label: 'Playground', href: '/apps/hello/' },
      ],
      mirrors: [{ from: `${example}/apps`, to: 'apps' }],
      install: 'npm i example-project',
      ogImage: '/og.png',
      theme: { accent: '#4f46e5', accentDark: '#a5b4fc' },
      landing: {
        hero: {
          primary: { label: 'Get started', href: '/docs/' },
          secondary: { label: 'See it running', href: '/gallery/' },
          demo: {
            code: `<script type="module" src="/apps/live-assets/hello-badge.js"></script>\n<hello-badge name="world"></hello-badge>`,
            title: 'hello.html',
            editable: true,
            mode: 'iframe',
          },
        },
        features: [
          { title: 'Small', body: 'One dependency-free module you can read in an afternoon.' },
          { title: 'Typed', body: 'Ships its own TypeScript types and stays out of your build.' },
          { title: 'Framework-agnostic', body: 'Works in plain HTML, any bundler, or none at all.' },
          { title: 'Documented', body: 'Every export has a page in the reference, with a runnable example.', href: '/docs/reference/' },
        ],
        steps: [
          { title: 'Install', body: 'Add the package to your project.', code: 'npm i example-project', lang: 'sh' },
          { title: 'Import', body: 'Pull in the one function you need.', code: "import { hello } from 'example-project';", lang: 'js' },
          { title: 'Call it', body: 'That is the whole API surface for most projects.', code: "hello('world'); // → 'Hello, world'", lang: 'js' },
        ],
        gallery: { title: 'See it in action', limit: 3 },
        cta: {
          title: 'Ready when you are',
          body: 'Read the guide, then try it in the playground.',
          primary: { label: 'Read the docs', href: '/docs/' },
          secondary: { label: 'Open the playground', href: '/apps/hello/' },
        },
      },
      footer: { note: 'Released under the MIT licence.' },
    }),
  ],
});
