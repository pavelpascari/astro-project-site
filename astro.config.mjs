// Wiring only. Each area of the template is its own integration or module; edit those, not this file.
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import site from './site.config.ts';
import { docsStarlight } from './integrations/docs.mjs';
import { mirror } from './integrations/mirror.mjs';

export default defineConfig({
  site: site.url,
  trailingSlash: 'ignore',
  integrations: [
    starlight(docsStarlight(site)),
    mirror(site),
    sitemap(),
  ],
});
