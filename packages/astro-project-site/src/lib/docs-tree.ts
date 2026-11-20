// The docs collection seen as folders: which folders have pages, which of them lack an index page (those get an
// automatic overview page, routes/section.astro), and the children of a folder as cards (<ChildCards>).
//
// Ids are the collection's (`docs/guides/configure`); a folder is any proper prefix of an id (`docs/guides`).
import { getCollection } from 'astro:content';
import site from 'virtual:astro-project-site/config';

/** The fields of a `docs` entry used here (the collection itself is typed by the project's content config). */
export type DocsEntry = {
  id: string;
  body?: string;
  filePath?: string;
  data: { title: string; description?: string; draft?: boolean; sidebar?: { order?: number; label?: string; hidden?: boolean } };
};
export const getDocs = getCollection as unknown as (name: 'docs') => Promise<DocsEntry[]>;

export interface DocsCard {
  /** Collection id of the page, or of the folder for a folder without an index page. */
  id: string;
  href: string;
  title: string;
  description?: string;
  /** A folder (with or without its own index page) rather than a single page. */
  folder: boolean;
  /** Number of pages under a folder. */
  count?: number;
}

const base = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');
export const hrefFor = (id: string) => `${base}/${id}/`;

const parentOf = (id: string) => id.split('/').slice(0, -1).join('/');

function titleCase(name: string) {
  const s = name.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

let cached: Promise<Tree> | undefined;

interface Tree {
  pages: Map<string, DocsEntry>;
  /** Every folder that holds at least one page (at any depth), with the ids of all pages under it. */
  folders: Map<string, string[]>;
}

/** Pages that are listed: not the 404 page, not drafts in production, not hidden from the sidebar. */
function listed(entry: DocsEntry) {
  const data = entry.data;
  if (entry.id === '404' || entry.id.endsWith('/404')) return false;
  if (import.meta.env.PROD && data.draft) return false;
  return true;
}

function load(): Promise<Tree> {
  // In dev the collection changes under us: rebuild every time. At build time once is enough.
  if (cached && import.meta.env.PROD) return cached;
  cached = getDocs('docs').then((entries) => {
    const pages = new Map(entries.filter(listed).map((e) => [e.id, e]));
    const folders = new Map<string, string[]>();
    for (const id of pages.keys()) {
      const parts = id.split('/');
      for (let i = 1; i < parts.length; i++) {
        const folder = parts.slice(0, i).join('/');
        if (!folders.has(folder)) folders.set(folder, []);
        folders.get(folder)!.push(id);
      }
    }
    return { pages, folders };
  });
  return cached!;
}

/** Title for a folder: the `externalDocs` label for a mount root, else its index page's title, else its name. */
export function folderTitle(folder: string, tree?: Tree) {
  // A mount root is named by its configured label ("Reference"), not by its README's heading, which is usually the
  // project name and would make every mount card read the same.
  const mount = site.externalDocs?.find((m) => `docs/${m.route.replace(/^\/+|\/+$/g, '')}` === folder);
  if (mount) return mount.label;
  const page = tree?.pages.get(folder);
  if (page) return page.data.title;
  return titleCase(folder.split('/').at(-1) ?? folder);
}

/** Folders with pages under them but no page of their own: each gets an automatic overview page. */
export async function foldersWithoutIndex() {
  const tree = await load();
  return [...tree.folders.keys()]
    .filter((f) => !tree.pages.has(f) && tree.pages.size > 0)
    .map((id) => ({ id, href: hrefFor(id), title: folderTitle(id, tree) }));
}

/** True when `id` is a listed page of the docs collection. */
export async function isPage(id: string) {
  return (await load()).pages.has(id);
}

/** True when `id` is a folder that gets an automatic overview page. */
export async function isAutoOverview(id: string) {
  const tree = await load();
  return tree.folders.has(id) && !tree.pages.has(id);
}

/**
 * The direct children of a folder as cards: its pages, then its subfolders (each as one card, linking to the
 * subfolder's index or overview page). `order` (hrefs, e.g. the flattened sidebar) sorts them; otherwise
 * `sidebar.order`, then title.
 */
export async function childCards(folder: string, order: string[] = []): Promise<DocsCard[]> {
  const tree = await load();
  folder = folder.replace(/^\/+|\/+$/g, '');
  const cards: (DocsCard & { rank: number; sort: number })[] = [];
  const rankOf = (href: string) => {
    const i = order.indexOf(href);
    return i === -1 ? Infinity : i;
  };
  const sortOf = (entry: DocsEntry | undefined) => Number(entry?.data.sidebar?.order ?? Infinity);

  for (const [id, entry] of tree.pages) {
    if (parentOf(id) !== folder || tree.folders.has(id)) continue;
    const data = entry.data;
    if (data.sidebar?.hidden) continue;
    cards.push({
      id,
      href: hrefFor(id),
      title: data.sidebar?.label ?? data.title,
      description: data.description,
      folder: false,
      rank: rankOf(hrefFor(id)),
      sort: sortOf(entry),
    });
  }
  for (const [id, descendants] of tree.folders) {
    if (parentOf(id) !== folder) continue;
    const index = tree.pages.get(id);
    const inside = descendants.filter((d) => d !== id);
    const names = inside
      .filter((d) => parentOf(d) === id)
      .map((d) => tree.pages.get(d)!)
      .sort((a, b) => sortOf(a) - sortOf(b) || a.data.title.localeCompare(b.data.title))
      .map((e) => e.data.title);
    cards.push({
      id,
      href: hrefFor(id),
      title: folderTitle(id, tree),
      description: index?.data.description ?? (names.length ? summarise(names) : undefined),
      folder: true,
      count: inside.length,
      rank: Math.min(rankOf(hrefFor(id)), ...inside.map((d) => rankOf(hrefFor(d)))),
      sort: sortOf(index),
    });
  }
  return cards
    .sort((a, b) => a.rank - b.rank || a.sort - b.sort || a.title.localeCompare(b.title))
    .map(({ rank: _r, sort: _s, ...card }) => card);
}

function summarise(names: string[]) {
  const shown = names.slice(0, 4);
  return shown.join(', ') + (names.length > shown.length ? ', …' : '.');
}
