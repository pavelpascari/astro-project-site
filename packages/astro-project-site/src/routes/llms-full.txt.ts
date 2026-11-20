// Injected at /llms-full.txt (option `llms`): every docs page as markdown, in one file, then every blog post.
import type { APIRoute } from 'astro';
import { llmsFullTxt, textResponse } from '../docs/llms';
import { blogLlmsFull } from '../blog/llms';

export const GET: APIRoute = async () => {
  const posts = await blogLlmsFull();
  return textResponse(posts ? `${await llmsFullTxt()}\n${posts}` : await llmsFullTxt());
};
