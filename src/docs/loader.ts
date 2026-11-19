// OWNER: docs agent.
// The `docs` collection loader: Starlight's own loader for src/content/docs, plus one Astro glob() loader per
// `site.externalDocs` folder. External files are plain markdown; on the way in each one gets:
//   - a title from its first `# H1` when there is no frontmatter title (that H1 is removed so it is not shown twice)
//   - a description from its first paragraph, if none is set
//   - links rewritten for the site (see rewriteLinks in mount.mjs)
//   - an editUrl pointing at the file in the repo
// In dev the glob loaders watch the folders, so editing an external file reloads the page.
import { fileURLToPath } from 'node:url';
import { glob, type Loader, type LoaderContext } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import site from '../../site.config';
import {
  describe,
  editUrlFor,
  findTitle,
  idForFile,
  mountGlobPatterns,
  resolveProject,
  rewriteLinks,
  scanLines,
  titleCase,
} from './mount.mjs';

type Mount = ReturnType<typeof resolveProject>['mounts'][number];
type EntryInfo = { body: string; data: Record<string, unknown>; [k: string]: unknown };
type EntryType = { getEntryInfo: (p: { contents: string; fileUrl: URL }) => Promise<EntryInfo>; [k: string]: unknown };
type FullContext = LoaderContext & { entryTypes: Map<string, EntryType> };

export function projectDocsLoader(): Loader {
  return {
    name: 'project-site-docs',
    async load(context) {
      const ctx = context as FullContext;
      const project = resolveProject(site, fileURLToPath(ctx.config.root));
      const owner = (filePath: string | undefined) =>
        filePath ? project.mounts.find((m) => filePath.startsWith(m.relDir + '/')) : undefined;

      // Each sub-loader prunes entries it did not see, so each must only see its own entries in store.keys().
      await docsLoader().load({ ...ctx, store: scoped(ctx.store, (fp) => !owner(fp)) });

      for (const mount of project.mounts) {
        await glob({
          base: mount.dir,
          pattern: mountGlobPatterns(mount),
          generateId: ({ entry }) => idForFile(mount, entry.split('\\').join('/')),
        }).load({
          ...ctx,
          store: scoped(ctx.store, (fp) => owner(fp) === mount),
          entryTypes: withExternalMarkdown(ctx.entryTypes, mount, project),
        } as FullContext);
      }
    },
  };
}

/** The store, with keys() limited to entries whose filePath passes `mine`. */
function scoped(store: LoaderContext['store'], mine: (filePath: string | undefined) => boolean) {
  return new Proxy(store, {
    get(target, prop) {
      if (prop === 'keys') return () => target.keys().filter((id) => mine(target.get(id)?.filePath));
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** Wraps the `.md` entry type so external markdown gets a title, description, rewritten links and an edit URL. */
function withExternalMarkdown(
  entryTypes: Map<string, EntryType>,
  mount: Mount,
  project: ReturnType<typeof resolveProject>,
): Map<string, EntryType> {
  const md = entryTypes.get('.md');
  if (!md) return entryTypes;
  const wrapped: EntryType = {
    ...md,
    async getEntryInfo(params) {
      const info = await md.getEntryInfo(params);
      const abs = fileURLToPath(params.fileUrl);
      const rel = abs.slice(mount.dir.length + 1).split('\\').join('/');
      const data = { ...info.data };
      let body = info.body;

      const h1 = findTitle(body);
      if (h1 && (data.title === undefined || h1.leading)) {
        const lines = scanLines(body).map((l) => l.text);
        lines.splice(h1.line, 1);
        body = lines.join('\n').trim();
      }
      data.title ??= h1?.title ?? titleCase(rel.replace(/\.md$/i, '').split('/').at(-1) ?? rel);
      data.description ??= describe(body);
      if (data.editUrl === undefined) data.editUrl = editUrlFor(project, abs) ?? false;
      // The links validator keys pages by frontmatter slug when a file lives outside src/content/docs.
      data.slug = idForFile(mount, rel);

      return { ...info, data, body: rewriteLinks(project, abs, body) };
    },
  };
  return new Map([...entryTypes, ['.md', wrapped]]);
}
