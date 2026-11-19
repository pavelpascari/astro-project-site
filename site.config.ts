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
  /** Branch that "edit this page" and links to repo files point at. Default `main`. GitHub URL layout is assumed. */
  repoBranch?: string;
  /** A package.json whose `version` the site shows (the framework's own). Optional. */
  versionFrom?: string;
  /** Top navigation, shared by the landing page, the docs and the gallery. */
  nav: { label: string; href: string }[];
  /** Markdown docs that live outside the site (e.g. the framework's own docs/ folder), mounted under a route. */
  externalDocs?: {
    dir: string;
    route: string;
    label: string;
    /** Sidebar order hint: file names relative to `dir` (`.md` optional) listed first, in this order. README.md always leads. */
    order?: string[];
    /** Globs relative to `dir` to leave out of the site, e.g. `['plans/**', 'research/**']`. */
    exclude?: string[];
  }[];
  /**
   * Static apps (plain HTML/JS folders) copied into the build as they are, e.g. a studio or demo pages.
   * `from` is a folder (may be outside the site, e.g. '../'), `to` the URL prefix. Optional `include` /
   * `exclude` globs (relative to `from`) pick what is mirrored; a folder pattern covers its contents.
   * See integrations/mirror.mjs and the "Deploy" template docs.
   */
  mirrors?: { from: string; to: string; include?: string[]; exclude?: string[] }[];
  /** Install command shown on the landing page. */
  install?: string;

  // ── Landing, gallery, chrome and theme (see docs/template/landing-and-gallery) ──
  /** Default social-preview image: a static path under public/ (1200×630 PNG/JPG) or an absolute URL. */
  ogImage?: string;
  /** Brand colour overrides. Anything more goes in your own CSS by overriding the `--site-*` tokens. */
  theme?: {
    /** Accent colour used in light mode (and in dark mode unless `accentDark` is set). Any CSS colour. */
    accent?: string;
    /** Accent colour used in dark mode. */
    accentDark?: string;
  };
  /** Content for the example landing page (src/pages/index.astro). Every part is optional. */
  landing?: {
    hero?: {
      /** Big heading; defaults to `name`. */
      title?: string;
      /** Paragraph under the heading; defaults to `tagline`. */
      lead?: string;
      primary?: LinkAction;
      secondary?: LinkAction;
    };
    features?: { title: string; body: string; href?: string }[];
    steps?: { title: string; body: string; code?: string; lang?: string }[];
    /** Gallery strip: how many items to show (0 hides it). */
    gallery?: { title?: string; limit?: number };
    cta?: { title: string; body?: string; primary?: LinkAction; secondary?: LinkAction };
  };
  /** Extra text in the footer, e.g. a licence line. */
  footer?: { note?: string };
}

export interface LinkAction {
  label: string;
  href: string;
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
  externalDocs: [
    { dir: './example/docs', route: 'reference', label: 'Reference', order: ['getting-started.md', 'api.md'] },
  ],
  mirrors: [{ from: './example/apps', to: 'apps' }],
  install: 'npm i example-project',

  ogImage: '/og.png',
  theme: { accent: '#4f46e5', accentDark: '#a5b4fc' },
  landing: {
    hero: {
      primary: { label: 'Get started', href: '/docs/' },
      secondary: { label: 'See it running', href: '/gallery/' },
    },
    features: [
      { title: 'Small', body: 'One dependency-free module you can read in an afternoon.' },
      { title: 'Typed', body: 'Ships its own TypeScript types and stays out of your build.' },
      { title: 'Framework-agnostic', body: 'Works in plain HTML, any bundler, or none at all.' },
      { title: 'Documented', body: 'Every export has a page in the reference, with a runnable example.', href: '/docs/reference/' },
    ],
    steps: [
      { title: 'Install', body: 'Add the package to your project.', code: 'npm i example-project', lang: 'sh' },
      { title: 'Import', body: 'Pull in the one function you need.', code: "import { hello } from 'example-project';", lang: 'js' },
      { title: 'Call it', body: 'That is the whole API surface for most projects.', code: "hello('world'); // → 'Hello, world'", lang: 'js' },
    ],
    gallery: { title: 'See it in action', limit: 3 },
    cta: {
      title: 'Ready when you are',
      body: 'Read the guide, then try it in the playground.',
      primary: { label: 'Read the docs', href: '/docs/' },
      secondary: { label: 'Open the playground', href: '/apps/hello/' },
    },
  },
  footer: { note: 'Released under the MIT licence.' },
};

export default config;
