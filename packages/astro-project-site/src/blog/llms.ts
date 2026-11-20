// The blog's part of /llms.txt and /llms-full.txt: published posts, newest first (drafts never).
import site from 'virtual:astro-project-site/config';
import { absolutizeLinks } from '../docs/mount.mjs';
import { blogPosts } from './data';
import { postUrl } from './posts.mjs';

const siteUrl = site.url.replace(/\/+$/, '');

/** `## Blog` with one link per post, or '' when the blog is off or empty. */
export async function blogLlmsSection(): Promise<string> {
  if (!site.blog) return '';
  const blog = site.blog;
  const posts = await blogPosts({ drafts: false });
  if (!posts.length) return '';
  const lines = posts.map(
    (p) => `- [${p.data.title}](${siteUrl}${postUrl(blog.route, p.id)}): ${p.data.description} (${p.data.date.toISOString().slice(0, 10)})`,
  );
  return `## ${blog.title}\n\n${lines.join('\n')}\n`;
}

/** Every published post as markdown, for /llms-full.txt. */
export async function blogLlmsFull(): Promise<string> {
  if (!site.blog) return '';
  const blog = site.blog;
  const posts = await blogPosts({ drafts: false });
  return posts
    .map((p) => {
      const body = absolutizeLinks(p.body ?? '', siteUrl)
        .replace(/^import\s.+?from\s+['"][^'"]+['"];?\s*$/gm, '')
        .trim();
      const date = p.data.date.toISOString().slice(0, 10);
      return `---\n\n# ${p.data.title}\n\nURL: ${siteUrl}${postUrl(blog.route, p.id)}\nPublished: ${date}\n\n${body}\n`;
    })
    .join('\n');
}

/** Puts the blog section into an llms.txt index, before its `## Optional` section (which should stay last). */
export function withBlogSection(index: string, section: string): string {
  if (!section) return index;
  const at = index.indexOf('\n## Optional');
  return at === -1 ? `${index}\n${section}` : `${index.slice(0, at)}\n${section}${index.slice(at)}`;
}
