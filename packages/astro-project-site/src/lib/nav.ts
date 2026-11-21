// Helpers for the shared navigation.
import { repoHost } from '../repo-host.mjs';

/** Whether a nav link should be marked as the current section for `pathname`. */
export function isActive(href: string, pathname: string): boolean {
  if (/^[a-z]+:\/\//i.test(href)) return false;
  const clean = (p: string) => p.replace(/\/index\.html$/, '/').replace(/\/?$/, '/');
  const target = clean(href);
  const current = clean(pathname);
  return target === '/' ? current === '/' : current.startsWith(target);
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
