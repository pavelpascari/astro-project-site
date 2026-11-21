// Options for projectSite(): the schema, validation with readable errors, and path resolution.
// Pure (node: modules and astro/zod only) so it can be unit-tested without Astro running.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'astro/zod';
import { blogOptionSchema, resolveBlog, routeSchema } from './blog/options.mjs';
import { EN, format, resolveLabels, siteLocale } from './labels.mjs';

const link = z.strictObject({ label: z.string().min(1), href: z.string().min(1) });

/** A feature/step list: either the items, or `{ title, intro, items }` to also set the section heading. */
/**
 * @param {import('astro/zod').ZodType} item
 * The heading defaults to a label in the site's language (filled in by parseOptions).
 */
const section = (/** @type {import('astro/zod').ZodType} */ item) =>
  z
    .union([z.array(item), z.strictObject({ title: z.string().optional(), intro: z.string().optional(), items: z.array(item) })])
    .transform((v) => (Array.isArray(v) ? { items: v } : v));

/** One label: a string, or plural forms (`other` required). */
const labelValue = z.union([
  z.string(),
  z.strictObject({
    other: z.string(),
    zero: z.string().optional(),
    one: z.string().optional(),
    two: z.string().optional(),
    few: z.string().optional(),
    many: z.string().optional(),
  }),
]);

const demo = z.strictObject({
  code: z.string(),
  lang: z.string().optional(),
  title: z.string().optional(),
  caption: z.string().optional(),
  mode: z.enum(['inline', 'iframe']).optional(),
  preview: z.enum(['above', 'below', 'side']).optional(),
  runner: z.string().optional(),
  editable: z.boolean().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
  modules: z.array(z.string()).optional(),
  base: z.string().optional(),
  height: z.union([z.number(), z.string()]).optional(),
});

const landing = z.strictObject({
  hero: z
    .strictObject({
      title: z.string().optional(),
      lead: z.string().optional(),
      primary: link.optional(),
      secondary: link.optional(),
      demo: demo.optional(),
    })
    .optional(),
  features: section(z.strictObject({ title: z.string(), body: z.string(), href: z.string().optional() })).optional(),
  // The cards for the top-level docs sections, shown when there are no `features` (and at least two sections).
  docs: z.union([z.literal(false), z.strictObject({ title: z.string().optional(), intro: z.string().optional() })]).optional(),
  steps: section(
    z.strictObject({ title: z.string(), body: z.string(), code: z.string().optional(), lang: z.string().optional() }),
  ).optional(),
  gallery: z.strictObject({ title: z.string().optional(), intro: z.string().optional(), limit: z.number().int().min(0).optional() }).optional(),
  cta: z
    .strictObject({ title: z.string(), body: z.string().optional(), primary: link.optional(), secondary: link.optional() })
    .optional(),
});

/** Component slots a project can replace. Values are paths relative to the project root, or package specifiers. */
export const COMPONENT_NAMES = /** @type {const} */ ([
  'Header',
  'Footer',
  'Hero',
  'Landing',
  'GalleryCard',
  'Gallery',
  'BlogIndex',
  'BlogPost',
  'BlogCard',
]);

