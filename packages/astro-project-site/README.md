# astro-project-site

An Astro integration for open-source project sites: a landing page, Starlight docs that mount your project's own
markdown folder, live examples, a gallery, static HTML/JS apps served as they are, and Cloudflare Workers deploys
with a preview per pull request. Astro 7 + Starlight 0.43. MIT.

```bash
npx astro-project-site init my-site
cd my-site && npm install && npm run dev
```

## Start a project

`project-site init [dir]` copies the starter (a complete, building site) into `dir` and names it after the folder.
It never overwrites a file unless you pass `--force`.

```bash
npx astro-project-site init my-site --name "My Lib"   # the package's only bin is `project-site`
```

A project is five small files plus content:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import projectSite from 'astro-project-site';

export default defineConfig({
  integrations: [
    projectSite({
      name: 'My Lib',
      tagline: 'A small library that does one thing well.',
      url: 'https://my-lib.dev',
      repo: 'https://github.com/me/my-lib',
      externalDocs: [{ dir: '../docs', route: 'reference', label: 'Reference' }],
      mirrors: [{ from: '../demos', to: 'demos' }],
    }),
  ],
});
```

```ts
// src/content.config.ts
import { projectSiteCollections } from 'astro-project-site/content';
export const collections = projectSiteCollections();
```

plus `package.json`, `tsconfig.json` (`astro/tsconfigs/strict`), `wrangler.jsonc`, docs pages in
`src/content/docs/docs/`, gallery items in `src/content/gallery/`.

## What the integration sets up

`projectSite()` is the only integration a project adds. It:

- adds **Starlight** with the docs pipeline: `externalDocs` folders mounted under `/docs/<route>/` (titles from the
  first heading, `.md` links rewritten, other relative links sent to the file on GitHub), a generated sidebar,
  "edit this page" links computed from where the site sits in its git repo, `markdown.processedDirs`,
  [starlight-links-validator](https://github.com/HiDeoo/starlight-links-validator), Pagefind search and the sitemap;
- adds the **mirror** integration for `mirrors` (served from disk in dev, copied into `dist/` at build);
- overrides Starlight's `Header` (the shared site header), `Footer` (Starlight's footer, then the shared site footer),
  and `MobileMenuFooter` (the site nav inside Starlight's mobile menu, so small screens have one menu button);
- adds a Starlight route middleware that gives docs pages the same `og:image` as every other page;
- loads `theme.css` everywhere, then your `customCss`;
- injects pages: `/` (landing), `/gallery/`, `/llms.txt`, `/llms-full.txt`. A page of your own at the same path
  (e.g. `src/pages/index.astro`) always wins, and each can be switched off (`landing: false`, `gallery: false`,
  `llms: false`);
- sets Astro's `site` from `url` unless you set it.

Options are validated before Astro starts; a mistake names the field:

```
Invalid projectSite() options:
  - landing.hero.primary.href: Invalid input: expected string, received undefined
  - unknown option "navv"
