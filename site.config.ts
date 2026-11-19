// The one file a project edits to make this template its own. Every part of the template reads from here.
// Paths are relative to this file's folder (the site root).
export interface SiteConfig {
  /** Project name, shown in the header and titles. */
  name: string;
  /** One line under the name on the landing page and in meta descriptions. */
  tagline: string;
  /** Production URL, no trailing slash. */
  url: string;
  /** Source repository, for "edit this page" and the header link. */
  repo: string;
  /** A package.json whose `version` the site shows (the framework's own). Optional. */
  versionFrom?: string;
  /** Top navigation, shared by the landing page, the docs and the gallery. */
  nav: { label: string; href: string }[];
  /** Markdown docs that live outside the site (e.g. the framework's own docs/ folder), mounted under a route. */
  externalDocs?: { dir: string; route: string; label: string }[];
  /** Static apps (plain HTML/JS folders) copied into the build as they are, e.g. a studio or demo pages. */
  mirrors?: { from: string; to: string }[];
  /** Install command shown on the landing page. */
  install?: string;
}

const config: SiteConfig = {
  name: 'Example Project',
  tagline: 'A small library that does one thing well.',
  url: 'https://example-project.workers.dev',
  repo: 'https://github.com/you/example-project',
  versionFrom: './package.json',
  nav: [
    { label: 'Docs', href: '/docs/' },
    { label: 'Gallery', href: '/gallery/' },
    { label: 'Playground', href: '/apps/hello/' },
  ],
  externalDocs: [{ dir: './example/docs', route: 'reference', label: 'Reference' }],
  mirrors: [{ from: './example/apps', to: 'apps' }],
  install: 'npm i example-project',
};

export default config;
