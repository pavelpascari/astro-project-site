// Pure helpers for the blog: post ids, reading time, tags, pagination, the page list the blog route builds, RSS
// items. No Astro imports (node --test runs them directly); the Astro side is blog/data.ts and routes/blog/.
//
// A "post" here is anything shaped like a `blog` collection entry: `{ id, filePath?, body?, data: { title,
// description, date, updated?, authors?, tags?, draft? } }`.

/**
 * @typedef {{ title: string, description: string, date: Date, updated?: Date, authors?: string[], tags?: string[],
 *   draft?: boolean, image?: unknown, imageAlt?: string, canonical?: string }} PostData
 * @typedef {{ id: string, filePath?: string, body?: string, data: PostData }} Post
 * @typedef {{ name: string, url?: string, avatar?: string }} Author
 * @typedef {{ tag: string, slug: string, count: number }} TagInfo
 */

const POST_EXT = /\.(md|mdx)$/i;

/**
 * The id (and URL) of a post from its path relative to the blog folder: the path without its extension, each
 * segment lowercased with spaces turned into dashes. `2026/My Post.md` → `2026/my-post`. A folder's `index.md`
 * takes the folder's id (`2026/launch/index.mdx` → `2026/launch`), so a post can keep its images beside it.
 */
export function postId(/** @type {string} */ relPath) {
  const parts = relPath
    .replace(/\\/g, '/')
    .replace(POST_EXT, '')
    .split('/')
    .filter(Boolean)
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, '-'));
  if (parts.length > 1 && parts.at(-1) === 'index') parts.pop();
  return parts.join('/');
}

/** Why a post id cannot be a URL under the blog route (it would collide with a built-in page), or undefined. */
export function reservedIdProblem(/** @type {string} */ id) {
  const first = id.split('/')[0];
  if (id === 'index' || id === '') return 'it would replace the post list';
  if (/^\d+$/.test(id)) return `"${id}" is a page number of the post list (/2/, /3/, ...)`;
  if (first === 'tags') return '"tags" is the tag index';
  if (id === 'rss.xml') return '"rss.xml" is the feed';
  return undefined;
}

// ---------- reading time ----------

/** Words in a markdown/MDX body: prose counts fully, code at half weight; imports, tags and URLs not at all. */
export function wordCount(/** @type {string} */ body) {
  let prose = 0;
  let code = 0;
  let inFence = false;
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      code += countWords(line);
      continue;
    }
    if (/^\s*(import|export)\s/.test(line)) continue;
    const text = line
      .replace(/<\/?[A-Za-z][^<>]*>/g, ' ') // HTML and JSX tags (their text content stays; [^<>] keeps it linear)
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images: keep the label
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[{}]/g, ' ');
    prose += countWords(text);
  }
  return Math.round(prose + code / 2);
}

const countWords = (/** @type {string} */ s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) ?? []).length;

/** Minutes to read a body at `wpm` words per minute, at least 1. */
export function readingTime(/** @type {string | undefined} */ body, wpm = 230) {
  return Math.max(1, Math.round(wordCount(body ?? '') / wpm));
}

// ---------- ordering, drafts, authors ----------

/** Newest first; same day: by title. */
export function sortPosts(/** @type {Post[]} */ posts) {
  return [...posts].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.data.title.localeCompare(b.data.title));
}

/** Drafts are built only in dev (`showDrafts`), where they carry a badge. */
export function visiblePosts(/** @type {Post[]} */ posts, /** @type {boolean} */ showDrafts) {
  return posts.filter((p) => showDrafts || !p.data.draft);
}

/** The posts either side of `id` in a newest-first list. */
export function adjacentPosts(/** @type {Post[]} */ sorted, /** @type {string} */ id) {
  const i = sorted.findIndex((p) => p.id === id);
  return { newer: i > 0 ? sorted[i - 1] : undefined, older: i >= 0 && i < sorted.length - 1 ? sorted[i + 1] : undefined };
}

/** `authors` frontmatter → people: keys of the `blog.authors` option, or free names used as they are. */
export function resolveAuthors(/** @type {string[] | undefined} */ keys, /** @type {Record<string, Author>} */ registry = {}) {
  return (keys ?? []).map((key) => registry[key] ?? { name: key });
}

// ---------- URLs ----------

/** `/blog/` for page 1, `/blog/2/` for page 2, ... */
export const listUrl = (/** @type {string} */ route, page = 1) => (page <= 1 ? `/${route}/` : `/${route}/${page}/`);
export const postUrl = (/** @type {string} */ route, /** @type {string} */ id) => `/${route}/${id}/`;
export const tagsUrl = (/** @type {string} */ route) => `/${route}/tags/`;
export const tagUrl = (/** @type {string} */ route, /** @type {string} */ tag) => `/${route}/tags/${tagSlug(tag)}/`;

