// Injected at /llms.txt (option `llms`): https://llmstxt.org index of the docs (and the blog, when it is on).
import type { APIRoute } from 'astro';
import { llmsTxt, textResponse } from '../docs/llms';
import { blogLlmsSection, withBlogSection } from '../blog/llms';

export const GET: APIRoute = async () => textResponse(withBlogSection(await llmsTxt(), await blogLlmsSection()));
