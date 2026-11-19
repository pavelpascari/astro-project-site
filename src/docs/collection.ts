// OWNER: docs agent. Local Starlight pages plus the site.config `externalDocs` folders, in one `docs` collection.
import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { projectDocsLoader } from './loader';

export const docs = defineCollection({ loader: projectDocsLoader(), schema: docsSchema() });
