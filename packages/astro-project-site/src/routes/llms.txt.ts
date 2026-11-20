// Injected at /llms.txt (option `llms`): https://llmstxt.org index of the docs.
import type { APIRoute } from 'astro';
import { llmsTxt, textResponse } from '../docs/llms';

export const GET: APIRoute = async () => textResponse(await llmsTxt());
