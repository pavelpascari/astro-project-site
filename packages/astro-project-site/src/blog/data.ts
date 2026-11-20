// Reading the `blog` collection (defined by projectSiteCollections()) for the blog pages, the landing page's
// "Latest posts", the feed and llms.txt.
import { getCollection } from 'astro:content';
import site from 'virtual:astro-project-site/config';
import type { BlogAuthor, BlogEntry, BlogPostInfo, ResolvedBlog } from '../index';
import { postUrl, readingTime, resolveAuthors, sortPosts, visiblePosts } from './posts.mjs';

/** Drafts are built in dev only, where they carry a badge. */
export const showDrafts = import.meta.env.DEV;

/** The resolved `blog` option. Throws when the blog is off (the blog pages are not injected then). */
export function blogOptions(): ResolvedBlog {
  if (!site.blog) throw new Error('The blog is off: set `blog: true` (or `blog: { ... }`) in projectSite() options.');
  return site.blog;
}

/**
 * Posts, newest first. Drafts are included in dev only (pass `drafts: false` to always leave them out, as the feed
 * does). Empty when the blog is off.
 */
export async function blogPosts({ drafts = showDrafts }: { drafts?: boolean } = {}): Promise<BlogEntry[]> {
  if (!site.blog) return [];
  // The collection belongs to the project's content config, so its name is not in this package's types.
  const all = await (getCollection as (name: string) => Promise<BlogEntry[]>)('blog');
  return sortPosts(visiblePosts(all, drafts)) as BlogEntry[];
}

/** URL, reading time and authors of a post. */
export function postInfo(post: BlogEntry): BlogPostInfo {
  const blog = blogOptions();
  return {
    post,
    href: postUrl(blog.route, post.id),
    readingTime: readingTime(post.body),
    authors: resolveAuthors(post.data.authors, blog.authors) as BlogAuthor[],
  };
}
