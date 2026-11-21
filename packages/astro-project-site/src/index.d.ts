import type { AstroIntegration } from 'astro';

export type { LiveContext, LiveExampleElement, LiveMode, LiveProps, LivePreviewPosition, LiveRunner, LiveRunResult, LiveStatusLevel } from './components/live/types';

/** A link with a label: nav items, hero and call-to-action buttons. */
export interface LinkAction {
  label: string;
  href: string;
}

export interface Feature {
  title: string;
  body: string;
  /** Makes the whole card a link. */
  href?: string;
}

export interface Step {
  title: string;
  body: string;
  /** Code shown next to the step, highlighted at build time. */
  code?: string;
  /** Shiki language id, e.g. `js`, `ts`, `sh`. */
  lang?: string;
}

/** A list of items, or `{ title, intro, items }` to also set the section heading. */
export type SectionContent<T> = T[] | { title?: string; intro?: string; items: T[] };

/** A live example in the hero: the same props as the `<Live>` component, minus the ones that make no sense there. */
export interface HeroDemo {
  code: string;
  lang?: string;
  title?: string;
  caption?: string;
  mode?: 'inline' | 'iframe';
  preview?: 'above' | 'below' | 'side';
  runner?: string;
  editable?: boolean;
  options?: Record<string, unknown>;
  modules?: string[];
  base?: string;
  height?: number | string;
}

/** Content of the built-in landing page. Every part is optional; a section without content is not rendered. */
export interface LandingContent {
  hero?: {
    /** Big heading; defaults to `name`. */
    title?: string;
    /** Paragraph under the heading; defaults to `tagline`. */
    lead?: string;
    primary?: LinkAction;
    secondary?: LinkAction;
    /** A live example under the hero copy (rendered with `<Live>`). */
    demo?: HeroDemo;
  };
  /** Feature cards. Default heading: the `featuresTitle` label ("Why it exists"). */
  features?: SectionContent<Feature>;
  /**
   * Cards for the top-level docs sections, shown when there are no `features` and the docs have at least two
   * sections. Default heading: the `documentation` label. `false` hides them.
   */
  docs?: false | { title?: string; intro?: string };
  /** Numbered steps. Default heading: the `stepsTitle` label ("How it works"). */
  steps?: SectionContent<Step>;
  /** The gallery strip: heading, intro and how many items (0 hides it; default 3). */
  gallery?: { title?: string; intro?: string; limit?: number };
  cta?: { title: string; body?: string; primary?: LinkAction; secondary?: LinkAction };
}

/** Where `externalDocs[].git` downloads from. */
export interface GitSource {
  /** Clone URL: `https://…`, `ssh://…`, `git@host:owner/repo.git` or `file://…`. For a private repository on
   * github.com over https, the build sends `GITHUB_TOKEN` from the environment when it is set. */
  repo: string;
  /**
   * A tag, a branch or a full 40-character commit SHA. A tag or commit is fetched once and cached; a branch is
   * fetched on every build (with a warning: the docs change when it moves).
   */
  ref: string;
  /** The markdown folder inside the repository, e.g. `docs`. Default: the repository root. */
  path?: string;
}

export interface ExternalDocs {
  /** Markdown folder, relative to the project root. May be outside it (`../docs`). Give this or `git`. */
  dir?: string;
  /**
   * A folder of another repository instead of a local one: downloaded at build time (a shallow, sparse fetch with
   * the `git` command), cached in Astro's cache folder, then mounted like `dir`. Links to its files that are not
   * mounted go to that repository at `ref`; "Edit page" goes to its default branch.
   * @example git: { repo: 'https://github.com/org/lib', ref: 'v1.4.0', path: 'docs' }
   */
  git?: GitSource;
  /** URL segment under /docs/: `reference` → /docs/reference/... */
  route: string;
  /** Sidebar group label. */
  label: string;
  /**
   * One sentence on what the section holds: its card on /docs/ and the landing page, and the meta description of its
   * README page. Defaults to the README's frontmatter `description`, then its first paragraph.
   */
  description?: string;
  /** File names (relative to `dir`, `.md` optional) listed first, in this order. README.md always leads. */
  order?: string[];
  /** Globs relative to `dir` to leave out, e.g. `['plans/**']`. */
  exclude?: string[];
  /**
   * Globs relative to `dir`; when given, only matching markdown files are mounted. Matched against the whole path
   * (`README.md` is the top-level one only); a glob that matches a folder covers its contents. Lets a mount pick
   * files from the repository root: `{ dir: '..', route: 'project', label: 'Project', include: ['README.md',
   * 'CHANGELOG.md'] }`. The site's own folder, dot-folders and node_modules are never mounted.
   */
  include?: string[];
}

