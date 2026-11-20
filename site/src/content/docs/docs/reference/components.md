---
title: Components
description: Every component exported from astro-project-site/components, with its props, defaults and slots.
sidebar:
  order: 2
---

```astro
---
import { BaseLayout, Hero, Features, Live } from 'astro-project-site/components';
---
```

Imports from `astro-project-site/components` are always the **built-in** components. The
[`components` option](/docs/guides/overriding-components/) changes what the injected pages render (and what
`GalleryGrid` uses for cards), not what this module exports, so an override can wrap the original.

Each component is shown rendered, with usage, in the guides:
[Landing page](/docs/guides/landing-page/), [Gallery](/docs/guides/gallery/),
[Live examples](/docs/guides/live-examples/), [Overriding components](/docs/guides/overriding-components/).

## Components

<!-- gen:components -->
### Live examples
#### Live

A live example: the code is written once, shown with Expressive Code and executed. Docs: the "Live examples" page of the astro-project-site docs. Expressive Code's &lt;Code>, imported without Starlight's component barrel and its stylesheet (see virtual.mjs).

| Prop | Type | Default | Description |
|---|---|---|---|
| `code` | `string` |  | The example's source. Omit it to use the fenced code block written as the component's child (MDX). |
| `lang` | `string` | `runner ? 'json' : 'html'` | Language of `code` for highlighting. Default: `html`, or `json` when a `runner` is set. |
| `title` | `string` |  | Title shown in the code frame (with `code`; for a fenced child use ```html title="…"). |
| `caption` | `string` |  | Caption under the example. |
| `id` | `string` | (computed) | Stable id and anchor (#id). Default: derived from caption or title, else from the source. |
| `mode` | `LiveMode` | `'inline'` | `inline` renders into the page; `iframe` renders in an isolated, auto-sized iframe. Default `inline`. |
| `preview` | `LivePreviewPosition` | `'above'` | Where the preview sits relative to the code. `side` falls back to stacked on narrow widths. Default `above`. |
| `editable` | `boolean` | `false` | Make the code editable; edits re-run the example (debounced) and a Reset button restores it. |
| `runner` | `string` |  | URL of a module exporting `run(source, mount, ctx)`. Without it the source is HTML and is rendered as-is. |
| `options` | `Record<string, unknown>` |  | Passed to the runner as `ctx.options`. Must be JSON-serialisable. |
| `modules` | `string[]` |  | Module URLs to load before the example runs (inline: once per page; iframe: in the iframe's head). |
| `head` | `string` |  | Extra HTML for the iframe's &lt;head> (styles, scripts, import maps). iframe mode only. |
| `base` | `string` |  | Base URL for relative paths inside the iframe (&lt;base href>). iframe mode only; passed to runners as ctx.base. |
| `sandbox` | `string` | (computed) | iframe sandbox tokens. Default `allow-scripts allow-same-origin allow-popups allow-forms allow-modals`. |
| `height` | `number \| string` |  | Minimum preview height (number = px, or any CSS length). Also the iframe's height before it measures itself. |
| `lazy` | `boolean` | `false` | Start only when scrolled near the viewport. |
| `debounce` | `number` | `300` | Debounce for re-running edits, in ms. Default 300. |
| `class` | `string` |  | Extra class on the root element. |

### Page frame and chrome
#### BaseLayout

Page frame for everything outside the docs: head metadata, the shared header and footer, theme and base styles. The header bar matches Starlight's so moving between the landing page and the docs feels like one site. The docs search (Starlight's Search, whatever it resolved to) is in the header here too, so search is one keystroke away on every page. Use it for a project's own pages too: import { BaseLayout } from 'astro-project-site/components';

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` |  |  |
| `description` | `string` |  |  |
| `image` | `string` |  | Social image for this page (defaults to the `ogImage` option / `ogImageFor` hook). |
| `noindex` | `boolean` |  |  |

Slots: `head`, `default`.

#### SiteHead

&lt;head> contents for pages outside Starlight: title, description, canonical URL, Open Graph and Twitter tags, favicon, theme bootstrapping. The social image comes from the `ogImage` option or the `ogImageFor` hook unless the page passes `image` (docs pages get the same through route-middleware.ts).

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` |  | Page title. The landing page passes nothing and gets "Name — tagline". |
| `description` | `string` | `site.tagline` |  |
| `image` | `string` | (computed) | Social image for this page: overrides the hook. |
| `type` | `'website' \| 'article'` | `'website'` | Open Graph type. |
| `noindex` | `boolean` | `false` | Ask search engines not to index this page (e.g. 404). |

Slots: `default`.

#### SiteHeader

The one site header: landing page, gallery, and (through overrides/Header.astro) every docs page. It renders the contents of the header bar; the bar itself (height, background, stickiness) belongs to the page frame: BaseLayout for site pages, Starlight's PageFrame for docs.

| Prop | Type | Default | Description |
|---|---|---|---|
| `pathname` | `string` | `Astro.url.pathname` | Current path, for the active nav state. Defaults to the request URL. |

Slots: `search`, `theme`, `theme-menu`.

#### SiteFooter

The shared footer: under the landing page and the gallery (variant `page`), and at the end of every docs page, after Starlight's edit link and pagination (variant `docs`, see overrides/Footer.astro).

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'page' \| 'docs'` | `'page'` | `page`: full-width band under a page. `docs`: inside the docs content column. |

#### ThemeSelect

Theme switch for pages outside Starlight (landing, gallery). It shares Starlight's storage key and `data-theme` attribute, so a choice made here carries over to the docs and back.

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | `'site-theme'` | Unique id; needed when the select is rendered more than once on a page. |

### Landing page sections
#### Landing

The built-in landing page body, composed from the section components and the `landing` option. To change the layout, set `components.Landing` to your own component (it renders inside BaseLayout), or set `landing: false` and write src/pages/index.astro. The section components are exported from 'astro-project-site/components'.

No props.

#### Hero

The top of the landing page: heading, lead paragraph, actions, install command, and a full-bleed `live` slot for anything interactive (a demo canvas, a custom element, a stage of characters).

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` (required) | `string` |  |  |
| `lead` | `string` |  |  |
| `primary` | `LinkAction` |  |  |
| `secondary` | `LinkAction` |  |  |
| `install` | `string` |  |  |

Slots: `default`, `live`.

#### Section

A landing-page section: optional heading and intro, then whatever you put inside. Sections are plain, stable block boxes (no transforms, no overflow clipping) so live content such as characters walking on the page can measure and stand on them.

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` |  |  |
| `title` | `string` |  |  |
| `intro` | `string` |  |  |
| `tone` | `'plain' \| 'surface'` | `'plain'` | Tinted background band. |
| `class` | `string` |  |  |

Slots: `header`, `default`.

#### Features

A grid of feature cards. Each card is an &lt;article> with a stable box; linked cards have a real link on the title (the whole card is clickable via a stretched hit area, not a wrapper link).

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` (required) | `Feature[]` |  |  |

#### Steps

Numbered "how it works" steps, each with an optional code sample highlighted at build time.

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` (required) | `Step[]` |  |  |

#### GalleryStrip

The landing page's gallery section: the first few gallery items and a link to the rest.

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `'Gallery'` |  |
| `intro` | `string` |  |  |
| `limit` | `number` | `3` |  |
| `kinds` | `string[]` |  | Only items of these kinds. |

#### CallToAction

The closing call to action.

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` (required) | `string` |  |  |
| `body` | `string` |  |  |
| `primary` | `LinkAction` |  |  |
| `secondary` | `LinkAction` |  |  |

Slots: `default`.

#### InstallCommand

A shell command with a copy button. The button appears only when the Clipboard API is available.

| Prop | Type | Default | Description |
|---|---|---|---|
| `command` (required) | `string` |  |  |
| `label` | `string` | `'Install command'` | Accessible name for the command, read before it. |

### Docs
#### ChildCards

A grid of cards for the pages and subfolders of a docs folder: title, description, and for a folder the number of pages in it. Folders without an index page get such a page automatically; put `<ChildCards />` in a folder's own index page to show the same grid there, or pass `dir` to list any folder. On a docs page the cards follow the sidebar order; elsewhere `sidebar.order`, then title.

| Prop | Type | Default | Description |
|---|---|---|---|
| `dir` | `string` |  | Folder to list, as a collection id (`docs/guides`) or path (`/docs/guides/`). Default: the current docs page. |
| `exclude` | `string[]` |  | Collection ids or paths to leave out. |
| `label` | `string` |  | Accessible name of the list. |

### Gallery
#### GalleryPage

The built-in /gallery/ page body: every published item, with kind and tag filters. Without JavaScript all items are shown; with it, the filters appear (and are reflected in the URL: ?kind=demo&tag=canvas). Replace it with `components.Gallery` (same props; it renders inside BaseLayout).

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` (required) | `GalleryEntry[]` |  |  |
| `title` (required) | `string` |  |  |
| `description` (required) | `string` |  |  |

#### GalleryGrid

A responsive grid of gallery cards. Used by /gallery/ and by the landing page's gallery strip. Cards are the built-in GalleryCard, or the project's `components.GalleryCard`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` (required) | `GalleryEntry[]` |  |  |
| `headingLevel` | `2 \| 3 \| 4` | `3` |  |
| `minWidth` | `string` | `'16rem'` | Minimum card width before the grid wraps. |
| `id` | `string` |  |  |

#### GalleryCard

One gallery item: poster, kind, title (the link), description, tags. The card is a plain &lt;article>; the whole card is clickable through a stretched hit area on the title link.

| Prop | Type | Default | Description |
|---|---|---|---|
| `item` (required) | `GalleryEntry` |  |  |
| `headingLevel` | `2 \| 3 \| 4` | `3` | Heading level for the title, to fit the page outline. |

#### GalleryFilters

Kind and tag filters for a GalleryGrid. Hidden until its script runs, so without JavaScript the page simply shows every item. The current filter is mirrored in the URL (?kind=…&tag=…) so it can be shared.

| Prop | Type | Default | Description |
|---|---|---|---|
| `kinds` (required) | `string[]` |  |  |
| `tags` (required) | `string[]` |  |  |
| `target` (required) | `string` |  | id of the GalleryGrid to filter. |
| `total` (required) | `number` |  |  |

### Helpers

- `galleryItems`
- `distinct`
- `isActive`
- `isExternal`
<!-- /gen -->

`galleryItems()` returns the published gallery entries sorted by `order`, then title. `distinct(items, pick)`
returns the distinct values `pick` returns across items, in first-seen order. `isActive(href, pathname)` is the
nav's "current section" test; `isExternal(href)` is true for `scheme://` URLs.
