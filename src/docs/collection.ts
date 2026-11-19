// OWNER: docs agent.
import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const docs = defineCollection({ loader: docsLoader(), schema: docsSchema() });
