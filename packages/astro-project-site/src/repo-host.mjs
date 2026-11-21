// The repository's host by name, for links and icons. One list, used by the header, the footer and Starlight's
// social links.

const KNOWN = /** @type {const} */ ({
  'github.com': { name: 'GitHub', icon: 'github' },
  'gitlab.com': { name: 'GitLab', icon: 'gitlab' },
  'codeberg.org': { name: 'Codeberg', icon: 'codeberg' },
});

/**
 * Host of `repo`, its name (`GitHub`) and Starlight icon, or `undefined` name and the `external` icon for any other
 * host (or a value that is not a URL).
 * @param {string} repo
 * @returns {{ host: string, name: string | undefined, icon: string }}
 */
export function repoHost(repo) {
  let host = '';
  try {
    host = new URL(repo).hostname.replace(/^www\./, '');
  } catch {
    // not a URL
  }
  const known = /** @type {Record<string, { name: string, icon: string }>} */ (KNOWN)[host];
  return { host, name: known?.name, icon: known?.icon ?? 'external' };
}
