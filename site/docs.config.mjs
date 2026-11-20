// @ts-check
// Docs-side options for the template's own site, kept apart from astro.config.mjs (identity, nav, landing).
// Spread into projectSite({...}) there.
//
// The docs themselves are local pages in src/content/docs/docs/ (Start here, Guides, Reference, Recipes). The
// starter's example markdown folder is mounted too, under /docs/example/, as a working demonstration of
// `externalDocs`: those files have no frontmatter and are written for GitHub.
const example = '../starters/default/example';

/** @type {Partial<import('astro-project-site').ProjectSiteOptions>} */
export default {
  externalDocs: [
    { dir: `${example}/docs`, route: 'example', label: 'Example: mounted docs', order: ['getting-started.md', 'api.md'] },
  ],
};
