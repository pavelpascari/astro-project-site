// Starlight route middleware for docs navigation:
// - every sidebar group whose folder has no index page gets an "Overview" link first, to the automatic overview
//   page (routes/section.astro), marked current there so the group is open; an index page listed under the
//   group's own name is labelled "Overview" too;
// - prev/next follow the sidebar including those links;
// - breadcrumbs for the page header (overrides/PageTitle.astro): the docs home, then each group above the page,
//   linked to the group's index or overview page when it has one.
import { defineRouteMiddleware, type StarlightRouteData } from '@astrojs/starlight/route-data';
import starlightConfig from 'virtual:starlight/user-config';
import site from 'virtual:astro-project-site/config';
import { isAutoOverview, isPage } from './lib/docs-tree';
import { translator } from './lib/labels';

type Entry = StarlightRouteData['sidebar'][number];
type Link = Extract<Entry, { type: 'link' }>;
type Group = Extract<Entry, { type: 'group' }>;

export interface Crumb {
  label: string;
  href?: string;
}

/** What the page chrome reads from `Astro.locals.projectSiteNav`. */
export interface NavData {
  breadcrumbs: Crumb[];
  /** The page is an entry of the docs collection, so it has a markdown twin at <page>.md (routes/markdown.ts). */
  hasMarkdown: boolean;
}

const base = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');
const segments = (href: string) =>
  decodeURI(href.startsWith(base + '/') ? href.slice(base.length) : href)
    .split(/[?#]/)[0]
    .split('/')
    .filter(Boolean);
const links = (entries: Entry[]): Link[] => entries.flatMap((e) => (e.type === 'link' ? [e] : links(e.entries)));
const local = (href: string) => href.startsWith('/') && !href.startsWith('//');

/** The folder a group stands for: the common path of its links (`docs/guides`), or undefined if they share none. */
function groupFolder(group: Group): string[] | undefined {
  const paths = links(group.entries).filter((l) => local(l.href)).map((l) => segments(l.href));
  if (!paths.length) return undefined;
  let common = paths[0];
  for (const p of paths.slice(1)) {
    let i = 0;
    while (i < common.length && i < p.length && common[i] === p[i]) i++;
    common = common.slice(0, i);
  }
  // A group of one page stands for that page's folder.
  if (paths.length === 1) common = common.slice(0, -1);
  return common.length ? common : undefined;
}

const hrefOf = (parts: string[]) => `${base}/${parts.join('/')}/`;

export const onRequest = defineRouteMiddleware(async (context) => {
  const route = context.locals.starlightRoute;
  const here = segments(context.url.pathname).join('/');
  const overview = translator(route.lang)('overview');
  let inserted = false;
  // Starlight shares one sidebar object between pages (it only moves `isCurrent`): change a copy.
  route.sidebar = structuredClone(route.sidebar);

  // Each group: its folder, and the link that opens it (index page or automatic overview).
  const groupHref = new Map<Group, string>();
  // "Overview" links and the name of their group, for prev/next (where "Next: Overview" would say nothing).
  const overviewOf = new Map<Link, string>();
  const visit = async (entries: Entry[]) => {
    for (const entry of entries) {
      if (entry.type !== 'group') continue;
      await visit(entry.entries);
      const folder = groupFolder(entry);
      if (!folder) continue;
      const id = folder.join('/');
      const index = links(entry.entries).find((l) => segments(l.href).join('/') === id);
      if (index) {
        groupHref.set(entry, index.href);
        // A folder's index page listed under its own name ("Reference" › "Reference") reads as "Overview",
        // like the automatic overview pages.
        if (index.label.trim().toLowerCase() === entry.label.trim().toLowerCase()) {
          index.label = overview;
          overviewOf.set(index, entry.label);
        }
      }
      else if (await isAutoOverview(id)) {
        const href = hrefOf(folder);
        const link: Link = { type: 'link', label: overview, href, isCurrent: here === id, badge: undefined, attrs: {} };
        entry.entries.unshift(link);
        overviewOf.set(link, entry.label);
        groupHref.set(entry, href);
        inserted = true;
      }
    }
  };
  await visit(route.sidebar);

  if (inserted && starlightConfig.pagination !== false) {
    const all = links(route.sidebar);
    const i = all.findIndex((l) => l.isCurrent);
    const data = route.entry.data as Record<string, any>;
    if (i !== -1) {
      const named = (l: Link | undefined) => (l && overviewOf.has(l) ? { ...l, label: overviewOf.get(l)! } : l);
      if (data.prev === undefined) route.pagination.prev = named(all[i - 1]);
      if (data.next === undefined) route.pagination.next = named(all[i + 1]);
    }
  }

  const id = route.entry.id;
  const hasMarkdown = await isPage(id);
  (context.locals as any).projectSiteNav = { breadcrumbs: breadcrumbs(route, here, groupHref), hasMarkdown } satisfies NavData;
});

function breadcrumbs(route: StarlightRouteData, here: string, groupHref: Map<Group, string>): Crumb[] {
  if (!route.hasSidebar) return [];
  // Groups above the current link.
  const trail: Group[] = [];
  const find = (entries: Entry[]): boolean => {
    for (const e of entries) {
      if (e.type === 'link' ? e.isCurrent : (trail.push(e), find(e.entries) || (trail.pop(), false))) return true;
    }
    return false;
  };
  find(route.sidebar);

  const crumbs: Crumb[] = trail
    .map((g) => ({ label: g.label, href: groupHref.get(g) }))
    // The overview/index page of a group is the group itself: no crumb pointing at the current page.
    .filter((c) => !(c.href && segments(c.href).join('/') === here));

  // The docs home (e.g. /docs/), labelled like the site nav item that points at it.
  const root = here.split('/')[0];
  if (root && here !== root) {
    const href = hrefOf([root]);
    const all = links(route.sidebar);
    const home = all.find((l) => segments(l.href).join('/') === root);
    if (home && !crumbs.some((c) => c.href === href)) {
      const nav = site.nav.find((n) => segments(n.href).join('/') === root);
      crumbs.unshift({ label: nav?.label ?? home.label, href });
    }
  }
  return crumbs;
}
