// The `blog` content collection: posts in src/content/blog/**/*.{md,mdx}, registered by projectSiteCollections().
// The collection always exists (so the blog can be switched on without touching content.config.ts); a project
// without the folder gets no warning about it.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SchemaContext } from 'astro:content';
import { AstroError } from 'astro/errors';
import { glob, type Loader, type LoaderContext } from 'astro/loaders';
import { z } from 'astro/zod';
import { postId } from './posts.mjs';

/** Frontmatter fields every post must have, with what to write. */
const REQUIRED = {
  title: 'title: My first post',
  description: 'description: One sentence for the post list, the feed and search results.',
  date: 'date: 2026-01-31',
} as const;

/** A schema error for a missing field that says what to add, instead of "expected string, received undefined". */
const required = (field: keyof typeof REQUIRED) => ({
  error: (issue: { input?: unknown }) =>
    issue.input === undefined ? `missing required frontmatter field "${field}". Add \`${REQUIRED[field]}\`` : undefined,
});

/** `2026-01-31` (a YAML date), `"2026-01-31"` or a timestamp. */
const date = (field: 'date' | 'updated') =>
  z.preprocess(
    (v) => (typeof v === 'string' || typeof v === 'number' ? new Date(v) : v),
    z.date(field === 'date' ? required('date') : { error: `"${field}" must be a date like 2026-01-31` }),
  );

/** Schema of a post's frontmatter. Pass `blogExtend` to projectSiteCollections() to add fields. */
export const blogSchema = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(required('title')).min(1),
    /** One or two sentences: the post list, the feed, meta description. */
    description: z.string(required('description')),
    date: date('date'),
    updated: date('updated').optional(),
    /** Keys of the `blog.authors` option, or plain names. */
    authors: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    /** Built only in dev (with a "Draft" badge); left out of production builds, the feed and llms.txt. */
    draft: z.boolean().default(false),
    /** Image next to the post file (`./cover.png`): shown on the post and in lists, and used as its social image. */
    image: image().optional(),
    /** Alt text for `image`. Empty (the default) marks it decorative. */
    imageAlt: z.string().optional(),
    /** Canonical URL, when the post was first published elsewhere. */
    canonical: z.url().optional(),
  });

export interface BlogLoaderOptions {
  /** Folder of posts, relative to the project root. Default `./src/content/blog`. */
  base?: string;
}

/** Astro's glob() loader for posts, with ids from postId(), file names in schema errors, and no warning for a missing folder. */
export function blogLoader({ base = './src/content/blog' }: BlogLoaderOptions = {}): Loader {
  const inner = glob({ pattern: '**/*.{md,mdx}', base, generateId: ({ entry }) => postId(entry) });
  return {
    name: 'astro-project-site-blog',
    async load(context) {
      const root = fileURLToPath(context.config.root);
      const folder = path.resolve(root, base);
      await inner.load({
        ...context,
        // glob() warns when the folder is missing; the blog is optional. (It still watches for the folder in dev.)
        logger: existsSync(folder) ? context.logger : quiet(context.logger, /does not exist/),
        parseData: async (props) => {
          try {
            return await context.parseData(props);
          } catch (error) {
            throw postDataError(error, props.filePath ? path.relative(root, props.filePath) : props.id);
          }
        },
      });
    },
  };
}

/** The schema error, reworded to lead with the file: "src/content/blog/x.md: frontmatter ... ". */
function postDataError(error: unknown, file: string) {
  const issues: { path: PropertyKey[]; message: string }[] = (error as any)?.cause?.issues ?? [];
  const message = (error as Error)?.message ?? String(error);
  // Astro's message is "**blog → id** data does not match collection schema." followed by one line per issue.
  const lines = message.split('\n').filter((l) => /^\s+\*\*/.test(l)).map((l) => l.trim().replace(/\*\*/g, ''));
  const details = lines.length ? lines : issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  return new AstroError(
    `Blog post ${file}: invalid frontmatter.\n${(details.length ? details : [message]).map((d) => `  - ${d}`).join('\n')}`,
    `Every post needs:\n---\n${Object.values(REQUIRED).join('\n')}\n---`,
  );
}

/** A logger that drops warnings matching `pattern`. */
function quiet(logger: LoaderContext['logger'], pattern: RegExp): LoaderContext['logger'] {
  return new Proxy(logger, {
    get(target, prop) {
      if (prop === 'warn') return (msg: string) => (pattern.test(msg) ? undefined : target.warn(msg));
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
