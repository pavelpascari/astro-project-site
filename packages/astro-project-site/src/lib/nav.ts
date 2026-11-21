// Helpers for the shared navigation.
import { repoHost } from '../repo-host.mjs';

const clean = (p: string) => p.replace(/\/index\.html$/, '/').replace(/\/?$/, '/');

/** Whether `pathname` is in the section a nav link points at (the link's page or anything under it). */
export function isActive(href: string, pathname: string): boolean {
  if (/^[a-z]+:\/\//i.test(href)) return false;
  const target = clean(href);
  const current = clean(pathname);
  return target === '/' ? current === '/' : current.startsWith(target);
}

/**
 * The one nav link to mark as current: of the links whose section holds `pathname`, the most specific. With both
 * Docs (/docs/) and Guide (/docs/guide/) in the nav, a guide page marks Guide only, other docs pages Docs.
 */
export function activeHref(hrefs: string[], pathname: string): string | undefined {
  let best: string | undefined;
  for (const href of hrefs) {
    if (isActive(href, pathname) && (best === undefined || clean(href).length > clean(best).length)) best = href;
  }
  return best;
}

/** Whether a link points off-site. */
export function isExternal(href: string): boolean {
  return /^[a-z]+:\/\//i.test(href);
}

/**
 * Host, display label and releases page for the repository link. The label is the host's name (GitHub), else
 * `fallback` (the `sourceCode` label).
 */
export function repoInfo(repo: string, fallback = 'Source code'): { host: string; label: string; releases: string } {
  const { host, name } = repoHost(repo);
  return { host, label: name ?? fallback, releases: host === 'github.com' ? `${repo}/releases` : repo };
}
