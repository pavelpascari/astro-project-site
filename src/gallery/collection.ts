// OWNER: landing agent.
// The gallery: demos, examples, tools and anything else worth showing. One file per item in
// src/content/gallery/ (YAML, JSON or Markdown frontmatter). See docs/template/landing-and-gallery.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const gallery = defineCollection({
  loader: glob({ pattern: '**/*.{md,yaml,json}', base: './src/content/gallery' }),
  schema: ({ image }) =>
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
    }),
});
