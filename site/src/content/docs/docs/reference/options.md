---
title: Options
description: Every projectSite() option with its type, default and description, generated from options.mjs and index.d.ts.
sidebar:
  order: 1
---

`projectSite(options)` takes one object. It is validated before Astro starts: an unknown key or a wrong type
fails with the field's path (`landing.hero.primary.href: …`, `unknown option "navv"`). Paths (`customCss`,
`components.*`, `ogImageFor`, `versionFrom`, `externalDocs[].dir`, `mirrors[].from`) are relative to the project
root (the folder of `astro.config.mjs`) and may point outside it; local files must exist.

Types and descriptions come from `src/index.d.ts`, defaults and required fields from the zod schema in
`src/options.mjs`; the generator fails if the two disagree on which options exist.

## projectSite()

<!-- gen:options -->
| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | **required** | Project name, shown in the header and titles. |
| `tagline` | `string` | **required** | One line under the name on the landing page and in meta descriptions. |
| `url` | `string` | **required** | Production URL. Also Astro's `site` unless that is set. |
| `repo` | `string` | **required** | Source repository, for "edit this page" and the header link. GitHub URL layout is assumed for file links. |
| `repoBranch` | `string` | `"main"` | Branch that edit links and links to repo files point at. Default `main`. |
| `versionFrom` | `string` |  | A package.json (relative to the project root) whose `version` the header shows. |
| `nav` | `LinkAction[]` |  | Top navigation, shared by every page. Default: Docs, and Gallery unless `gallery: false`. |
| `externalDocs` | `ExternalDocs[]` | `[]` | Markdown folders outside the site, mounted under /docs/&lt;route>/. |
| `docsOrder` | `string[]` | `[]` | The order of the top-level docs sections, in the sidebar and in the docs cards (the /docs/ page and the landing page): mount routes (`externalDocs[].route`, e.g. `reference`) and folders of `src/content/docs/docs/` (e.g. `guide`). Listed sections come first, in this order; the rest follow in the default order (mounts as configured, then your own folders by name). Pages directly in `src/content/docs/docs/` always come first. An unknown name fails the build. Default: none. |
| `mirrors` | `Mirror[]` | `[]` | Static HTML/JS folders copied into the build byte for byte (and served from disk in dev). |
| `install` | `string` |  | Install command shown on the landing page. |
| `favicon` | `string` | `"/favicon.svg"` | Favicon path under public/. Default `/favicon.svg`. |
| `head` | `HeadTag[]` | `[]` | Tags added to the `<head>` of every page: landing, gallery, your BaseLayout pages and docs. |
| `ogImage` | `string` |  | Default social image: a path under public/ (1200×630) or an absolute URL. |
| `ogImageFor` | `string` |  | Module (relative to the project root) whose default export is an `OgImageHook`, for per-page images. |
| `theme` | `object` | `{}` | Accent colour overrides. For more, override the `--site-*` tokens in `customCss`. |
| `theme.accent` | `string` |  |  |
| `theme.accentDark` | `string` |  |  |
| `landing` | `false \| LandingContent` | `{}` | Content of the built-in landing page at `/`, or `false` for none (or add your own src/pages/index.astro). |
| `gallery` | `false \| { route?: string; title?: string; description?: string }` | `{}` | The built-in gallery page, or `false` for none. `route` is its URL path (default `gallery`: /gallery/); `title` and `description` default to the `gallery` and `galleryDescription` labels. |
| `blog` | `boolean \| BlogOptions` | `false` | Posts from src/content/blog/ at /blog/ (list, posts, tags, RSS), or `true` for the defaults. Off unless set. |
| `footer` | `object` | `{}` | Footer text. `note`: extra text, e.g. a licence line. `copyright`: the copyright line, with `{year}` (the build year) and `{name}` filled in; default the `copyright` label ("© {year} {name}"); `false` leaves it out. |
| `footer.note` | `string` |  |  |
| `footer.copyright` | `string \| false` |  |  |
| `labels` | `Partial<Labels>` | `{}` | The words the template puts on pages (buttons, screen-reader names, empty states, alert titles), by name. They follow the site's language (Starlight's root or default locale): built in for English, French, German and Spanish, English for anything else. Set any of them here, in any language. |
| `llms` | `boolean` | `true` | Serve /llms.txt and /llms-full.txt. Default `true`. |
| `linksValidator` | `false \| Record<string, unknown>` |  | Options for starlight-links-validator, which fails the build on a broken link in a docs page, or `false` to turn it off. Links to the landing page, the gallery, llms.txt and mirrored folders are always accepted; `exclude` adds to that list. |
| `customCss` | `string[]` | `[]` | Stylesheets (relative to the project root) loaded on every page after theme.css: override tokens here. |
| `components` | `ComponentOverrides` | `{}` | Replace built-in components. |
| `starlight` | `Record<string, unknown>` | `{}` | Extra Starlight options, passed through. List options are appended to the ones projectSite() sets: `sidebar` (after the generated sidebar), `plugins`, `customCss` (docs pages only), `routeMiddleware`, `markdown.processedDirs`. `components` entries override ours (e.g. your own `Header` replaces the shared one). |
| `markdown` | `MarkdownOptions` | `{}` | GitHub-flavoured markdown extras, on every page that renders markdown. Each switch defaults to `true`. |
<!-- /gen -->

