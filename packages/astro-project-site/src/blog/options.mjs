// The `blog` option: schema, defaults, and what the integration derives from it (head tags, links to accept).
// Pure (astro/zod only) so it can be unit-tested without Astro running.
import { z } from 'astro/zod';

export const BLOG_DEFAULTS = Object.freeze({
  route: 'blog',
  title: 'Blog',
  postsPerPage: 10,
  rss: true,
  landing: Object.freeze({ title: 'Latest posts', limit: 3 }),
});

/** A URL path option (`blog`, `news/posts`): no leading or trailing slash, no `.`/`..` segments. */
export const routeSchema = z
  .string()
  .transform((r) => r.replace(/^\/+|\/+$/g, ''))
  .refine(
    (r) => !!r && r.split('/').every((s) => s && s !== '.' && s !== '..' && /^[\w.~-]+$/.test(s)),
    'must be a URL path like "blog" or "news/posts"',
  );

const author = z.strictObject({
  name: z.string().min(1),
  url: z.string().min(1).optional(),
  avatar: z.string().min(1).optional(),
});

/** `blog: true | { ... }`; `false` (or absent) means no blog. Normalised to `false` or the full object by resolveBlog(). */
export const blogOptionSchema = z.union([
  z.boolean(),
  z.strictObject({
    route: routeSchema.optional(),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    authors: z.record(z.string(), author).optional(),
    postsPerPage: z.number().int().min(1).optional(),
    rss: z.boolean().optional(),
    landing: z
      .union([z.literal(false), z.strictObject({ title: z.string().optional(), limit: z.number().int().min(0).optional() })])
      .optional(),
  }),
], { error: 'expected true, false or { route?, title?, description?, authors?, postsPerPage?, rss?, landing? }' });

/**
 * The blog option with every default filled in, or `false`.
 * @param {unknown} value the parsed `blog` option
 * @param {string} tagline default description
 * @param {{ blog: unknown, latestPosts: unknown }} [labels] default titles, in the site's language
 * @returns {false | import('../index').ResolvedBlog}
 */
export function resolveBlog(value, tagline, labels) {
  if (!value) return false;
  const o = /** @type {Record<string, any>} */ (value === true ? {} : value);
  return {
    route: o.route ?? BLOG_DEFAULTS.route,
    title: o.title ?? (typeof labels?.blog === 'string' ? labels.blog : BLOG_DEFAULTS.title),
    description: o.description ?? tagline,
    authors: o.authors ?? {},
    postsPerPage: o.postsPerPage ?? BLOG_DEFAULTS.postsPerPage,
    rss: o.rss ?? BLOG_DEFAULTS.rss,
    landing:
      o.landing === false
        ? false
        : {
            ...BLOG_DEFAULTS.landing,
            ...(typeof labels?.latestPosts === 'string' ? { title: labels.latestPosts } : {}),
            ...o.landing,
          },
  };
}

/** `/blog/rss.xml` for a resolved blog. */
export const rssPath = (/** @type {{ route: string }} */ blog) => `/${blog.route}/rss.xml`;

/**
 * `<link rel="alternate">` for the feed, added to the `head` of every page (landing, docs, posts) when RSS is on.
 * @param {false | import('../index').ResolvedBlog} blog
 * @param {string} siteName
 * @returns {import('../index').HeadTag[]}
 */
export function blogHeadTags(blog, siteName) {
  if (!blog || !blog.rss) return [];
  return [
    {
      tag: 'link',
      attrs: { rel: 'alternate', type: 'application/rss+xml', title: `${siteName}: ${blog.title}`, href: rssPath(blog) },
    },
  ];
}

/** Paths starlight-links-validator should accept (it only knows docs pages). */
export function blogKnownLinks(/** @type {false | { route: string }} */ blog) {
  if (!blog) return [];
  return [`/${blog.route}`, `/${blog.route}/`, `/${blog.route}/**`];
}