/** URL segment for a tag: lowercase, spaces to dashes, other punctuation dropped (`Web Components` → `web-components`). */
export function tagSlug(/** @type {string} */ tag) {
  return tag.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').replace(/-+/g, '-') || 'tag';
}

/** "Edit this post" link: the edit base of the site folder (see docs/mount.mjs) plus the file path under it. */
export function editUrl(/** @type {string | undefined} */ editBase, /** @type {string | undefined} */ filePath) {
  if (!editBase || !filePath) return undefined;
  return editBase + filePath.replace(/\\/g, '/').replace(/^\.\//, '').split('/').map(encodeURIComponent).join('/');
}

// ---------- tags and pages ----------

/** Every tag with its post count, most used first, then by name. Tags that slug the same are merged (first spelling wins). */
export function collectTags(/** @type {Post[]} */ posts) {
  /** @type {Map<string, TagInfo>} */
  const bySlug = new Map();
  for (const post of posts) {
    for (const tag of new Set(post.data.tags ?? [])) {
      const slug = tagSlug(tag);
      const info = bySlug.get(slug) ?? { tag, slug, count: 0 };
      info.count += 1;
      bySlug.set(slug, info);
    }
  }
  return [...bySlug.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Posts carrying a tag (compared by slug). */
export function postsWithTag(/** @type {Post[]} */ posts, /** @type {string} */ slug) {
  return posts.filter((p) => (p.data.tags ?? []).some((t) => tagSlug(t) === slug));
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} perPage
 * @returns {{ items: T[], current: number, last: number }[]} at least one page, even when empty
 */
export function paginate(items, perPage) {
  const last = Math.max(1, Math.ceil(items.length / perPage));
  return Array.from({ length: last }, (_, i) => ({ items: items.slice(i * perPage, (i + 1) * perPage), current: i + 1, last }));
}

/**
 * @typedef {{ kind: 'list', posts: Post[], current: number, last: number, total: number }
 *   | { kind: 'post', post: Post, newer?: Post, older?: Post }
 *   | { kind: 'tags', tags: TagInfo[] }
 *   | { kind: 'tag', tag: TagInfo, posts: Post[] }} BlogPage
 */

/**
 * Every page under the blog route, as `getStaticPaths()` entries for the `[...path]` route: the post list
 * (paginated), each post, the tag index and one page per tag. `posts` must be sorted newest first.
 * @param {Post[]} posts
 * @param {{ postsPerPage: number }} blog
 * @returns {{ params: { path: string | undefined }, props: BlogPage }[]}
 */
export function blogPages(posts, blog) {
  for (const post of posts) {
    const problem = reservedIdProblem(post.id);
    if (problem) {
      throw new Error(`Blog post ${post.filePath ?? post.id} cannot be published at "${post.id}/": ${problem}. Rename the file.`);
    }
  }
  const tags = collectTags(posts);
  return [
    ...paginate(posts, blog.postsPerPage).map((page) => ({
      params: { path: page.current === 1 ? undefined : String(page.current) },
      props: /** @type {BlogPage} */ ({ kind: 'list', posts: page.items, current: page.current, last: page.last, total: posts.length }),
    })),
    ...posts.map((post) => ({
      params: { path: post.id },
      props: /** @type {BlogPage} */ ({ kind: 'post', post, ...adjacentPosts(posts, post.id) }),
    })),
    ...(tags.length ? [{ params: { path: 'tags' }, props: /** @type {BlogPage} */ ({ kind: 'tags', tags }) }] : []),
    ...tags.map((tag) => ({
      params: { path: `tags/${tag.slug}` },
      props: /** @type {BlogPage} */ ({ kind: 'tag', tag, posts: postsWithTag(posts, tag.slug) }),
    })),
  ];
}

// ---------- feed ----------

/**
 * Items for @astrojs/rss: title, absolute link, date, the description as the summary, tags as categories and
 * authors as `dc:creator`. Drafts are left out.
 * @param {Post[]} posts sorted newest first
 * @param {{ route: string, siteUrl: string, authors?: Record<string, Author> }} ctx
 */
export function rssItems(posts, { route, siteUrl, authors = {} }) {
  const base = siteUrl.replace(/\/+$/, '');
  return posts
    .filter((p) => !p.data.draft)
    .map((p) => {
      const creators = resolveAuthors(p.data.authors, authors).map((a) => `<dc:creator>${escapeXml(a.name)}</dc:creator>`);
      return {
        title: p.data.title,
        link: base + postUrl(route, p.id),
        pubDate: p.data.date,
        description: p.data.description,
        ...(p.data.tags?.length ? { categories: p.data.tags } : {}),
        ...(creators.length ? { customData: creators.join('') } : {}),
      };
    });
}

export const escapeXml = (/** @type {string} */ s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A date as the page shows it: `20 November 2026` (UTC: frontmatter dates have no time zone). */
export function formatDate(/** @type {Date} */ date, lang = 'en') {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
