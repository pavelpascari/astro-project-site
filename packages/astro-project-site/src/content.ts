// Content collections for a project's src/content.config.ts:
//
//   import { projectSiteCollections } from 'astro-project-site/content';
//   export const collections = projectSiteCollections();
//
// - docs:    Starlight's docs (src/content/docs/) plus the `externalDocs` folders, with a default 404 page
// - gallery: one file per item in src/content/gallery/ (YAML, JSON or Markdown frontmatter)
// - i18n:    Starlight's UI translations (src/content/i18n/), optional
import { existsSync } from 'node:fs';
import { defineCollection, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { i18nLoader } from '@astrojs/starlight/loaders';
import type { Loader } from 'astro/loaders';
import { projectDocsLoader } from './docs/loader';

export { projectDocsLoader };

/** Schema of a gallery item. Pass `extend` to projectSiteCollections() to add fields. */
export const gallerySchema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    description: z.string(),
    /** Where the card links: a site path (`/apps/hello/`) or a full URL. */
    href: z.string(),
    /** Free-form category used by the filter, e.g. `demo`, `example`, `tool`, `character`. */
    kind: z.string().default('example'),
    /** Poster image next to the entry file, optimised at build time (e.g. `./hello.png`). */
    poster: image().optional(),
    /** Poster served as-is: a path under public/ or a mirrored app (`/apps/x/poster.png`), or a full URL. */
    posterUrl: z.string().optional(),
    /** Alt text for the poster. Empty (the default) marks it decorative, since the title already names it. */
    posterAlt: z.string().default(''),
    /** Render the poster with crisp, unsmoothed pixels (pixel art, small sprites). */
    pixelated: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    /** Sort key, ascending; ties sort by title. */
    order: z.number().default(100),
    /** Link leaves the site (a different origin or an app outside the build). Adds an indicator. */
    external: z.boolean().default(false),
    /** Hide the item without deleting it. */
    draft: z.boolean().default(false),
  });

/**
 * Starlight's i18n collection, guaranteed non-empty: Starlight reads it on every page and Astro warns about an
 * empty collection. The placeholder adds no strings (an empty `en` dictionary).
 */
function i18nCollectionLoader(): Loader {
  const starlight = i18nLoader();
  return {
    name: 'astro-project-site-i18n',
    async load(context) {
      if (existsSync(new URL('content/i18n/', context.config.srcDir))) await starlight.load(context);
      if (context.store.keys().length === 0) context.store.set({ id: 'en', data: {} });
    },
  };
}

export interface ProjectSiteCollectionsOptions {
  /** Extra frontmatter fields for docs pages (Starlight's `docsSchema({ extend })`). */
  docsExtend?: Parameters<typeof docsSchema>[0] extends infer O ? (O extends { extend?: infer E } ? E : never) : never;
  /** Folder of gallery items, relative to the project root. Default `./src/content/gallery`. */
  galleryBase?: string;
}

/** The `docs`, `gallery` and `i18n` collections, ready for `export const collections = ...`. */
export function projectSiteCollections(options: ProjectSiteCollectionsOptions = {}) {
  return {
    docs: defineCollection({
      loader: projectDocsLoader(),
      schema: docsSchema(options.docsExtend ? { extend: options.docsExtend } : undefined),
    }),
    gallery: defineCollection({
      loader: glob({ pattern: '**/*.{md,yaml,yml,json}', base: options.galleryBase ?? './src/content/gallery' }),
      schema: gallerySchema,
    }),
    i18n: defineCollection({ loader: i18nCollectionLoader(), schema: i18nSchema() }),
  };
}
