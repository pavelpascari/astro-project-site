import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLOG_DEFAULTS, blogHeadTags, blogKnownLinks, resolveBlog } from '../src/blog/options.mjs';
import {
  adjacentPosts,
  blogPages,
  collectTags,
  editUrl,
  formatDate,
  listUrl,
  paginate,
  postId,
  postsWithTag,
  readingTime,
  reservedIdProblem,
  resolveAuthors,
  rssItems,
  sortPosts,
  tagSlug,
  tagUrl,
  visiblePosts,
  wordCount,
} from '../src/blog/posts.mjs';
import { parseOptions, ProjectSiteOptionsError } from '../src/options.mjs';

const base = { name: 'Lib', tagline: 'Does a thing.', url: 'https://lib.dev', repo: 'https://github.com/me/lib' };

function problems(/** @type {unknown} */ blog) {
  try {
    parseOptions({ ...base, blog });
    return [];
  } catch (error) {
    assert.ok(error instanceof ProjectSiteOptionsError, String(error));
    return error.problems;
  }
}

/** @param {string} id @param {string} date @param {Record<string, unknown>} [data] */
const post = (id, date, data = {}) => ({
  id,
  filePath: `src/content/blog/${id}.md`,
  body: 'word '.repeat(10),
  data: { title: id, description: `About ${id}`, date: new Date(date), tags: [], authors: [], draft: false, ...data },
});

// ---------- options ----------

test('blog is off unless set; true means the defaults', () => {
  assert.equal(parseOptions(base).blog, false);
  assert.equal(parseOptions({ ...base, blog: false }).blog, false);
  assert.deepEqual(parseOptions({ ...base, blog: true }).blog, {
    route: 'blog',
    title: 'Blog',
    description: 'Does a thing.',
    authors: {},
    postsPerPage: 10,
    rss: true,
    landing: { title: 'Latest posts', limit: 3 },
  });
});

test('blog object form: values kept, route trimmed, landing merged with defaults', () => {
  const blog = /** @type {any} */ (
    parseOptions({
      ...base,
      blog: { route: '/news/', title: 'News', postsPerPage: 5, rss: false, landing: { limit: 6 }, authors: { p: { name: 'P' } } },
    }).blog
  );
  assert.equal(blog.route, 'news');
  assert.equal(blog.title, 'News');
  assert.equal(blog.postsPerPage, 5);
  assert.equal(blog.rss, false);
  assert.deepEqual(blog.landing, { title: 'Latest posts', limit: 6 });
  assert.deepEqual(blog.authors, { p: { name: 'P' } });
  assert.equal(/** @type {any} */ (parseOptions({ ...base, blog: { landing: false } }).blog).landing, false);
});

test('blog adds a nav item to the default nav only', () => {
  assert.deepEqual(parseOptions({ ...base, blog: { title: 'News', route: 'news' } }).nav.at(-1), { label: 'News', href: '/news/' });
  assert.deepEqual(parseOptions({ ...base, blog: true, nav: [{ label: 'X', href: '/x/' }] }).nav, [{ label: 'X', href: '/x/' }]);
});

