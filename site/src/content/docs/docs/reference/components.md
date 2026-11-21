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
| `type` | `'website' \| 'article'` |  | Open Graph type (blog posts are `article`). |
| `canonical` | `string` |  | Canonical URL when it is not this page's own (e.g. a post first published elsewhere). |

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
| `canonical` | `string` |  | Canonical URL when it is not this page's own (e.g. a blog post first published elsewhere). |

Slots: `default`.

#### SiteHeader

The one site header: landing page, gallery, and (through overrides/Header.astro) every docs page. It renders the contents of the header bar; the bar itself (height, background, stickiness) belongs to the page frame: BaseLayout for site pages, Starlight's PageFrame for docs.

| Prop | Type | Default | Description |
|---|---|---|---|
| `pathname` | `string` | `Astro.url.pathname` | Current path, for the active nav state. Defaults to the request URL. |
| `menu` | `boolean` | `true` | Render the small-screen menu. Default true. The docs header turns it off on pages with a sidebar, where the nav is in Starlight's mobile menu instead, so a page never has two menus holding the same links. |

Slots: `search`, `theme`, `theme-menu`.

#### SiteFooter

The shared footer: under the landing page and the gallery (variant `page`), and at the end of every docs page, after Starlight's edit link and pagination (variant `docs`, see overrides/Footer.astro).

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'page' \| 'docs'` | `'page'` | `page`: full-width band under a page. `docs`: inside the docs content column. |
| `navLabel` | `string` |  | Accessible name of the footer's nav. Default: the `footerNav` label. Give a second footer on a page its own. |

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
| `headingLevel` | `1 \| 2` | `1` | Level of the title heading: 1 on a landing page (default); 2 when the hero is shown inside another page. |

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
| `title` | `string` | `t('gallery')` |  |
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
| `label` | `string` | `t('installCommand')` | Accessible name for the command, read before it. |

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

### Blog
#### BlogIndex

The post list body: /blog/, /blog/2/, ... and each tag page /blog/tags/&lt;tag>/. Renders inside BaseLayout. Replace it with `components.BlogIndex` (props: BlogIndexProps).

| Prop | Type | Default | Description |
|---|---|---|---|
| `posts` (required) | `BlogEntry[]` |  | The posts on this page, newest first. |
| `title` (required) | `string` |  |  |
| `description` (required) | `string` |  |  |
| `tag` | `object` |  | Set on tag pages. |
| `tag.tag` (required) | `string` |  |  |
| `tag.slug` (required) | `string` |  |  |
| `tag.count` (required) | `number` |  |  |
| `tags` (required) | `{ tag: string; slug: string; count: number }[]` |  | Every tag, most used first. |
| `page` (required) | `object` |  | Pagination (1-based). Tag pages are a single page. |
| `page.current` (required) | `number` |  |  |
| `page.last` (required) | `number` |  |  |
| `page.total` (required) | `number` |  |  |
| `page.prev` | `string` |  |  |
| `page.next` | `string` |  |  |

#### BlogPost

One post's page body (inside BaseLayout): title, dates, authors, reading time, the post itself in a reading column with room for margin notes, tags, an "Edit this post" link and the newer/older posts. Replace it with `components.BlogPost` (props: BlogPostProps; the rendered post is the default slot).

| Prop | Type | Default | Description |
|---|---|---|---|
| `post` (required) | `BlogEntry` |  |  |
| `readingTime` (required) | `number` |  |  |
| `authors` (required) | `BlogAuthor[]` |  |  |
| `editUrl` | `string` |  | "Edit this post" link, when the repository layout is known. |
| `newer` | `BlogEntry` |  |  |
| `older` | `BlogEntry` |  |  |

Slots: `default`.

#### BlogCard

One post in a list: the blog index, tag pages and the landing page's "Latest posts". Replace it with `components.BlogCard` (props: `post`, `headingLevel`, `variant`).

| Prop | Type | Default | Description |
|---|---|---|---|
| `post` (required) | `BlogEntry` |  |  |
| `headingLevel` | `2 \| 3 \| 4` | `2` | Heading level for the title, to fit the page outline. |
| `variant` | `'row' \| 'tile'` | `'row'` | `row`: a full-width entry with the image beside the text (the post list). `tile`: a card for grids. |

#### BlogTags

The tag index body (/blog/tags/): every tag with its post count. Renders inside BaseLayout.

| Prop | Type | Default | Description |
|---|---|---|---|
| `tags` (required) | `{ tag: string; slug: string; count: number }[]` |  |  |
| `title` (required) | `string` |  |  |

#### PostMeta

The line under a post's title (and in lists): date, "updated" date, reading time, authors, and a Draft badge in dev.

| Prop | Type | Default | Description |
|---|---|---|---|
| `post` (required) | `BlogEntry` |  |  |
| `readingTime` (required) | `number` |  |  |
| `authors` | `BlogAuthor[]` | `[]` | Shown when given (the post page passes them; lists leave them out). |
| `class` | `string` |  |  |

#### TagList

A post's tags, each a link to its tag page.

| Prop | Type | Default | Description |
|---|---|---|---|
| `tags` (required) | `string[]` |  |  |
| `label` | `string` |  | Visible label before the list ("Tagged"); the list is labelled "Tags" either way. |
| `class` | `string` |  |  |

#### LatestPosts

"Latest posts": the newest few posts and a link to the rest. The built-in landing page shows it when the blog is on (option `blog.landing`); a custom landing can use it too: import { LatestPosts } from 'astro-project-site/components'; &lt;LatestPosts limit={3} />

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `t('latestPosts')` |  |
| `intro` | `string` |  |  |
| `limit` | `number` | `3` | How many posts. Default 3. |
| `tone` | `'plain' \| 'surface'` | `'plain'` | Section background. |

### Writing: side notes for posts and docs pages
#### MarginNote

A side note anchored to a spot in the text.

| Prop | Type | Default | Description |
|---|---|---|---|
| `kind` | `'note' \| 'field' \| 'warning'` | `'note'` | `note` (default), `field` (a field note: an observation from practice), or `warning`. |
| `label` | `string` |  | Label above the note. Default: the `note`, `fieldNote` or `warning` label; `''` for none. |
| `numbered` | `boolean` | `false` | Number the note and put the number in the text at the anchor (numbers count up through the page). |
| `id` | `string` |  |  |

Slots: `default`.

### Helpers

- `galleryItems`
- `distinct`
- `blogPosts`
- `postInfo`
- `readingTime`
- `tagSlug`
- `formatDate`
- `activeHref`
- `isActive`
- `isExternal`
<!-- /gen -->

`galleryItems()` returns the published gallery entries sorted by `order`, then title. `distinct(items, pick)`
returns the distinct values `pick` returns across items, in first-seen order. `isActive(href, pathname)` is true
when the page is in a nav link's section; `activeHref(hrefs, pathname)` picks the one link to mark as current (the
most specific of those, so `/docs/guide/` wins over `/docs/` on a guide page); `isExternal(href)` is true for
`scheme://` URLs.
