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
