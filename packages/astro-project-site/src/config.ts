// The validated projectSite() options (plus the resolved `version`), for a project's own pages and components:
//   import config from 'astro-project-site/config';
import config from 'virtual:astro-project-site/config';

export default config;
export type { SiteConfig } from './index';
// Option and slot names, for checking a config without hardcoding them.
export { OPTION_NAMES, COMPONENT_NAMES } from './options.mjs';
