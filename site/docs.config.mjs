// @ts-check
// Docs-side options for the template's own site, kept apart from astro.config.mjs (identity, nav, landing).
// Spread into projectSite({...}) there.
//
// The docs are local pages in src/content/docs/docs/ (Start here, Guides, Reference, Recipes). Mounted docs are
// shown by the starter itself, deployed as it is (src/lib/starter.ts): its example folder at /docs/reference/.

/** @type {Partial<import('astro-project-site').ProjectSiteOptions>} */
export default {
  externalDocs: [],
};