export interface Mirror {
  /** Folder to serve as-is, relative to the project root. May be outside it (`../`). */
  from: string;
  /** URL prefix: `apps` → /apps/... Nested prefixes (`pixel/src`) work. */
  to: string;
  /** Globs relative to `from`; when given, only matching paths are mirrored. */
  include?: string[];
  /** Globs relative to `from`; matching paths are skipped. */
  exclude?: string[];
}

/** Components a project can replace. Values are paths relative to the project root (or package specifiers). */
export interface ComponentOverrides {
  /** The header bar contents on every page, docs included. Receives the `search`, `theme` and `theme-menu` slots. */
  Header?: string;
  /** The footer on every page, docs included. Receives `variant: 'page' | 'docs'`. */
  Footer?: string;
  /** The landing page's hero. Receives the Hero props (title, lead, primary, secondary, install) and a `live` slot. */
  Hero?: string;
  /** The whole landing page body (inside BaseLayout). */
  Landing?: string;
  /** One gallery card. Receives `item: GalleryEntry` and `headingLevel`. */
  GalleryCard?: string;
  /** The whole /gallery/ page body (inside BaseLayout). Receives `items`, `title`, `description`. */
  Gallery?: string;
  /** The post list body (inside BaseLayout): /blog/, /blog/2/, and each /blog/tags/<tag>/. Receives `BlogIndexProps`. */
  BlogIndex?: string;
  /** One post page body (inside BaseLayout). Receives `BlogPostProps`; the rendered post is its default slot. */
  BlogPost?: string;
  /** One post in a list (blog index, tag pages, landing "Latest posts"). Receives `post: BlogEntry`, `headingLevel`. */
  BlogCard?: string;
}

/** Someone who writes posts: the values of the `blog.authors` option. */
export interface BlogAuthor {
  name: string;
  /** Their site or profile: the name becomes a link. */
  url?: string;
  /** Picture: a path under public/ or a full URL. */
  avatar?: string;
}

/** The `blog` option in object form. */
export interface BlogOptions {
  /** URL segment of the blog. Default `blog` (→ /blog/). */
  route?: string;
  /** Heading of the post list and its nav label. Default `Blog`. */
  title?: string;
  /** Text under the heading and the feed description. Default: `tagline`. */
  description?: string;
  /** People posts can name in `authors` frontmatter, by key. Names not listed here are shown as written. */
  authors?: Record<string, BlogAuthor>;
  /** Posts per list page; more pages at /blog/2/, /blog/3/, ... Default 10. */
  postsPerPage?: number;
  /** /blog/rss.xml, linked from every page with `<link rel="alternate">`. Default `true`. */
  rss?: boolean;
  /** "Latest posts" section on the built-in landing page, or `false`. Default `{ title: 'Latest posts', limit: 3 }`. */
  landing?: false | { title?: string; limit?: number };
}

/** The blog option after defaults. */
export interface ResolvedBlog {
  route: string;
  title: string;
  description: string;
  authors: Record<string, BlogAuthor>;
  postsPerPage: number;
  rss: boolean;
  landing: false | { title: string; limit: number };
  /** "Edit" link base for files under the site folder (set by the integration when the repo layout is known). */
  editBase?: string;
}

