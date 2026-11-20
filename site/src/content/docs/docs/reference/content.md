---
title: Content collections
description: projectSiteCollections(), the gallery item schema and docs frontmatter.
sidebar:
  order: 4
---

```ts title="src/content.config.ts"
import { projectSiteCollections } from 'astro-project-site/content';
export const collections = projectSiteCollections();
```

`projectSiteCollections(options?)` returns three collections:

| Collection | Loader | Schema |
|---|---|---|
| `docs` | Starlight's `src/content/docs/` loader, plus one `glob()` per `externalDocs` folder (`.md` only), plus a default `404` entry when you have none | Starlight's `docsSchema()`, extended with `docsExtend` |
| `gallery` | `glob('**/*.{md,yaml,yml,json}')` in `galleryBase` | `gallerySchema` (below) |
| `i18n` | Starlight's `i18nLoader()` when `src/content/i18n/` exists; otherwise one empty `en` entry, so Astro does not warn | Starlight's `i18nSchema()` |

| Option | Type | Default | Description |
|---|---|---|---|
| `docsExtend` | zod object | | Extra frontmatter fields for docs pages (Starlight's `docsSchema({ extend })`). |
| `galleryBase` | `string` | `'./src/content/gallery'` | Folder of gallery items, relative to the project root. |

The package also exports `gallerySchema` and `projectDocsLoader()` for a hand-written content config.

```ts title="src/content.config.ts: adding a docs field"
import { z } from 'astro/zod';
import { projectSiteCollections } from 'astro-project-site/content';

export const collections = projectSiteCollections({
  docsExtend: z.object({ since: z.string().optional() }),
});
```

## Gallery item

One file per item in `src/content/gallery/` (YAML, JSON, or Markdown frontmatter). From `gallerySchema` in
`src/content.ts`:

<!-- gen:schema name=gallerySchema -->
| Field | Type | Default | Required | Description |
|---|---|---|---|---|
| `title` | `string` |  | yes |  |
| `description` | `string` |  | yes |  |
| `href` | `string` |  | yes | Where the card links: a site path (`/apps/hello/`) or a full URL. |
| `kind` | `string` | `'example'` |  | Free-form category used by the filter, e.g. `demo`, `example`, `tool`, `character`. |
| `poster` | `image (local file)` |  |  | Poster image next to the entry file, optimised at build time (e.g. `./hello.png`). |
| `posterUrl` | `string` |  |  | Poster served as-is: a path under public/ or a mirrored app (`/apps/x/poster.png`), or a full URL. |
| `posterAlt` | `string` | `''` |  | Alt text for the poster. Empty (the default) marks it decorative, since the title already names it. |
| `pixelated` | `boolean` | `false` |  | Render the poster with crisp, unsmoothed pixels (pixel art, small sprites). |
| `tags` | `string[]` | `[]` |  |  |
| `order` | `number` | `100` |  | Sort key, ascending; ties sort by title. |
| `external` | `boolean` | `false` |  | Link leaves the site (a different origin or an app outside the build). Adds an indicator. |
| `draft` | `boolean` | `false` |  | Hide the item without deleting it. |
<!-- /gen -->

`poster` is resolved relative to the entry file and optimised at build time; `posterUrl` is used as it is.
See [Gallery](/docs/guides/gallery/).

## Docs frontmatter

Local pages use [Starlight's frontmatter](https://starlight.astro.build/reference/frontmatter/). Two fields matter
to the generated sidebar of top-level pages in `src/content/docs/docs/`: `sidebar.order` (ascending; the index
page always comes first) and `sidebar.hidden: true`.

Mounted markdown files need no frontmatter. When they have none, they get:

| Field | Value |
|---|---|
| `title` | The first `# H1` (removed from the body), else the file name |
| `description` | The first paragraph before any heading, cut to one sentence (≤ 200 characters) |
| `editUrl` | `<repo>/edit/<repoBranch>/<path in the git repo>`, or `false` outside the repo |
| `slug` | Always set from the file's path (it is what the links validator keys pages by) |

Frontmatter you write wins for `title`, `description` and `editUrl`. An H1 is also removed when the file
starts with it, even if the frontmatter has a title.