export const optionsSchema = z.strictObject({
  name: z.string().min(1),
  tagline: z.string(),
  url: z.url().transform((u) => u.replace(/\/+$/, '')),
  repo: z.url().transform((u) => u.replace(/\/+$/, '')),
  repoBranch: z.string().min(1).default('main'),
  versionFrom: z.string().optional(),
  nav: z.array(link).optional(),
  externalDocs: z
    .array(
      z.strictObject({
        dir: z.string().min(1),
        route: z.string().refine((r) => r.split('/').some(Boolean), 'must not be empty'),
        label: z.string().min(1),
        description: z.string().min(1).optional(),
        order: z.array(z.string()).optional(),
        exclude: z.array(z.string()).optional(),
        include: z.array(z.string().min(1)).min(1).optional(),
      }),
    )
    .default([]),
  mirrors: z
    .array(
      z.strictObject({
        from: z.string().min(1),
        to: z
          .string()
          .refine(
            (to) => {
              const clean = to.replace(/^\/+|\/+$/g, '');
              return !!clean && clean.split('/').every((s) => s && s !== '.' && s !== '..' && !s.startsWith('.'));
            },
            'must be a URL prefix like "apps" or "pixel/src"',
          ),
        include: z.array(z.string()).optional(),
        exclude: z.array(z.string()).optional(),
      }),
    )
    .default([]),
  install: z.string().optional(),
  favicon: z.string().default('/favicon.svg'),
  ogImage: z.string().optional(),
  ogImageFor: z.string().optional(),
  theme: z.strictObject({ accent: z.string().optional(), accentDark: z.string().optional() }).default({}),
  landing: z.union([z.literal(false), landing]).default({}),
  gallery: z
    .union([
      z.literal(false),
      z.strictObject({ route: routeSchema.optional(), title: z.string().optional(), description: z.string().optional() }),
    ])
    .default({}),
  // Posts in src/content/blog/, at /<route>/ (see blog/options.mjs). Off unless set; `true` uses the defaults.
  blog: blogOptionSchema.default(false),
  footer: z
    .strictObject({ note: z.string().optional(), copyright: z.union([z.literal(false), z.string()]).optional() })
    .default({}),
  // Words the template puts on pages, by name (see src/labels.mjs). Built-in translations follow the site's language.
  labels: z.strictObject(Object.fromEntries(Object.keys(EN).map((k) => [k, labelValue.optional()]))).default({}),
  llms: z.boolean().default(true),
  linksValidator: z.union([z.literal(false), z.record(z.string(), z.unknown())]).optional(),
  customCss: z.array(z.string()).default([]),
  // Tags added to the <head> of every page, docs included (same shape as Starlight's `head`).
  head: z
    .array(
      z.strictObject({
        tag: z.enum(['title', 'base', 'link', 'style', 'meta', 'script', 'noscript', 'template']),
        attrs: z.record(z.string(), z.union([z.string(), z.boolean(), z.undefined()])).optional(),
        content: z.string().optional(),
      }),
    )
    .default([]),
  components: z.strictObject(Object.fromEntries(COMPONENT_NAMES.map((n) => [n, z.string().min(1).optional()]))).default({}),
  starlight: z.record(z.string(), z.unknown()).default({}),

  // ── markdown (src/markdown/): GitHub-flavoured rendering switches, all on by default ──
  markdown: z
    .strictObject({
      alerts: z.boolean().optional(),
      emoji: z.boolean().optional(),
      math: z.boolean().optional(),
      mermaid: z.boolean().optional(),
      headingLinks: z.boolean().optional(),
      codeWrapToggle: z.boolean().optional(),
    })
    .default({}),
});

/** Every top-level option projectSite() accepts, for tools that check a config without hardcoding the list. */
export const OPTION_NAMES = /** @type {readonly string[]} */ (Object.freeze(Object.keys(optionsSchema.shape)));