/** Frontmatter of a post (src/content/blog/**\/*.{md,mdx}). */
export interface BlogPostData {
  title: string;
  description: string;
  date: Date;
  updated?: Date;
  /** Keys of `blog.authors`, or plain names. */
  authors: string[];
  tags: string[];
  /** Built only in dev, where it carries a "Draft" badge. */
  draft: boolean;
  /** Image next to the post file, optimised at build time; also the post's social image. */
  image?: import('astro').ImageMetadata;
  imageAlt?: string;
  /** Canonical URL when the post was first published elsewhere. */
  canonical?: string;
}

/** One post, as `getCollection('blog')` returns it. `id` is its path under src/content/blog/ without extension. */
export interface BlogEntry {
  id: string;
  collection: 'blog';
  data: BlogPostData;
  body?: string;
  filePath?: string;
}

/** A post with what the blog pages compute for it. */
export interface BlogPostInfo {
  post: BlogEntry;
  /** /blog/<id>/ */
  href: string;
  /** Minutes, computed from the body at build time. */
  readingTime: number;
  authors: BlogAuthor[];
}

/** Props of the `BlogIndex` slot. */
export interface BlogIndexProps {
  /** The posts on this page, newest first. */
  posts: BlogEntry[];
  title: string;
  description: string;
  /** Set on tag pages. */
  tag?: { tag: string; slug: string; count: number };
  /** Every tag, most used first. */
  tags: { tag: string; slug: string; count: number }[];
  /** Pagination (1-based). Tag pages are a single page. */
  page: { current: number; last: number; total: number; prev?: string; next?: string };
}

/** Props of the `BlogPost` slot. */
export interface BlogPostProps {
  post: BlogEntry;
  readingTime: number;
  authors: BlogAuthor[];
  /** "Edit this post" link, when the repository layout is known. */
  editUrl?: string;
  newer?: BlogEntry;
  older?: BlogEntry;
}

export interface ProjectSiteOptions {
  /** Project name, shown in the header and titles. */
  name: string;
  /** One line under the name on the landing page and in meta descriptions. */
  tagline: string;
  /** Production URL. Also Astro's `site` unless that is set. */
  url: string;
  /** Source repository, for "edit this page" and the header link. GitHub URL layout is assumed for file links. */
  repo: string;
  /** Branch that edit links and links to repo files point at. Default `main`. */
  repoBranch?: string;
  /** A package.json (relative to the project root) whose `version` the header shows. */
  versionFrom?: string;
  /** Top navigation, shared by every page. Default: Docs, and Gallery unless `gallery: false`. */
  nav?: LinkAction[];
  /** Markdown folders outside the site, mounted under /docs/<route>/. */
  externalDocs?: ExternalDocs[];
  /**
   * The order of the top-level docs sections, in the sidebar and in the docs cards (the /docs/ page and the landing
   * page): mount routes (`externalDocs[].route`, e.g. `reference`) and folders of `src/content/docs/docs/` (e.g.
   * `guide`). Listed sections come first, in this order; the rest follow in the default order (mounts as configured,
   * then your own folders by name). Pages directly in `src/content/docs/docs/` always come first. An unknown name
   * fails the build. Default: none.
   * @example docsOrder: ['guide', 'reference']
   */
  docsOrder?: string[];
  /** Static HTML/JS folders copied into the build byte for byte (and served from disk in dev). */
  mirrors?: Mirror[];
  /** Install command shown on the landing page. */
  install?: string;
  /** Favicon path under public/. Default `/favicon.svg`. */
  favicon?: string;
  /** Tags added to the `<head>` of every page: landing, gallery, your BaseLayout pages and docs. */
  head?: HeadTag[];
  /** Default social image: a path under public/ (1200×630) or an absolute URL. */
  ogImage?: string;
  /** Module (relative to the project root) whose default export is an `OgImageHook`, for per-page images. */
  ogImageFor?: string;
  /** Accent colour overrides. For more, override the `--site-*` tokens in `customCss`. */
  theme?: { accent?: string; accentDark?: string };
  /** Content of the built-in landing page at `/`, or `false` for none (or add your own src/pages/index.astro). */
  landing?: false | LandingContent;
  /**
   * The built-in gallery page, or `false` for none. `route` is its URL path (default `gallery`: /gallery/); `title`
   * and `description` default to the `gallery` and `galleryDescription` labels.
   */
  gallery?: false | { route?: string; title?: string; description?: string };
  /**
   * Posts from src/content/blog/ at /blog/ (list, posts, tags, RSS), or `true` for the defaults. Off unless set.
   */
  blog?: boolean | BlogOptions;
  /**
   * Footer text. `note`: extra text, e.g. a licence line. `copyright`: the copyright line, with `{year}` (the build
   * year) and `{name}` filled in; default the `copyright` label ("© {year} {name}"); `false` leaves it out.
   */
  footer?: { note?: string; copyright?: string | false };
  /**
   * The words the template puts on pages (buttons, screen-reader names, empty states, alert titles), by name.
   * They follow the site's language (Starlight's root or default locale): built in for English, French, German
   * and Spanish, English for anything else. Set any of them here, in any language.
   */
  labels?: Partial<Labels>;
  /** Serve /llms.txt and /llms-full.txt. Default `true`. */
  llms?: boolean;
  /**
   * Options for starlight-links-validator, which fails the build on a broken link in a docs page, or `false` to
   * turn it off. Links to the landing page, the gallery, llms.txt and mirrored folders are always accepted;
   * `exclude` adds to that list.
   */
  linksValidator?: false | Record<string, unknown>;
  /** Stylesheets (relative to the project root) loaded on every page after theme.css: override tokens here. */
  customCss?: string[];
  /** Replace built-in components. */
  components?: ComponentOverrides;
  /**
   * Extra Starlight options, passed through. List options are appended to the ones projectSite() sets:
   * `sidebar` (after the generated sidebar), `plugins`, `customCss` (docs pages only), `routeMiddleware`,
   * `markdown.processedDirs`. `components` entries override ours (e.g. your own `Header` replaces the shared one).
   */
  starlight?: Record<string, unknown>;

