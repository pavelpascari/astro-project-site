// The one glob dialect of the package: mirrors (include/exclude), externalDocs `exclude` and docs-gen file lists.
// `*` and `?` within a segment, `**` across folders, `{a,b}` alternatives, `[abc]`/`[!abc]` classes. No dependencies.

/** The regular-expression source for a glob (no anchors). @returns {string} */
export function globToRegex(/** @type {string} */ glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/';
        re += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) re += '\\{';
      else {
        re += `(?:${glob.slice(i + 1, end).split(',').map(globToRegex).join('|')})`;
        i = end;
      }
    } else if (c === '[') {
      const end = glob.indexOf(']', i + 1);
      if (end === -1) re += '\\[';
      else {
        re += `[${glob.slice(i + 1, end).replace(/^!/, '^').replace(/\\/g, '\\\\')}]`;
        i = end;
      }
    } else re += c.replace(/[.+^$()|\\]/g, '\\$&');
  }
  return re;
}

/** A whole-path matcher for a glob (posix paths, relative; a leading `./` is ignored). */
export function globToRegExp(/** @type {string} */ glob) {
  return new RegExp(`^${globToRegex(glob.replace(/^\.\//, ''))}$`);
}