```

## Options

All paths are relative to the project root (the folder of `astro.config.mjs`) and may point outside it.

| option | type | default | |
|---|---|---|---|
| `name` | `string` | required | Project name: header, titles. |
| `tagline` | `string` | required | One line under the name; default meta description. |
| `url` | `string` (URL) | required | Production URL; Astro's `site` unless set. |
| `repo` | `string` (URL) | required | Repository: header link, edit links, links to source files (GitHub URL layout). |
| `repoBranch` | `string` | `'main'` | Branch for edit and source links. |
| `versionFrom` | `string` | | A `package.json` whose `version` the header shows. |
| `nav` | `{ label, href }[]` | Docs, Gallery | Top navigation on every page (and in the docs' mobile menu). |
| `externalDocs` | `{ dir, route, label, order?, exclude? }[]` | `[]` | Markdown folders mounted under `/docs/<route>/`. `order`: file names listed first. `exclude`: globs. |
| `mirrors` | `{ from, to, include?, exclude? }[]` | `[]` | Folders served byte for byte under `/<to>/`. Globs: `*`, `?`, `**`, `{a,b}`, `[…]`. |
| `install` | `string` | | Install command on the landing page. |
| `favicon` | `string` | `'/favicon.svg'` | Under `public/`. |
| `ogImage` | `string` | | Default social image (path under `public/` or URL). |
| `ogImageFor` | `string` | | Module whose default export is `(page: { path, title, description }) => string \| undefined`, for per-page images. Used on every page, docs included. |
| `theme` | `{ accent?, accentDark? }` | | Accent colours. For more, override tokens in `customCss`. |
| `landing` | `LandingContent \| false` | `{}` | Content of the built-in landing page (below), or no landing page. |
| `gallery` | `{ title?, description? } \| false` | `{}` | The `/gallery/` page, or none. |
| `footer` | `{ note? }` | | Extra footer line, e.g. a licence. |
| `llms` | `boolean` | `true` | `/llms.txt` and `/llms-full.txt`. |
| `customCss` | `string[]` | `[]` | Stylesheets loaded on every page after `theme.css`. |
| `components` | `ComponentOverrides` | `{}` | Replace built-in components (below). |
| `linksValidator` | `object \| false` | | starlight-links-validator options (`exclude` is added to the built-in list of non-docs pages), or off. |
| `starlight` | `object` | `{}` | Extra Starlight options (below). |

### `landing`

```ts
landing: {
  hero: { title?, lead?, primary?: { label, href }, secondary?: { label, href }, demo?: HeroDemo },
  features: Feature[] | { title?, intro?, items: Feature[] },   // Feature: { title, body, href? }
  steps: Step[] | { title?, intro?, items: Step[] },            // Step: { title, body, code?, lang? }
  gallery: { title?, intro?, limit? },                          // limit 0 hides the strip; default 3
  cta: { title, body?, primary?, secondary? },
}
```

`hero.demo` is a live example under the hero: `{ code, lang?, title?, caption?, mode?, preview?, runner?, editable?,
options?, modules?, base?, height? }` (the `<Live>` props).

### `components`

Paths to `.astro` components that replace the built-ins wherever the integration renders them:

| slot | replaces | props |
|---|---|---|
| `Header` | the header bar contents, on every page including docs | slots `search`, `theme`, `theme-menu` |
| `Footer` | the footer, on every page including docs | `variant: 'page' \| 'docs'` |
| `Hero` | the landing page hero | `title, lead, primary, secondary, install`; slot `live` |
| `Landing` | the whole landing page body (inside `BaseLayout`) | none; read options from `astro-project-site/config` |
| `GalleryCard` | one gallery card (landing strip and `/gallery/`) | `item: GalleryEntry, headingLevel` |
| `Gallery` | the whole `/gallery/` body (inside `BaseLayout`) | `items, title, description` |

An override can wrap the built-in: `import { SiteHeader } from 'astro-project-site/components'` is always the
original.

### `starlight`

Passed to Starlight. List options are **appended** to the ones projectSite() sets: `sidebar` (after the generated
sidebar), `plugins`, `customCss` (docs pages only, after `customCss`), `routeMiddleware`, `markdown.processedDirs`.
`components` entries override ours (your own `Header` replaces the shared header on docs pages). Everything else
(`head`, `locales`, `lastUpdated`, `pagefind`, `social`, `editLink`, …) is set as given.

## Exports

| import | what |
|---|---|
| `astro-project-site` | `default projectSite(options)`, `mirror(entries)`; types `ProjectSiteOptions`, `LandingContent`, `ComponentOverrides`, `SiteConfig`, `GalleryEntry`, `GalleryData`, `OgImageHook`, `LiveRunner`, `LiveContext`, `LiveProps`, … |
| `astro-project-site/components` | `Live`, `BaseLayout`, `SiteHead`, `SiteHeader`, `SiteFooter`, `ThemeSelect`, `Landing`, `Hero`, `Section`, `Features`, `Steps`, `GalleryStrip`, `CallToAction`, `InstallCommand`, `GalleryPage`, `GalleryGrid`, `GalleryCard`, `GalleryFilters`; helpers `galleryItems()`, `distinct()`, `isActive()`, `isExternal()` |
| `astro-project-site/content` | `projectSiteCollections({ docsExtend?, galleryBase? })` → `{ docs, gallery, i18n }`; `gallerySchema`, `projectDocsLoader` |
| `astro-project-site/config` | the validated options plus `version` (`SiteConfig`), for your own pages |
| `astro-project-site/theme.css` | the design tokens (loaded automatically; import it only in pages that use neither BaseLayout nor Starlight) |

Types for the virtual modules behind these (`virtual:astro-project-site/*`) are injected into `.astro/` by the
integration, so `astro check` passes without setup.

## Your own pages

```astro
---
// src/pages/about.astro
import { BaseLayout, Section, Live } from 'astro-project-site/components';
import config from 'astro-project-site/config';
---
<BaseLayout title="About">
  <Section title={`About ${config.name}`}>
    <Live code={`<b>hello</b>`} />
  </Section>
</BaseLayout>
```

## Live examples

```mdx
import { Live } from 'astro-project-site/components';

<Live caption="A custom element" editable mode="iframe">

```html
<script type="module" src="/apps/live-assets/hello-badge.js"></script>
<hello-badge name="docs"></hello-badge>
```

</Live>
```

Props: `code`, `lang`, `title`, `caption`, `id`, `mode` (`inline`/`iframe`), `preview` (`above`/`below`/`side`),
`editable`, `runner` (module URL exporting `run(source, mount, ctx: LiveContext)`), `options`, `modules`, `head`,
`base`, `sandbox`, `height`, `lazy`, `debounce`. Works on docs pages and on any `BaseLayout` page: `theme.css`
supplies the `--sl-*` tokens it needs outside Starlight.

## Theme

Every colour, Starlight's included, derives from a few tokens. Override them in a `customCss` file:

```css
:root { --site-accent: #ffb347; --site-bg: #17151d; --site-surface: #211e29; --site-text: #f2eee8;
        --site-muted: #a9a3b4; --site-border: #322e3c; --site-radius: 4px; }
:root[data-theme='light'] { --site-accent: #c2541b; --site-bg: #fbf8f2; /* … */ }
```

Tokens: `--site-accent`, `--site-bg`, `--site-surface`, `--site-text`, `--site-muted`, `--site-border`,
`--site-code-bg`, `--site-code-text`, `--site-font-body`, `--site-font-heading`, `--site-font-mono`, `--site-radius`,
`--site-space`, `--site-max-width`, `--site-header-height`; derived: `--site-accent-soft`, `--site-accent-strong`,
`--site-on-accent`, `--site-link`, `--site-focus`, `--site-radius-sm`, `--site-shadow`. The theme choice is shared
with Starlight (`localStorage['starlight-theme']`, `<html data-theme>`).

## CLI

```
project-site init [dir] [--name "My Lib"] [--force] [--package <npm spec>]
project-site docs:gen [--check] [--config docs-gen.config.mjs]
project-site docs:check
project-site deploy:preview [--alias pr-12] [--message "…"] [--dry-run] [-- <wrangler args>]
```

- **docs:gen** fills `<!-- gen:name key=value -->…<!-- /gen -->` blocks in markdown using generators from
  `docs-gen.config.mjs` (`export default { files: [...], generators: { name: async ({ args, file, relFile, root, current }) => string } }`).
  `--check` changes nothing and exits 1 with a diff when a block is stale.
- **deploy:preview** uploads `dist/` as a Cloudflare Worker version under a stable preview alias (default: the git
  branch). It uses the project's own `wrangler` (a devDependency), or `npx wrangler@4`; this package does not depend
  on wrangler.

## Deploys and CI

The starter deploys as a static-assets Worker (`wrangler.jsonc`, `public/_headers`). Its whole CI is:

```yaml
on: [pull_request, push, workflow_dispatch]
jobs: { site: { uses: pavelpascari/astro-project-site/.github/workflows/deploy.yml@main, permissions: { contents: read, pull-requests: write }, secrets: inherit } }
```

The reusable workflow type-checks, builds, runs `docs:check`, and deploys: a preview per PR (sticky comment),
`next` for `main`, production for `v*` tags. Inputs: `working-directory`, `install-directory`, `worker-name`,
`source-repo`/`source-ref` (a second repo checked out beside this one, for mirrors or docs that live there),
`node-version`, `production`, `deploy`. Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`SOURCE_REPO_TOKEN`. Without the Cloudflare secrets it builds and skips the deploy.

## Licences

MIT. Dependencies: `starlight-links-validator` (MIT); peers `astro` and `@astrojs/starlight` (MIT). Build-time
tools pulled in by Astro and Vite include Lightning CSS (MPL-2.0) and libvips via sharp (LGPL-3.0); neither ends
up in the built site.
