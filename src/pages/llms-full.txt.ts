// OWNER: docs agent. Every docs page as markdown, in one file.
import type { APIRoute } from 'astro';
import { llmsFullTxt, textResponse } from '../docs/llms';

export const GET: APIRoute = async () => textResponse(await llmsFullTxt());