  // ── markdown ──
  /** GitHub-flavoured markdown extras, on every page that renders markdown. Each switch defaults to `true`. */
  markdown?: MarkdownOptions;
}

/** Switches for the markdown extras (src/markdown/). All default to `true`. */
export interface MarkdownOptions {
  /** `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` blockquotes as callouts. */
  alerts?: boolean;
  /** `:tada:` shortcodes (GitHub's names) as emoji. */
  emoji?: boolean;
  /** `$…$`, `$$…$$` and ```` ```math ```` blocks rendered with KaTeX; its CSS loads only on pages with math. */
  math?: boolean;
  /** ```` ```mermaid ```` diagrams, rendered in the browser; Mermaid loads only on pages with diagrams. */
  mermaid?: boolean;
  /** Anchor links on headings in markdown outside the docs (Starlight adds its own on docs pages). */
  headingLinks?: boolean;
  /** A "wrap lines" button on code blocks whose lines overflow. */
  codeWrapToggle?: boolean;
}

/** The options after validation and defaults (what projectSite() works with internally). */
export interface ResolvedOptions extends Omit<ProjectSiteOptions, 'landing' | 'externalDocs' | 'mirrors' | 'blog'> {
  repoBranch: string;
  nav: LinkAction[];
  externalDocs: ExternalDocs[];
  docsOrder: string[];
  mirrors: Mirror[];
  favicon: string;
  theme: { accent?: string; accentDark?: string };
  landing: false | ResolvedLanding;
  gallery: false | { route: string; title: string; description: string };
  blog: false | ResolvedBlog;
  footer: { note?: string; copyright?: string | false };
  labels: Labels;
  llms: boolean;
  customCss: string[];
  head: HeadTag[];
  components: ComponentOverrides;
  starlight: Record<string, unknown>;
  markdown: MarkdownOptions;
}

/** A label: text with `{name}` placeholders, or plural forms by Intl.PluralRules category (`other` required). */
export type Label = string | { other: string; zero?: string; one?: string; two?: string; few?: string; many?: string };

