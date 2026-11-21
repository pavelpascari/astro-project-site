// The starter (starters/default) as `project-site init` copies it, built and deployed unchanged as its own Worker
// (its wrangler.jsonc name). The gallery and the landing page show it there, rather than mounting its example docs
// into this site's docs.
export const STARTER_URL = 'https://project-site-starter.pascaripavel.workers.dev';

/** The starter's `externalDocs` entry for its example docs (starters/default/astro.config.mjs). */
export const STARTER_MOUNT = { route: 'reference', label: 'Reference', order: ['getting-started.md'] };
