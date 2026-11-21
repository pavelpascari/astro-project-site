// Builds /llms.txt and /llms-full.txt (https://llmstxt.org) from the `docs` collection.
// Pages are grouped and ordered like the sidebar: local docs, then one section per `externalDocs` entry.
import { getCollection } from 'astro:content';
import site from 'virtual:astro-project-site/config';
import { absolutizeLinks } from './mount.mjs';

/** The fields of a `docs` entry used here (the collection itself is typed by the project's content config). */
type Entry = {
  id: string;
  body?: string;
  filePath?: string;
  data: { title: string; description?: string; draft: boolean; sidebar: { order?: number } };
};
const getDocs = getCollection as unknown as (name: 'docs', filter: (e: Entry) => boolean) => Promise<Entry[]>;
type Section = { label: string; entries: Entry[] };

const siteUrl = site.url.replace(/\/+$/, '');
const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

export const pageUrl = (entry: Entry) => `${siteUrl}/${entry.id === 'index' ? '' : entry.id + '/'}`;

/** Docs pages (not drafts) in sidebar order, grouped like the sidebar. */
export async function docsSections(): Promise<Section[]> {
  const all = (await getDocs('docs', (e) => !e.data.draft && e.id !== '404')).filter(
    (e) => e.id === 'docs' || e.id.startsWith('docs/'),
  );
  // Every `dir` is set by now: a `git` entry's is its downloaded folder (docs/git-source.mjs).
  const mounts = (site.externalDocs ?? []).map((m) => ({ ...m, relDir: norm(m.dir) }));
  // Deepest folder first, so `../docs/x.md` belongs to a `../docs` mount rather than a `..` one.
  const byDepth = [...mounts].sort((a, b) => b.relDir.length - a.relDir.length);
  const mountOf = (e: Entry) => byDepth.find((m) => e.filePath?.startsWith(m.relDir + '/'));

  const local = all.filter((e) => !mountOf(e));
  const topLevel = local.filter((e) => e.id.split('/').length <= 2);
  const nested = local.filter((e) => e.id.split('/').length > 2);
  const byOrder = (a: Entry, b: Entry) =>
    (a.id === 'docs' ? -Infinity : (a.data.sidebar.order ?? Infinity)) -
      (b.id === 'docs' ? -Infinity : (b.data.sidebar.order ?? Infinity)) || a.id.localeCompare(b.id);

  const sections: Section[] = [{ label: 'Docs', entries: topLevel.sort(byOrder) }];
  for (const m of mounts) {
    // Folder first (top level before subfolders), then README/index, then the `order` hint, then id.
    const key = (e: Entry): [string, number] => {
      const rel = (e.filePath ?? '').slice(m.relDir.length + 1).replace(/\.md$/i, '').toLowerCase();
      const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
      if (/(^|\/)(readme|index)$/.test(rel)) return [dir, -1];
      const i = (m.order ?? []).findIndex((o) => o.replace(/\.md$/i, '').toLowerCase() === rel);
      return [dir, i === -1 ? Infinity : i];
    };
    const entries = all.filter((e) => mountOf(e) === m).sort((a, b) => {
      const [da, ra] = key(a);
      const [db, rb] = key(b);
      return da.localeCompare(db) || ra - rb || a.id.localeCompare(b.id);
    });
    sections.push({ label: m.label, entries });
  }
  const groups = new Map<string, Entry[]>();
  for (const e of nested.sort(byOrder)) {
    const dir = e.id.split('/')[1];
    groups.set(dir, [...(groups.get(dir) ?? []), e]);
  }
  for (const [dir, entries] of groups) sections.push({ label: dir.charAt(0).toUpperCase() + dir.slice(1), entries });
  return sections.filter((s) => s.entries.length);
}

const header = () => `# ${site.name}\n\n> ${site.tagline}\n`;

export async function llmsTxt(): Promise<string> {
  const parts = [header(), `Documentation for ${site.name}. Source: ${site.repo}\n`];
  for (const section of await docsSections()) {
    parts.push(`## ${section.label}\n`);
    parts.push(
      section.entries
        .map((e) => `- [${e.data.title}](${pageUrl(e)})${e.data.description ? `: ${e.data.description}` : ''}`)
        .join('\n') + '\n',
    );
  }
  parts.push(`## Optional\n\n- [Full documentation as one file](${siteUrl}/llms-full.txt): every page above, as markdown\n`);
  return parts.join('\n');
}

export async function llmsFullTxt(): Promise<string> {
  const parts = [header()];
  for (const section of await docsSections()) {
    for (const e of section.entries) {
      const body = stripMdxImports(absolutizeLinks(e.body ?? '', siteUrl)).trim();
      parts.push(`---\n\n# ${e.data.title}\n\nURL: ${pageUrl(e)}\n\n${body}\n`);
    }
  }
  return parts.join('\n');
}

/** MDX `import ... from '...'` lines mean nothing outside the site. */
const stripMdxImports = (md: string) => md.replace(/^import\s.+?from\s+['"][^'"]+['"];?\s*$/gm, '');

export const textResponse = (body: string) =>
  new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
