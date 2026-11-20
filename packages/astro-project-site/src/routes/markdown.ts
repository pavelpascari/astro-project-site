// The markdown source of every docs page next to it: /docs/guides/configure/ → /docs/guides/configure.md.
// The page header's "Copy page" button reads it; it is also handy for pasting a page into an LLM.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getDocs, type DocsEntry } from '../lib/docs-tree';

export const getStaticPaths = (async () => {
  const entries = (await getDocs('docs')).filter((e) => e.id !== '404' && !e.id.endsWith('/404') && !(import.meta.env.PROD && e.data.draft));
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { entry } = props as { entry: DocsEntry };
  const body = (entry.body ?? '').trim();
  // Mounted pages had their first heading moved into the title; put it back. Local pages start after frontmatter.
  const text = /^#\s/.test(body) ? body : `# ${entry.data.title}\n\n${entry.data.description ? `> ${entry.data.description}\n\n` : ''}${body}`;
  return new Response(text + '\n', { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
