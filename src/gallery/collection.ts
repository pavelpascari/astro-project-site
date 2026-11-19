// OWNER: landing agent.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const gallery = defineCollection({
  loader: glob({ pattern: '**/*.{md,yaml,json}', base: './src/content/gallery' }),
  schema: z.object({ title: z.string(), description: z.string(), href: z.string() }),
});