test('bad blog options are named readably', () => {
  assert.deepEqual(problems({ routee: 'x' }), ['blog: unknown option "routee"']);
  assert.match(problems('yes')[0], /^blog: expected true, false or \{ route\?/);
  assert.match(problems({ route: '../x' })[0], /^blog\.route: must be a URL path/);
  assert.match(problems({ route: '' })[0], /^blog\.route: /);
  assert.match(problems({ postsPerPage: 0 })[0], /^blog\.postsPerPage: /);
  assert.match(problems({ landing: { titel: 'x' } })[0], /^blog\.landing: unknown option "titel"/);
  assert.ok(problems({ authors: { p: { url: 'x' } } }).some((p) => p.startsWith('blog.authors.p.name:')));
});

test('resolveBlog, head tags and known links', () => {
  assert.equal(resolveBlog(undefined, 't'), false);
  assert.equal(/** @type {any} */ (resolveBlog(true, 't')).postsPerPage, BLOG_DEFAULTS.postsPerPage);
  const blog = /** @type {any} */ (resolveBlog({ route: 'news', title: 'News' }, 't'));
  assert.deepEqual(blogHeadTags(blog, 'Lib'), [
    { tag: 'link', attrs: { rel: 'alternate', type: 'application/rss+xml', title: 'Lib: News', href: '/news/rss.xml' } },
  ]);
  assert.deepEqual(blogHeadTags({ ...blog, rss: false }, 'Lib'), []);
  assert.deepEqual(blogHeadTags(false, 'Lib'), []);
  assert.deepEqual(blogKnownLinks(blog), ['/news', '/news/', '/news/**']);
});

// ---------- ids and URLs ----------

test('post ids are the path without extension; index takes the folder', () => {
  assert.equal(postId('2026/introducing-my-lib.md'), '2026/introducing-my-lib');
  assert.equal(postId('hello.mdx'), 'hello');
  assert.equal(postId('2026/Launch Day/index.mdx'), '2026/launch-day');
  assert.equal(postId('2026\\win.md'), '2026/win');
  assert.equal(postId('index.md'), 'index');
});

test('ids that collide with built-in blog pages are reported', () => {
  assert.equal(reservedIdProblem('2026/introducing-my-lib'), undefined);
  assert.equal(reservedIdProblem('2026x'), undefined);
  assert.match(reservedIdProblem('2') ?? '', /page number/);
  assert.match(reservedIdProblem('tags') ?? '', /tag index/);
  assert.match(reservedIdProblem('tags/astro') ?? '', /tag index/);
  assert.match(reservedIdProblem('index') ?? '', /post list/);
  assert.throws(() => blogPages([post('3', '2026-01-01')], { postsPerPage: 10 }), /src\/content\/blog\/3\.md cannot be published/);
});

test('URLs', () => {
  assert.equal(listUrl('blog'), '/blog/');
  assert.equal(listUrl('blog', 1), '/blog/');
  assert.equal(listUrl('blog', 3), '/blog/3/');
  assert.equal(tagUrl('news', 'Web Components'), '/news/tags/web-components/');
  assert.equal(tagSlug('C++ & Rust!'), 'c-rust');
  assert.equal(tagSlug('Ünïcode'), 'ünïcode');
  assert.equal(tagSlug('!!!'), 'tag');
  assert.equal(
    editUrl('https://github.com/me/lib/edit/main/site/', 'src/content/blog/2026/a b.md'),
    'https://github.com/me/lib/edit/main/site/src/content/blog/2026/a%20b.md',
  );
  assert.equal(editUrl(undefined, 'x.md'), undefined);
});

// ---------- reading time ----------

test('reading time: words at 230 wpm, at least a minute; code at half weight; imports and tags ignored', () => {
  assert.equal(readingTime(''), 1);
  assert.equal(readingTime(undefined), 1);
  assert.equal(readingTime('word '.repeat(230 * 5)), 5);
  assert.equal(wordCount("import { X } from 'y';\n\nHello <MarginNote kind=\"field\">quiet note</MarginNote> world."), 4);
  assert.equal(wordCount('```js\none two three four\n```\nfive'), 3);
  assert.equal(wordCount('[a link](https://example.com/a/b) and https://example.com'), 3);
  assert.equal(wordCount("don't stop"), 2);
});

// ---------- ordering, drafts, authors ----------

test('posts sort newest first, then by title; drafts only when shown', () => {
  const posts = [post('b', '2026-01-01'), post('c', '2026-03-01'), post('a', '2026-01-01'), post('d', '2026-02-01', { draft: true })];
  assert.deepEqual(sortPosts(posts).map((p) => p.id), ['c', 'd', 'a', 'b']);
  assert.deepEqual(visiblePosts(posts, false).map((p) => p.id), ['b', 'c', 'a']);
  assert.equal(visiblePosts(posts, true).length, 4);
  const sorted = sortPosts(posts);
  assert.deepEqual(adjacentPosts(sorted, 'c'), { newer: undefined, older: sorted[1] });
  assert.deepEqual(adjacentPosts(sorted, 'b'), { newer: sorted[2], older: undefined });
});

test('authors: registry keys resolve, other names pass through', () => {
  assert.deepEqual(resolveAuthors(['pavel', 'A Guest'], { pavel: { name: 'Pavel Pascari', url: 'https://x' } }), [
    { name: 'Pavel Pascari', url: 'https://x' },
    { name: 'A Guest' },
  ]);
  assert.deepEqual(resolveAuthors(undefined), []);
});

test('dates are formatted in UTC', () => {
  assert.equal(formatDate(new Date('2026-11-20'), 'en'), 'November 20, 2026');
  assert.equal(formatDate(new Date('2026-11-20'), 'not a locale!'), '2026-11-20');
});

// ---------- tags and pages ----------

test('tags: counted, merged by slug, most used first', () => {
  const posts = [
    post('a', '2026-01-01', { tags: ['Astro', 'docs'] }),
    post('b', '2026-01-02', { tags: ['astro', 'astro'] }),
    post('c', '2026-01-03', { tags: ['zeta'] }),
  ];
  assert.deepEqual(collectTags(posts), [
    { tag: 'Astro', slug: 'astro', count: 2 },
    { tag: 'docs', slug: 'docs', count: 1 },
    { tag: 'zeta', slug: 'zeta', count: 1 },
  ]);
  assert.deepEqual(postsWithTag(posts, 'astro').map((p) => p.id), ['a', 'b']);
});

test('paginate: fixed-size pages, one empty page for no items', () => {
  assert.deepEqual(paginate([1, 2, 3, 4, 5], 2), [
    { items: [1, 2], current: 1, last: 3 },
    { items: [3, 4], current: 2, last: 3 },
    { items: [5], current: 3, last: 3 },
  ]);
  assert.deepEqual(paginate([], 10), [{ items: [], current: 1, last: 1 }]);
});

test('blogPages: list pages, posts, tag index and tag pages', () => {
  const posts = sortPosts([
    post('2026/one', '2026-01-01', { tags: ['Astro'] }),
    post('2026/two', '2026-02-01', { tags: ['astro', 'Web Components'] }),
    post('three', '2026-03-01'),
  ]);
  const pages = blogPages(posts, { postsPerPage: 2 });
  assert.deepEqual(
    pages.map((p) => p.params.path),
    [undefined, '2', 'three', '2026/two', '2026/one', 'tags', 'tags/astro', 'tags/web-components'],
  );
  const [first, second] = pages;
  assert.deepEqual(first.props.kind === 'list' && [first.props.current, first.props.last, first.props.total, first.props.posts.length], [1, 2, 3, 2]);
  assert.deepEqual(second.props.kind === 'list' && second.props.posts.map((p) => p.id), ['2026/one']);
  const two = pages.find((p) => p.params.path === '2026/two');
  assert.ok(two?.props.kind === 'post');
  assert.equal(two.props.newer?.id, 'three');
  assert.equal(two.props.older?.id, '2026/one');
  const astro = pages.find((p) => p.params.path === 'tags/astro');
  assert.ok(astro?.props.kind === 'tag');
  assert.equal(astro.props.tag.count, 2);
  assert.deepEqual(astro.props.posts.map((p) => p.id), ['2026/two', '2026/one']);
});

test('blogPages without posts: one empty list page, no tag pages', () => {
  const pages = blogPages([], { postsPerPage: 10 });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].params.path, undefined);
});

// ---------- feed ----------

test('rss items: absolute links, summary, categories, dc:creator, no drafts', () => {
  const items = rssItems(
    [
      post('2026/a', '2026-01-02', { tags: ['x'], authors: ['pavel', 'Guest <g>'] }),
      post('b', '2026-01-01', { draft: true }),
      post('c', '2026-01-01'),
    ],
    { route: 'blog', siteUrl: 'https://lib.dev/', authors: { pavel: { name: 'Pavel & Co' } } },
  );
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    title: '2026/a',
    link: 'https://lib.dev/blog/2026/a/',
    pubDate: new Date('2026-01-02'),
    description: 'About 2026/a',
    categories: ['x'],
    customData: '<dc:creator>Pavel &amp; Co</dc:creator><dc:creator>Guest &lt;g&gt;</dc:creator>',
  });
  assert.deepEqual(Object.keys(items[1]), ['title', 'link', 'pubDate', 'description']);
});
