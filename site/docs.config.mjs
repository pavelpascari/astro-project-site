// @ts-check
// Docs-side options for the template's own site, kept apart from astro.config.mjs (identity, nav, landing).
// Spread into projectSite({...}) there.
const example = '../starters/default/example';

/** @type {Partial<import('astro-project-site').ProjectSiteOptions>} */
export default {
  externalDocs: [
    { dir: `${example}/docs`, route: 'reference', label: 'Reference', order: ['getting-started.md', 'api.md'] },
  ],
};
