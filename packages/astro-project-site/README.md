# astro-project-site

An Astro integration for open-source project sites: a landing page, Starlight docs that mount your project's own
markdown folder, live examples, a gallery, static HTML/JS apps served as they are, and Cloudflare Workers deploys
with a preview per pull request. Astro 7 + Starlight 0.43. MIT.

```bash
cd my-lib                                # your project's repository
npx astro-project-site@beta init website      # the package's only bin is `project-site`
cd website && npm install && npm run dev
```

## Start a project

Run `project-site init <dir>` in your repository. It reads the repository and writes a ready site into `dir`:

| it reads | and makes |
|---|---|
| `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `composer.json` or `*.gemspec` | name, tagline, version badge (`versionFrom`), install command, licence, blog author |
| the git `origin` remote and default branch | `repo`, `repoBranch` (edit links, links to source files) |
| `README.md`: first H1, first paragraph, bullets under Features/Highlights/Why, code under Install/Usage/Getting started | the landing page: hero, feature cards, steps |
| `docs/` (or `doc/`, `documentation/`) | mounted under `/docs/reference/` |
| `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md` | mounted under `/docs/project/` (`externalDocs` with `include`) |
| `LICENSE` | the footer note ("Released under the MIT licence.") |
| `examples/`, `demo/`, `demos/`, `playground/` (and other top-level folders with an `index.html`) holding HTML pages | mirrored under `/apps/` with the folders they load from (`../src/`), one gallery entry per page |
| the README again | a first blog post, `src/content/blog/<date>-introducing-<name>.md`, as a draft (`draft: true`) to read through |

`astro.config.mjs` comes out as commented config naming where each value came from; values it could not find are
placeholders marked `TODO`. Also written: `src/content.config.ts`, `package.json` (scripts, this package as a
dependency), `wrangler.jsonc` named after the project, `.gitignore`. With `--ci`, also the GitHub workflow
(checks, a preview per pull request, production on tags), pinned to this release (with `working-directory` when
the site is a subfolder: move it to the repo root's `.github/workflows/`). Without it, the site deploys from your
machine with `npm run deploy`.

It prints what it found and the files it will write, then asks (`--yes` skips the question; without a terminal,
`--yes` or `--dry-run` is required). It only writes inside `dir` and never overwrites a file without `--force`.
The repository read is `dir`'s parent when `dir` is inside a git repository, otherwise the current folder;
`--from <dir>` picks another. In an empty folder you get placeholders and example docs and apps; `--blank` always
copies that plain starter.

```bash
npx astro-project-site@beta init website --dry-run         # what it would do
npx astro-project-site@beta init website --yes --name "My Lib"
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
- overrides Starlight's `Header` (the shared site header), `Footer` (last updated and prev/next, then the shared site
  footer), `PageTitle` (the page header below), `Sidebar` (a filter box above long sidebars) and `MobileMenuFooter`
  (the site nav inside Starlight's mobile menu, so small screens have one menu button);
- adds a Starlight route middleware that gives docs pages the same `og:image` as every other page;
- loads `theme.css` everywhere and `docs.css` (the docs look: type scale, sidebar, TOC, code frames, tables, asides,
  prev/next) on docs pages, then your `customCss`;
- injects pages: `/` (landing), `/gallery/`, `/llms.txt`, `/llms-full.txt`, and with `blog` on, `/blog/…` and
  `/blog/rss.xml`. A page of your own at the same path
  (e.g. `src/pages/index.astro`) always wins, and each can be switched off (`landing: false`, `gallery: false`,
  `llms: false`);
- injects an overview page for every docs folder that has pages but no index page (`/docs/guides/` when there is no
  `guides/index.md`): the docs layout with a card per page and subfolder (title, description). Adding an index page
  replaces it;
- serves the markdown of every docs page next to it (`/docs/guides/configure/` → `/docs/guides/configure.md`);
- serves a monogram favicon (the first letter of `name` on the accent colour) when `public/` has none;
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
| `externalDocs` | `{ dir, route, label, order?, exclude?, include? }[]` | `[]` | Markdown folders mounted under `/docs/<route>/`. `order`: file names listed first. `exclude`: globs. `include`: only these (globs matched against the whole path, a folder covers its contents), e.g. `{ dir: '..', route: 'project', label: 'Project', include: ['README.md', 'CHANGELOG.md'] }`. The site's own folder, dot-folders and `node_modules` are never mounted; a file belongs to the deepest mount that accepts it. |
| `mirrors` | `{ from, to, include?, exclude? }[]` | `[]` | Folders served byte for byte under `/<to>/`. Globs (here, in `externalDocs.exclude` and docs-gen `files`): `*`, `?`, `**`, `{a,b}`, `[…]`. |
| `install` | `string` | | Install command on the landing page. |
| `favicon` | `string` | `'/favicon.svg'` | Under `public/`. |
| `head` | `{ tag, attrs?, content? }[]` | `[]` | Tags added to the `<head>` of every page, docs included (Starlight's `head` shape; `starlight.head` adds docs-only tags after these). |
| `ogImage` | `string` | | Default social image (path under `public/` or URL). |
| `ogImageFor` | `string` | | Module whose default export is `(page: { path, title, description }) => string \| undefined`, for per-page images. Used on every page, docs included. |
| `theme` | `{ accent?, accentDark? }` | | Accent colours. For more, override tokens in `customCss`. |
| `landing` | `LandingContent \| false` | `{}` | Content of the built-in landing page (below), or no landing page. |
| `gallery` | `{ title?, description? } \| false` | `{}` | The `/gallery/` page, or none. |
| `blog` | `boolean \| BlogOptions` | `false` | Posts from `src/content/blog/` at `/blog/` (below). `true` = defaults. |
| `footer` | `{ note? }` | | Extra footer line, e.g. a licence. |
| `llms` | `boolean` | `true` | `/llms.txt` and `/llms-full.txt`. |
| `customCss` | `string[]` | `[]` | Stylesheets loaded on every page after `theme.css`. |
| `components` | `ComponentOverrides` | `{}` | Replace built-in components (below). |
| `linksValidator` | `object \| false` | | starlight-links-validator options (`exclude` is added to the built-in list of non-docs pages), or off. |
| `starlight` | `object` | `{}` | Extra Starlight options (below). |
| `markdown` | `{ alerts?, emoji?, math?, mermaid?, headingLinks?, codeWrapToggle? }` | all `true` | GitHub-flavoured markdown extras (below). |

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
| `BlogIndex` | the post list body: `/blog/`, `/blog/2/`, each `/blog/tags/<tag>/` | `BlogIndexProps`: `posts, title, description, tag?, tags, page` |
| `BlogPost` | one post's body (inside `BaseLayout`) | `BlogPostProps`: `post, readingTime, authors, editUrl?, newer?, older?`; the rendered post is the default slot |
| `BlogCard` | one post in a list (index, tag pages, landing "Latest posts") | `post: BlogEntry, headingLevel, variant: 'row' \| 'tile'` |

An override can wrap the built-in: `import { SiteHeader } from 'astro-project-site/components'` is always the
original.

### `blog`

```ts
blog: true | {
  route?: string;          // 'blog' → /blog/
  title?: string;          // 'Blog' (heading, nav label, feed title)
  description?: string;    // default: tagline
  authors?: Record<string, { name: string; url?: string; avatar?: string }>;
  postsPerPage?: number;   // 10; more pages at /blog/2/, /blog/3/
  rss?: boolean;           // true → /blog/rss.xml, plus <link rel="alternate"> on every page, docs included
  landing?: false | { title?: string; limit?: number };  // "Latest posts" on the built-in landing; { 'Latest posts', 3 }
}
```

Posts are `src/content/blog/**/*.{md,mdx}`; the `blog` collection is registered by `projectSiteCollections()`
(no warning when the folder does not exist). A post's id and URL is its path without the extension, lowercased with
spaces as dashes: `src/content/blog/2026/introducing-my-lib.md` → `/blog/2026/introducing-my-lib/`; a folder's
`index.md(x)` takes the folder's id, so a post can keep its images beside it. Ids that would collide with a built-in
page (`2`, `tags/…`, `rss.xml`) fail the build with the file's name.

```yaml
---
title: Introducing my-lib          # required
description: One or two sentences. # required: lists, feed, meta description
date: 2026-11-20                   # required
updated: 2026-11-21
authors: [pavel, A Guest]          # keys of blog.authors, or plain names
tags: [release, astro]
draft: true                        # built in dev only, with a Draft badge
image: ./cover.png                 # optimised; shown on the post and in lists; the post's og:image
imageAlt: ''
canonical: https://elsewhere.dev/post  # when first published elsewhere
---
```

A missing required field stops the build with `Blog post src/content/blog/x.md: invalid frontmatter.` and the
field. Pages: `/blog/` (paginated), each post (title, dates, reading time computed at build, authors, tags,
newer/older, "Edit this post" to the file in the repo, `og:type article`), `/blog/tags/`, `/blog/tags/<tag>/`,
`/blog/rss.xml`. Posts are listed in `/llms.txt` (a section before `## Optional`), appended in full to
`/llms-full.txt`, and in the sitemap. The single route `/blog/[...path]` builds the list, posts and tag pages; a
`src/pages/blog/[...path].astro` (or `rss.xml.ts`) of your own replaces it.

The feed is a **summary** feed: each item is the title, absolute link, date, description, tags (`<category>`) and
authors (`<dc:creator>`). Full content is left out on purpose: MDX posts hold live examples and components that a
feed reader cannot run, and a half-rendered post is worse than a link to the real one.

Posts render in a reading column (`.blog-prose`, from `components/blog/prose.css`): ~68ch, Expressive Code blocks as
in the docs, tables that scroll in their own box, footnotes, print styles. Tokens: `--blog-font`, `--blog-font-size`,
`--blog-measure`, `--blog-leading`. `<Live>` works in posts (`import Live from 'astro-project-site/live'`).
`LatestPosts` (`{ title?, intro?, limit?, tone? }`) is exported for custom landing pages.

### Margin notes

```mdx
import { MarginNote } from 'astro-project-site/components'; // or: import MarginNote from 'astro-project-site/margin-note'

The loader reads the folder at build time.<MarginNote kind="field" numbered>Measured on 300 pages: 40 ms.</MarginNote>
```

A side note anchored where it is written. In a blog post on a wide screen it hangs in the margin beside its line
(numbered notes put a small number at the anchor and beside the note); in a docs page it floats beside the paragraph
inside the column; on narrow screens it is an inline aside right after the anchor, with its label. It stays in the
reading order (`role="note"`, never hidden), so screen readers and copy-paste meet it right after its text. Props:
`kind` (`note` | `field` | `warning`), `label` (default "Note", "Field note", "Warning"; `''` for none),
`numbered`, `id`. Write it inline (no blank lines inside) to anchor it to a phrase, or on its own line between
paragraphs. Your own layout can host margin notes: `container: margin-notes / inline-size` on the element around the
text, with ~18rem free on its inline-end side once it is 58rem wide.

### `starlight`

Passed to Starlight. List options are **appended** to the ones projectSite() sets: `sidebar` (after the generated
sidebar), `plugins`, `customCss` (docs pages only, after `customCss`), `head` (after `head`), `routeMiddleware`,
`markdown.processedDirs`. `components` entries override ours (your own `Header` replaces the shared header on docs
pages). The shared header shows whatever `Search` Starlight resolved (a `components.Search` override or a search
plugin). Everything else
(`head`, `locales`, `lastUpdated`, `pagefind`, `social`, `editLink`, …) is set as given.

## Exports

| import | what |
|---|---|
| `astro-project-site` | `default projectSite(options)`, `mirror(entries)`, `OPTION_NAMES` (every top-level option name), `COMPONENT_NAMES` (the `components` slots); types `ProjectSiteOptions`, `LandingContent`, `ComponentOverrides`, `SiteConfig`, `GalleryEntry`, `GalleryData`, `OgImageHook`, `LiveRunner`, `LiveContext`, `LiveProps`, … |
| `astro-project-site/components` | `Live`, `BaseLayout`, `SiteHead`, `SiteHeader`, `SiteFooter`, `ThemeSelect`, `Landing`, `Hero`, `Section`, `Features`, `Steps`, `GalleryStrip`, `CallToAction`, `InstallCommand`, `ChildCards`, `GalleryPage`, `GalleryGrid`, `GalleryCard`, `GalleryFilters`, `BlogIndex`, `BlogPost`, `BlogCard`, `BlogTags`, `PostMeta`, `TagList`, `LatestPosts`, `MarginNote`; helpers `galleryItems()`, `distinct()`, `isActive()`, `isExternal()`, `blogPosts()`, `postInfo()`, `readingTime()`, `tagSlug()`, `formatDate()` |
| `astro-project-site/margin-note` | the `<MarginNote>` component alone |
| `astro-project-site/live` | the `<Live>` component alone (`import Live from 'astro-project-site/live'`): lighter than the barrel, which also brings the layout and landing components |
| `astro-project-site/content` | `projectSiteCollections({ docsExtend?, galleryBase?, blogBase? })` → `{ docs, gallery, i18n, blog }`; `gallerySchema`, `blogSchema`, `blogLoader`, `projectDocsLoader` |
| `astro-project-site/config` | the validated options plus `version` (`SiteConfig`), for your own pages; also `OPTION_NAMES`, `COMPONENT_NAMES` |
| `astro-project-site/theme.css` | the design tokens (loaded automatically; import it only in pages that use neither BaseLayout nor Starlight) |

Types for the virtual modules behind these (`virtual:astro-project-site/*`) are injected into `.astro/` by the
integration, so `astro check` passes without setup.

## Docs navigation and page chrome

Everything here comes from the folder structure and frontmatter; there is nothing to configure.

- **Sidebar.** Generated groups have section headers; nested folders are collapsible groups. In a small docs site
  (up to 15 pages) every group is open; above that every group starts collapsed and the current page's branch opens,
  and a filter box (`/` focuses it) narrows the tree. A group whose folder has no index page starts with an
  "Overview" link to the automatic overview page. Groups you add under `starlight.sidebar` are left as given.
- **Page header.** Breadcrumbs (the docs home, then each group above the page, linked to its index or overview
  page), the title, the frontmatter `description` (pages in `src/content/docs/`; a mounted page's description is its
  first paragraph, already on the page), and actions: *Copy page* (the page's markdown, for pasting into an LLM),
  *Markdown* (the `.md` twin) and Starlight's edit link.
- **End of page.** Last updated (when `starlight.lastUpdated` is on), then prev/next following the sidebar
  (including the overview links; frontmatter `prev`/`next` still win).
- **Search** is in the header of every page, docs or not.

`<ChildCards>` puts the same card grid on any docs page, e.g. a folder's own index page:

```mdx
import { ChildCards } from 'astro-project-site/components';

<ChildCards />                          {/* the children of this page's folder */}
<ChildCards dir="docs/guides" exclude={['docs/guides/upgrading']} />
```

Props: `dir` (collection id or path; default the current page), `exclude` (ids or paths), `label` (accessible name).
On a docs page the cards follow the sidebar order, elsewhere `sidebar.order` then title. The built-in landing page
uses it too: with no `landing.features`, the top-level docs sections fill that place (when there are two or more).

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

From a script, the rendered `<live-example>` element (type `LiveExampleElement`) reads and replaces its code:

```js
await customElements.whenDefined('live-example');
const example = document.querySelector('live-example#live-edit-me');
example.getSource();                  // what runs now (the editor's text when editable)
example.setSource('<b>new code</b>'); // re-runs; editable examples show it in the editor, Reset restores the original
```

Keyboard: in an editable example Tab indents; press Escape, then Tab, to move on. If a runner or module cannot be
fetched, the example says so (the browser's own error is under Details) and offers Retry.

## Markdown

Markdown renders as on GitHub on every page that has it (docs, `externalDocs` folders, blog posts, your own `.md`
pages); the plugins sit on Astro's global markdown processor. GFM (tables with alignment, task lists, strikethrough,
autolinks, footnotes, raw HTML), GitHub-compatible heading ids, alerts (`> [!NOTE]` …), emoji shortcodes, math
(`$…$`, `$$…$$`, ```` ```math ````, KaTeX at build time, its CSS linked only where used) and ```` ```mermaid ````
diagrams (Mermaid loaded only on pages with diagrams, themed from the tokens; `mermaid` is an optional peer
dependency: `npm i mermaid` to draw them, otherwise they show their source with a note). Code blocks are Expressive Code with
line numbers, collapsible sections, terminal prompts that are not copied and a wrap toggle; set more through
`starlight.expressiveCode`. Each extra can be switched off with `markdown: { math: false, … }`. Raw HTML is not
sanitised (the markdown is the project's own). The full list, with source and result side by side, is the site's
[Markdown guide](https://astro-project-site.pascaripavel.workers.dev/docs/guides/markdown/).

## Theme

The landing, gallery and docs pages use the same language and direction: pages outside the docs take `lang`/`dir`
from Starlight's root locale (or `defaultLocale`) in `starlight.locales`, else `en`. Setting `starlight.title`,
`description` or `favicon` changes the docs only and logs a warning; use `name`, `tagline`, `favicon`.

The landing and gallery components import `styles/components.css` (the `site-container`, `site-btn`,
`site-visually-hidden` classes and build-time code styles), so they look the same when used inside a docs page.

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
project-site init [dir] [--from <repo>] [--yes] [--dry-run] [--force] [--blank] [--ci] [--name "My Lib"] [--package <npm spec>]
project-site docs:gen [--check] [--config docs-gen.config.mjs]
project-site docs:check
project-site deploy:preview [--alias pr-12] [--message "…"] [--dry-run] [-- <wrangler args>]
```

- **docs:gen** fills `<!-- gen:name key=value -->…<!-- /gen -->` blocks in markdown using generators from
  `docs-gen.config.mjs` (`export default { files: [...], generators: { name: async ({ args, file, relFile, root, current }) => string } }`).
  `--check` changes nothing and exits 1 with a diff when a block is stale.
- **deploy:preview** uploads `dist/` as a Cloudflare Worker version under a stable preview alias (default: the git
  branch). It uses the project's own `wrangler` (a devDependency) and fails if there is none; this package does not
  depend on wrangler.

## Deploys and CI

The starter deploys as a static-assets Worker (`wrangler.jsonc`, `public/_headers`): `npx wrangler login` once,
then `npm run deploy`. CI is optional (`init --ci`, or add the file yourself); all of it is:

```yaml
on: [pull_request, push, workflow_dispatch]
jobs: { site: { uses: pavelpascari/astro-project-site/.github/workflows/deploy.yml@v0.1.0-beta.4, permissions: { contents: read, pull-requests: write }, secrets: { CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}", CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}" } } }
```

`init --ci` pins the workflow to the release it came from (`@v<version>`); a full commit SHA is the stricter option.
Pass only the secrets the workflow declares, never `secrets: inherit`.

The reusable workflow type-checks, builds, runs `docs:check`, and deploys: a preview per PR (sticky comment),
`next` for `main`, production for `v*` tags. Fork PRs never reach the deploy job. Everything that runs with the
Cloudflare secrets (wrangler, `project-site deploy:preview`) is the lockfile-pinned copy from the project's
`node_modules` (`npx --no-install`); a project without wrangler in its devDependencies fails with a clear message
instead of downloading one. Inputs: `working-directory`, `install-directory`, `worker-name`, `source-repo`/`source-ref`
(a second repo checked out beside this one, for mirrors or docs that live there), `node-version`, `production`,
`deploy`. Secrets (all optional): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SOURCE_REPO_TOKEN`. Without the
Cloudflare secrets it builds and skips the deploy.

### Workflow security

- **Pinned actions.** Every third-party action in this repository's workflows (`ci.yml`, `deploy.yml`,
  `release.yml`) is pinned to a full commit SHA with its version in a comment. Dependabot proposes updates weekly
  (grouped, after a 7-day cooldown) for the actions and the npm workspace. Your `site.yml` pins `deploy.yml` to a
  release tag; enable Dependabot's `github-actions` updates in your repository to get bumps, or pin a commit SHA.
- **Least privilege.** Workflows default to no permissions (`permissions: {}`); each job asks for what it uses:
  `contents: read` to check out, `pull-requests: write` only in the deploy job that posts the preview comment.
  Checkouts never keep the token (`persist-credentials: false`).
- **Forks and untrusted input.** Nothing runs on `pull_request_target`, and `deploy.yml` refuses to be called from
  it or from `workflow_run`. Fork PRs are built with a read-only token and no secrets; the deploy job never runs for
  them. The Cloudflare secrets are only in the environment of the steps that call Cloudflare, not of `npm ci`, and
  that job installs without a dependency cache. Inputs are validated before use: `working-directory` and
  `install-directory` must stay inside the repository, `worker-name` must be a Worker slug, `source-repo` must be
  `owner/name`. Event data and inputs reach shell steps through `env:`, never interpolated into scripts.
- **Releases.** A `v<version>` tag matching `package.json` runs `release.yml`: a read-only job runs the tests and the
  full build, then packs the tarball and its SHA-256 (no dependency cache). A second job, which runs no project
  code, verifies the checksum, creates the GitHub release and stages that tarball on npm through trusted
  publishing (OIDC, `id-token: write`): there is no npm token to leak, and npm records provenance for public repositories.
  A staged version goes live only when a maintainer approves it with 2FA, so a compromised workflow cannot publish.
- **Audited** with [zizmor](https://docs.zizmor.sh) (including `--persona=pedantic`) and
  [actionlint](https://github.com/rhysd/actionlint); remaining exceptions are commented inline.

## Development

`npm test` runs the unit tests (`node --test`). The responsive/UX check is separate because it needs browsers:
it drives Chromium, Firefox and WebKit through Playwright against a running site and fails on what users would hit.

```bash
# once: Playwright lives outside the repo (it is not a dependency)
mkdir -p /tmp/pw && (cd /tmp/pw && npm i playwright && npx playwright install chromium firefox webkit)

npm run build && (cd site && npx astro preview --port 4433 &)
PLAYWRIGHT_DIR=/tmp/pw node packages/astro-project-site/test/ux/ux-check.mjs --url http://localhost:4433 --out ux-report
```

Options: `--engines chromium,firefox,webkit`, `--pages /,/docs/` (default: the sitemap plus pages linked from it, and a
missing page for the 404), `--max-pages 40`, `--quick` (Chromium, four viewports), `--no-shots`. It writes
`report.md`, `report.json` and `shots/*.png` (plus print PDFs) and exits 1 on any error-level finding; warnings never fail.

What it checks, on every page:

- **Layout** at 320×568 through 2560×1440, phones in landscape, tablets both ways, 200% and 400% zoom (WCAG 1.4.10)
  and a 32px default font size: no horizontal page scroll (wide tables and code scroll in their own, focusable box);
  header items never overlap, leave the screen or wrap out of the bar, also with a long project name and eight nav
  items injected (stress test); line length.
- **Input**: targets under 24×24 without spacing (WCAG 2.5.8) fail, under 44×44 on touch viewports warn; the tab
  order walked to the end with a visible focus indicator at every stop, never under the sticky header; skip link;
  Live editor keyboard (Tab indents, Escape then Tab leaves); copy buttons announce through a live region.
- **Menus**: the site menu (opens, `aria-expanded`, fits short screens, Escape returns focus, closes on focus leaving,
  click outside and on a link) and Starlight's mobile menu (one menu button, the site nav inside, scroll lock, focus
  trap, Escape); search dialog; gallery filters announce the result count.
- **Preferences**: no flash of the wrong theme for stored × OS theme; `prefers-reduced-motion` (no smooth scroll or
  running animations); forced colours (pressed/current states and focus still visible); `prefers-contrast: more`;
  text contrast AA in both themes computed from the rendered colours, plus a token-pair table.
- **Semantics**: `lang`, one `main` and `h1`, heading order, duplicate ids, `alt`, accessible names, landmark labels.
- **Other**: console errors and failed requests, broken internal links, viewport meta (zoom allowed; `viewport-fit=cover`
  only with safe-area padding), layout shift (CLS), image dimensions and lazy loading, JS/CSS bytes per page, and the
  docs print stylesheet (no navigation chrome).

Pages that are not built by Astro (mirrored apps under `mirrors`) are checked too, but their findings are warnings:
they are the project's own files.

## Licences

MIT. Dependencies: `starlight-links-validator`, `@astrojs/rss`, `katex`, `gemoji`, `hast-util-from-html`,
`@expressive-code/core`, `@expressive-code/plugin-line-numbers`, `@expressive-code/plugin-collapsible-sections`
(MIT), `github-slugger` (ISC); peers `astro` and `@astrojs/starlight` (MIT), and optionally `mermaid` (MIT). Build-time
tools pulled in by Astro and Vite include Lightning CSS (MPL-2.0) and libvips via sharp (LGPL-3.0); neither ends
up in the built site.