/** Every label the template uses, by name. The English defaults are in `src/labels.mjs`. */
export type Labels = { [K in keyof typeof import('./labels.mjs').EN]: Label };

/** A `<head>` tag, same shape as Starlight's `head` entries. */
export interface HeadTag {
  tag: 'title' | 'base' | 'link' | 'style' | 'meta' | 'script' | 'noscript' | 'template';
  attrs?: Record<string, string | boolean | undefined>;
  content?: string;
}

export interface ResolvedLanding extends Omit<LandingContent, 'features' | 'steps' | 'docs'> {
  docs?: false | { title: string; intro?: string };
  features?: { title?: string; intro?: string; items: Feature[] };
  steps?: { title?: string; intro?: string; items: Step[] };
}

/** What components get from `virtual:astro-project-site/config` (or `astro-project-site/config`). */
/** An `externalDocs` entry as the site sees it: a `git` entry has been downloaded, so every entry has a `dir`. */
export interface MountedDocs extends ExternalDocs {
  /** The markdown folder, relative to the project root: as configured, or where a `git` source was downloaded. */
  dir: string;
  /** For a `git` entry: where its files came from (links and edit links use it). */
  source?: {
    /** The downloaded repository's folder, relative to the project root. */
    root: string;
    /** Its browser URL (`https://host/owner/repo`); none for `file://` sources. */
    web?: string;
    ref: string;
    /** The commit `ref` pointed at when it was downloaded. */
    commit: string;
    /** Its default branch, where "Edit page" goes. */
    editBranch?: string;
  };
}

export interface SiteConfig
  extends Omit<ResolvedOptions, 'components' | 'starlight' | 'customCss' | 'ogImageFor' | 'mirrors' | 'externalDocs'> {
  externalDocs: MountedDocs[];
  /** `version` read from `versionFrom` at startup. */
  version?: string;
  /** Language of the non-docs pages: Starlight's root (or default) locale, else `en`. */
  lang: string;
  /** Text direction of that locale. */
  dir: 'ltr' | 'rtl';
}

export interface OgImageRequest {
  /** Path of the page, e.g. `/gallery/` or `/docs/reference/api/`. */
  path: string;
  title: string;
  description: string;
}

/** Returns the social image (absolute or root-relative URL) for a page, or undefined for none. */
export type OgImageHook = (page: OgImageRequest) => string | undefined;

/** Frontmatter/data of one gallery item (src/content/gallery/*.{yaml,json,md}). */
export interface GalleryData {
  title: string;
  description: string;
  /** Where the card links: a site path or a full URL. */
  href: string;
  /** Free-form category used by the filter. Default `example`. */
  kind: string;
  /** Poster next to the entry file, optimised at build time. */
  poster?: import('astro').ImageMetadata;
  /** Poster served as-is: a public/ or mirrored path, or a full URL. */
  posterUrl?: string;
  /** Alt text for the poster; empty (default) marks it decorative. */
  posterAlt: string;
  /** Crisp pixel-art scaling. */
  pixelated: boolean;
  tags: string[];
  /** Ascending; ties sort by title. Default 100. */
  order: number;
  /** Adds an "external site" marker. */
  external: boolean;
  draft: boolean;
}

/** One gallery item, as `getCollection('gallery')` returns it. */
export interface GalleryEntry {
  id: string;
  collection: 'gallery';
  data: GalleryData;
  body?: string;
  filePath?: string;
}

/** The integration. Add it to `integrations` in astro.config.mjs; it sets up Starlight itself. */
export default function projectSite(options: ProjectSiteOptions): AstroIntegration;

/** The static-apps mirror on its own (projectSite() already includes it). */
export function mirror(entries?: Mirror[]): AstroIntegration;
/** Every top-level option name `projectSite()` accepts (`name`, `tagline`, … `starlight`). */
export const OPTION_NAMES: readonly (keyof ProjectSiteOptions)[];
/** The component slots `components` can replace. */
export const COMPONENT_NAMES: readonly (keyof ComponentOverrides)[];
