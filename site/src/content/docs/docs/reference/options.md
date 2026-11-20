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
| `gallery` | `false \| { title?: string; description?: string }` | `{}` | The built-in /gallery/ page, or `false` for none. |
| `footer` | `object` | `{}` | Extra footer text, e.g. a licence line. |
| `footer.note` | `string` |  |  |
| `llms` | `boolean` | `true` | Serve /llms.txt and /llms-full.txt. Default `true`. |
| `linksValidator` | `false \| Record<string, unknown>` |  | Options for starlight-links-validator, which fails the build on a broken link in a docs page, or `false` to turn it off. Links to the landing page, the gallery, llms.txt and mirrored folders are always accepted; `exclude` adds to that list. |
| `customCss` | `string[]` | `[]` | Stylesheets (relative to the project root) loaded on every page after theme.css: override tokens here. |
| `components` | `ComponentOverrides` | `{}` | Replace built-in components. |
| `starlight` | `Record<string, unknown>` | `{}` | Extra Starlight options, passed through. List options are appended to the ones projectSite() sets: `sidebar` (after the generated sidebar), `plugins`, `customCss` (docs pages only), `routeMiddleware`, `markdown.processedDirs`. `components` entries override ours (e.g. your own `Header` replaces the shared one). |
<!-- /gen -->

When `nav` is not set it defaults to Docs (`/docs/`), plus Gallery (`/gallery/`) unless `gallery: false`.
`url` and `repo` lose any trailing slash.

## ExternalDocs

An entry of `externalDocs`. See [Docs: mounting external markdown](/docs/guides/docs/#mount-markdown-from-elsewhere).

<!-- gen:interface name=ExternalDocs -->
| Field | Type | Required | Description |
|---|---|---|---|
| `dir` | `string` | yes | Markdown folder, relative to the project root. May be outside it (`../docs`). |
| `route` | `string` | yes | URL segment under /docs/: `reference` → /docs/reference/... |
| `label` | `string` | yes | Sidebar group label. |
| `order` | `string[]` |  | File names (relative to `dir`, `.md` optional) listed first, in this order. README.md always leads. |
| `exclude` | `string[]` |  | Globs relative to `dir` to leave out, e.g. `['plans/**']`. |
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
| `features` | `SectionContent<Feature>` |  | Feature cards. Default heading "Why it exists". |
| `steps` | `SectionContent<Step>` |  | Numbered steps. Default heading "How it works". |
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
