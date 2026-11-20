// Helpers for the shared navigation.

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

/** Host, display label and releases page for the repository link. */
export function repoInfo(repo: string): { host: string; label: string; releases: string } {
  let host = '';
  try {
    host = new URL(repo).hostname.replace(/^www\./, '');
  } catch {
    // not a URL: shown as a plain "Source code" link
  }
  const label = host === 'github.com' ? 'GitHub' : host === 'gitlab.com' ? 'GitLab' : host === 'codeberg.org' ? 'Codeberg' : 'Source code';
  return { host, label, releases: host === 'github.com' ? `${repo}/releases` : repo };
}