When `nav` is not set it defaults to Docs (`/docs/`), plus Gallery (`/gallery/`) unless `gallery: false`.
`url` and `repo` lose any trailing slash.

## ExternalDocs

An entry of `externalDocs`. See [Docs: mounting external markdown](/docs/guides/docs/#mount-markdown-from-elsewhere).

<!-- gen:interface name=ExternalDocs -->
| Field | Type | Required | Description |
|---|---|---|---|
| `dir` | `string` |  | Markdown folder, relative to the project root. May be outside it (`../docs`). Give this or `git`. |
| `git` | `GitSource` |  | A folder of another repository instead of a local one: downloaded at build time (a shallow, sparse fetch with the `git` command), cached in Astro's cache folder, then mounted like `dir`. Links to its files that are not mounted go to that repository at `ref`; "Edit page" goes to its default branch. |
| `route` | `string` | yes | URL segment under /docs/: `reference` → /docs/reference/... |
| `label` | `string` | yes | Sidebar group label. |
| `description` | `string` |  | One sentence on what the section holds: its card on /docs/ and the landing page, and the meta description of its README page. Defaults to the README's frontmatter `description`, then its first paragraph. |
| `order` | `string[]` |  | File names (relative to `dir`, `.md` optional) listed first, in this order. README.md always leads. |
| `exclude` | `string[]` |  | Globs relative to `dir` to leave out, e.g. `['plans/**']`. |
| `include` | `string[]` |  | Globs relative to `dir`; when given, only matching markdown files are mounted. Matched against the whole path (`README.md` is the top-level one only); a glob that matches a folder covers its contents. Lets a mount pick files from the repository root: `{ dir: '..', route: 'project', label: 'Project', include: ['README.md', 'CHANGELOG.md'] }`. The site's own folder, dot-folders and node_modules are never mounted. |
<!-- /gen -->

## Mirror

An entry of `mirrors`. See [Mirrors](/docs/guides/mirrors/).

<!-- gen:interface name=Mirror -->
| Field | Type | Required | Description |
|---|---|---|---|
| `from` | `string` | yes | Folder to serve as-is, relative to the project root. May be outside it (`../`). |
| `to` | `string` | yes | URL prefix: `apps` → /apps/... Nested prefixes (`pixel/src`) work. |
| `include` | `string[]` |  | Globs relative to `from`; when given, only matching paths are mirrored. |
| `exclude` | `string[]` |  | Globs relative to `from`; matching paths are skipped. |
<!-- /gen -->

## LandingContent

The `landing` option. Every part is optional; a section without content is not rendered.
See [Landing page](/docs/guides/landing-page/).

<!-- gen:interface name=LandingContent -->
| Field | Type | Required | Description |
|---|---|---|---|
| `hero` | `object` |  |  |
| `hero.title` | `string` |  | Big heading; defaults to `name`. |
| `hero.lead` | `string` |  | Paragraph under the heading; defaults to `tagline`. |
| `hero.primary` | `LinkAction` |  |  |
| `hero.secondary` | `LinkAction` |  |  |
| `hero.demo` | `HeroDemo` |  | A live example under the hero copy (rendered with `<Live>`). |
| `features` | `SectionContent<Feature>` |  | Feature cards. Default heading: the `featuresTitle` label ("Why it exists"). |
| `docs` | `false \| { title?: string; intro?: string }` |  | Cards for the top-level docs sections, shown when there are no `features` and the docs have at least two sections. Default heading: the `documentation` label. `false` hides them. |
| `steps` | `SectionContent<Step>` |  | Numbered steps. Default heading: the `stepsTitle` label ("How it works"). |
| `gallery` | `object` |  | The gallery strip: heading, intro and how many items (0 hides it; default 3). |
| `gallery.title` | `string` |  |  |
| `gallery.intro` | `string` |  |  |
| `gallery.limit` | `number` |  |  |
| `cta` | `object` |  |  |
| `cta.title` | `string` | yes |  |
| `cta.body` | `string` |  |  |
| `cta.primary` | `LinkAction` |  |  |
| `cta.secondary` | `LinkAction` |  |  |
<!-- /gen -->

`features` and `steps` take either an array of items or `{ title, intro, items }`. The default headings are
"Why it exists" (with the intro "The short version, for people deciding whether to read on.") and
"How it works".

### Feature

<!-- gen:interface name=Feature -->
| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | yes |  |
| `body` | `string` | yes |  |
| `href` | `string` |  | Makes the whole card a link. |
<!-- /gen -->

### Step

<!-- gen:interface name=Step -->
| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | yes |  |
| `body` | `string` | yes |  |
| `code` | `string` |  | Code shown next to the step, highlighted at build time. |
| `lang` | `string` |  | Shiki language id, e.g. `js`, `ts`, `sh`. |
<!-- /gen -->

### LinkAction

Used by `nav`, `hero.primary`/`secondary` and `cta.primary`/`secondary`.

<!-- gen:interface name=LinkAction -->
| Field | Type | Required | Description |
|---|---|---|---|
| `label` | `string` | yes |  |
| `href` | `string` | yes |  |
<!-- /gen -->

### HeroDemo

`landing.hero.demo`: a [`<Live>`](/docs/reference/live/) example under the hero copy.

<!-- gen:interface name=HeroDemo -->
| Field | Type | Required | Description |
|---|---|---|---|
| `code` | `string` | yes |  |
| `lang` | `string` |  |  |
| `title` | `string` |  |  |
| `caption` | `string` |  |  |
| `mode` | `'inline' \| 'iframe'` |  |  |
| `preview` | `'above' \| 'below' \| 'side'` |  |  |
| `runner` | `string` |  |  |
| `editable` | `boolean` |  |  |
| `options` | `Record<string, unknown>` |  |  |
| `modules` | `string[]` |  |  |
| `base` | `string` |  |  |
| `height` | `number \| string` |  |  |
<!-- /gen -->

## ComponentOverrides

The `components` option. Values are paths relative to the project root, or package specifiers.
See [Overriding components](/docs/guides/overriding-components/).

<!-- gen:interface name=ComponentOverrides -->
| Field | Type | Required | Description |
|---|---|---|---|
| `Header` | `string` |  | The header bar contents on every page, docs included. Receives the `search`, `theme` and `theme-menu` slots. |
| `Footer` | `string` |  | The footer on every page, docs included. Receives `variant: 'page' \| 'docs'`. |
| `Hero` | `string` |  | The landing page's hero. Receives the Hero props (title, lead, primary, secondary, install) and a `live` slot. |
| `Landing` | `string` |  | The whole landing page body (inside BaseLayout). |
| `GalleryCard` | `string` |  | One gallery card. Receives `item: GalleryEntry` and `headingLevel`. |
| `Gallery` | `string` |  | The whole /gallery/ page body (inside BaseLayout). Receives `items`, `title`, `description`. |
| `BlogIndex` | `string` |  | The post list body (inside BaseLayout): /blog/, /blog/2/, and each /blog/tags/&lt;tag>/. Receives `BlogIndexProps`. |
| `BlogPost` | `string` |  | One post page body (inside BaseLayout). Receives `BlogPostProps`; the rendered post is its default slot. |
| `BlogCard` | `string` |  | One post in a list (blog index, tag pages, landing "Latest posts"). Receives `post: BlogEntry`, `headingLevel`. |
<!-- /gen -->

## OgImageRequest

What an `ogImageFor` module's default export (`OgImageHook`) receives. It returns a root-relative or absolute
image URL, or `undefined` for none.

<!-- gen:interface name=OgImageRequest -->
| Field | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | yes | Path of the page, e.g. `/gallery/` or `/docs/reference/api/`. |
| `title` | `string` | yes |  |
| `description` | `string` | yes |  |
<!-- /gen -->