export class ProjectSiteOptionsError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`Invalid projectSite() options:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ProjectSiteOptionsError';
    this.problems = problems;
  }
}

/** Human-readable path of an issue: `landing.hero.primary.href`, `mirrors[0].to`. */
function issuePath(/** @type {PropertyKey[]} */ p) {
  return p.reduce((/** @type {string} */ s, k) => (typeof k === 'number' ? `${s}[${k}]` : s ? `${s}.${String(k)}` : String(k)), '');
}

function describeIssue(/** @type {any} */ issue) {
  const where = issuePath(issue.path ?? []);
  if (issue.code === 'unrecognized_keys') {
    const keys = issue.keys.map((/** @type {string} */ k) => `"${k}"`).join(', ');
    return `${where ? `${where}: ` : ''}unknown option${issue.keys.length > 1 ? 's' : ''} ${keys}`;
  }
  if (issue.code === 'invalid_union' && Array.isArray(issue.errors)) {
    // Report the branch that got furthest (deepest issue path) instead of "invalid input".
    const depth = (/** @type {any[]} */ branch) => Math.max(...branch.map((i) => i.path?.length ?? 0));
    const best = [...issue.errors].sort((/** @type {any[]} */ a, /** @type {any[]} */ b) => depth(b) - depth(a) || a.length - b.length)[0];
    // Nothing deeper: a branch that failed on something other than its type (e.g. an unknown key in the object
    // form of `true | { ... }`) says more than "expected boolean".
    const telling = best && depth(best) > 0 ? best : issue.errors.find((/** @type {any[]} */ b) => b.some((i) => !/^invalid_(type|value)$/.test(i.code)));
    if (telling?.length) {
      return telling.map((/** @type {any} */ i) => describeIssue({ ...i, path: [...(issue.path ?? []), ...(i.path ?? [])] })).join('; ');
    }
  }
  return `${where || '(options)'}: ${issue.message}`;
}

/**
 * Validates and normalises projectSite() options. Throws ProjectSiteOptionsError naming every bad field.
 * @param {unknown} input
 * @returns {import('./index').ResolvedOptions}
 */
export function parseOptions(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ProjectSiteOptionsError(['projectSite() expects an options object with at least name, tagline, url and repo.']);
  }
  const result = optionsSchema.safeParse(input);
  if (!result.success) throw new ProjectSiteOptionsError(result.error.issues.map(describeIssue));
  const options = /** @type {any} */ (result.data);
  const { lang } = siteLocale(options.starlight);
  const labels = resolveLabels(lang, options.labels);
  options.labels = labels;
  const text = (/** @type {keyof typeof EN} */ name) => format(labels[name], {}, lang);
  options.blog = resolveBlog(options.blog, options.tagline, { blog: text('blog'), latestPosts: text('latestPosts') });
  if (options.gallery !== false) {
    options.gallery = {
      ...options.gallery,
      route: options.gallery.route ?? 'gallery',
      title: options.gallery.title ?? text('gallery'),
      description: options.gallery.description ?? text('galleryDescription'),
    };
  }
  if (options.landing) {
    const l = options.landing;
    if (l.features) l.features = { title: text('featuresTitle'), ...l.features };
    if (l.steps) l.steps = { title: text('stepsTitle'), ...l.steps };
    if (l.docs !== false) l.docs = { title: text('documentation'), ...l.docs };
  }
  options.nav ??= [
    { label: text('docs'), href: '/docs/' },
    ...(options.gallery === false ? [] : [{ label: options.gallery.title, href: `/${options.gallery.route}/` }]),
    ...(options.blog ? [{ label: options.blog.title, href: `/${options.blog.route}/` }] : []),
  ];
  return options;
}

/** A path option: relative (`./x`, `../x`) or absolute paths resolve against `root`; anything else is a package specifier. */
export function resolveModulePath(/** @type {string} */ id, /** @type {string} */ root) {
  if (id.startsWith('.') || path.isAbsolute(id)) return path.resolve(root, id);
  return id;
}

/**
 * Resolves every file path in the options against the project root and checks that local files exist.
 * @param {import('./index').ResolvedOptions} options
 * @param {string} root absolute project root
 */
export function resolveOptionPaths(options, root) {
  /** @type {string[]} */
  const problems = [];
  const local = (/** @type {string} */ field, /** @type {string} */ id) => {
    const resolved = resolveModulePath(id, root);
    if (path.isAbsolute(resolved) && !existsSync(resolved)) {
      problems.push(`${field}: "${id}" resolves to ${resolved}, which does not exist (paths are relative to the project root)`);
    }
    return resolved;
  };
  /** @type {Record<string, string>} */
  const components = {};
  for (const [name, id] of Object.entries(options.components)) if (id) components[name] = local(`components.${name}`, id);
  const resolved = {
    components,
    customCss: options.customCss.map((id, i) => local(`customCss[${i}]`, id)),
    ogImageFor: options.ogImageFor ? local('ogImageFor', options.ogImageFor) : undefined,
    versionFrom: options.versionFrom ? local('versionFrom', options.versionFrom) : undefined,
  };
  options.externalDocs.forEach((d, i) => local(`externalDocs[${i}].dir`, d.dir));
  if (problems.length) throw new ProjectSiteOptionsError(problems);
  return resolved;
}
