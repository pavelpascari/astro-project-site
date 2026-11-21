// Plain-JS helpers shared by the integration (starlight.mjs, runs in the Astro config), the content loader
// (docs/loader.ts) and the llms.txt endpoints. No Astro imports here, only node: modules.
//
// Vocabulary: a "mount" is one `externalDocs` entry resolved against the project root: a markdown folder outside
// src/content that is served under /docs/<route>/.
import fs from 'node:fs';
import path from 'node:path';
import { globToRegExp } from '../glob.mjs';

export { globToRegExp };

const posix = path.posix;
const MD_EXT = /\.md$/i;
const LOCAL_EXT = /\.(md|mdx|markdown|mdoc)$/i;

/**
 * @typedef {{ dir: string, route: string, label: string, description?: string, order?: string[], exclude?: string[], include?: string[] }} ExternalDocsEntry
 * @typedef {{ name: string, tagline: string, url: string, repo: string, repoBranch?: string,
 *   externalDocs?: ExternalDocsEntry[] }} SiteLike
 * @typedef {{ dir: string, relDir: string, route: string, routeId: string, label: string, description?: string,
 *   order: string[],
 *   exclude: string[], include: string[], skip: string[] }} Mount
 * @typedef {{ root: string, gitRoot: string | undefined, repo: string, branch: string, url: string,
 *   localDir: string, mounts: Mount[] }} Project
 */

/** Resolves the options into absolute paths and repo facts. `root` is the project root (the folder of astro.config). */
export function resolveProject(/** @type {SiteLike} */ site, /** @type {string} */ root) {
  root = path.resolve(root);
  const mounts = (site.externalDocs ?? []).map((entry) => {
    const dir = path.resolve(root, entry.dir);
    const route = entry.route.split('/').filter(Boolean).map(slugify).join('/');
    if (!route) throw new Error(`externalDocs: route for "${entry.dir}" is empty.`);
    return {
      dir,
      relDir: toPosix(path.relative(root, dir)),
      route,
      routeId: `docs/${route}`,
      label: entry.label,
      description: entry.description,
      order: entry.order ?? [],
      exclude: entry.exclude ?? [],
      include: entry.include ?? [],
      // The site's own folder (and with it dist/ and node_modules/) when the mount contains it, e.g. `dir: '..'`.
      skip: isInside(root, dir) ? [root] : [],
    };
  });
  return /** @type {Project} */ ({
    root,
    // Not in a git checkout yet (e.g. right after `project-site init`): assume the project root becomes the repo root.
    gitRoot: findGitRoot(root) ?? root,
    repo: site.repo.replace(/\/+$/, ''),
    branch: site.repoBranch ?? 'main',
    url: site.url.replace(/\/+$/, ''),
    localDir: path.join(root, 'src/content/docs'),
    mounts,
  });
}

// ---------- ids and routes ----------

/** Same idea as github-slugger: lowercase, spaces to dashes, drop punctuation other than - and _. */
export function slugify(/** @type {string} */ text) {
  return text.trim().toLowerCase().replace(/\s/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');
}

/** Collection id for a markdown file inside a mount (`rel` is posix, relative to the mount dir). README/index → the folder's id. */
export function idForFile(/** @type {Mount} */ mount, /** @type {string} */ rel) {
  const parts = rel.replace(MD_EXT, '').split('/');
  const last = parts.at(-1)?.toLowerCase();
  if (last === 'readme' || last === 'index') parts.pop();
  return [mount.routeId, ...parts.map(slugify)].filter(Boolean).join('/');
}

export const hrefForId = (/** @type {string} */ id) => `/${id}/`;

/** Mounts whose folder holds the absolute path `abs`, deepest first (`../docs` before `..`). */
export function mountsFor(/** @type {Project} */ project, /** @type {string} */ abs) {
  return project.mounts
    .filter((m) => (abs === m.dir || abs.startsWith(m.dir + path.sep)) && !m.skip.some((s) => abs === s || abs.startsWith(s + path.sep)))
    .sort((a, b) => b.dir.length - a.dir.length);
}

/** The mount an absolute path belongs to, if any: the deepest one whose include/exclude globs accept it. */
export function mountFor(/** @type {Project} */ project, /** @type {string} */ abs) {
  const candidates = mountsFor(project, abs);
  return candidates.find((m) => accepts(m, toPosix(path.relative(m.dir, abs)))) ?? candidates[0];
}

/**
 * Whether a path (posix, relative to the mount dir) passes the mount's `include` and `exclude` globs.
 * A glob that matches a folder covers everything inside it (`include: ['guides']` = `guides/**`).
 */
export function accepts(/** @type {Mount} */ mount, /** @type {string} */ rel) {
  if (!rel || rel.startsWith('..')) return false;
  if (mount.exclude.map(globToRegExp).some((re) => re.test(rel))) return false;
  if (!mount.include.length) return true;
  const included = mount.include.map(globToRegExp);
  const parts = rel.split('/');
  for (let i = parts.length; i > 0; i--) {
    const sub = parts.slice(0, i).join('/');
    if (included.some((re) => re.test(sub))) return true;
  }
  return false;
}

/** Whether a file inside folder `relDir` (posix, relative to the mount dir) could still pass `include`. */
function couldInclude(/** @type {Mount} */ mount, /** @type {string} */ relDir) {
  if (!mount.include.length) return true;
  const parts = relDir.split('/');
  return mount.include.some((glob) => {
    const segs = glob.replace(/^\.\//, '').replace(/\/+$/, '').split('/');
    for (let i = 0; i < parts.length; i++) {
      if (i >= segs.length) return true; // the glob matched an ancestor folder: everything below is included
      if (segs[i].includes('**')) return true;
      if (!globToRegExp(segs[i]).test(parts[i])) return false;
    }
    return true;
  });
}

/** Path of a file relative to the git root, posix, or undefined when it is outside the repo. */
export function repoPath(/** @type {Project} */ project, /** @type {string} */ abs) {
  if (!project.gitRoot) return undefined;
  const rel = path.relative(project.gitRoot, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
  return toPosix(rel);
}

/** "Edit this page" base for files under the site root: <repo>/edit/<branch>/<site folder in repo>/ */
export function editBaseUrl(/** @type {Project} */ project) {
  const rel = repoPath(project, project.root);
  if (rel === undefined) return undefined;
  return `${project.repo}/edit/${project.branch}/${rel ? rel + '/' : ''}`;
}

export function editUrlFor(/** @type {Project} */ project, /** @type {string} */ abs) {
  const rel = repoPath(project, abs);
  return rel === undefined ? undefined : `${project.repo}/edit/${project.branch}/${encodePath(rel)}`;
}

function findGitRoot(/** @type {string} */ from) {
  for (let dir = from; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    if (path.dirname(dir) === dir) return undefined;
  }
}

// ---------- listing ----------

/**
 * Markdown files of a mount, posix paths relative to its dir, passing its `include`/`exclude` globs. Hidden
 * folders, node_modules and the site's own folder are always skipped.
 */
export function listMountFiles(/** @type {Mount} */ mount) {
  return walk(mount, mount.dir).filter((rel) => MD_EXT.test(rel) && accepts(mount, rel));
}

/** Glob patterns for Astro's glob() loader matching exactly what listMountFiles returns. */
export function mountGlobPatterns(/** @type {Mount} */ mount) {
  // With `include`, the exact file list: the include dialect (a folder covers its contents, a name is matched
  // against the whole path) differs from tinyglobby's, and an `include` mount is usually a few named files.
  if (mount.include.length) return listMountFiles(mount).map(escapeGlob);
  const skipped = mount.skip.map((s) => `!${toPosix(path.relative(mount.dir, s))}/**`);
  return ['**/*.md', '!**/node_modules/**', ...skipped, ...mount.exclude.map((p) => `!${p}`)];
}

const escapeGlob = (/** @type {string} */ p) => p.replace(/[*?[\]{}()!+@\\]/g, '\\$&');

function walk(/** @type {Mount} */ mount, /** @type {string} */ dir, prefix = '') {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (mount.skip.includes(abs) || !couldInclude(mount, rel)) continue;
      out.push(...walk(mount, abs, rel));
    } else out.push(rel);
  }
  return out;
}


// ---------- sidebar ----------

/**
 * Starlight sidebar: local top-level pages (index first, then `sidebar.order`, then name), then the sections: one
 * group per mount, then one autogenerated group per local subfolder (e.g. docs/template/). `order` (the `docsOrder`
 * option: mount routes and local folder names) moves the sections it lists to the front, in its order; an unknown
 * name throws.
 * Built from the file system at startup: adding or removing a page needs a dev-server restart to show up here.
 */
export function buildSidebar(/** @type {Project} */ project, overview = 'Overview', /** @type {string[]} */ order = []) {
  const localDocs = path.join(project.localDir, 'docs');
  const mountTops = new Set(project.mounts.map((m) => m.route.split('/')[0]));
  /** @type {{ id: string, order: number }[]} */
  const pages = [];
  /** @type {{ key: string, group: any }[]} */
  const subGroups = [];
  if (fs.existsSync(localDocs)) {
    for (const ent of fs.readdirSync(localDocs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ent.name.startsWith('_') || ent.name.startsWith('.')) continue;
      if (ent.isDirectory()) {
        if (mountTops.has(slugify(ent.name))) continue;
        subGroups.push({
          key: slugify(ent.name),
          group: {
            label: titleCase(ent.name),
            collapsed: true,
            items: [{ autogenerate: { directory: `docs/${slugify(ent.name)}` } }],
          },
        });
      } else if (LOCAL_EXT.test(ent.name)) {
        const base = slugify(ent.name.replace(LOCAL_EXT, ''));
        const id = base === 'index' ? 'docs' : `docs/${base}`;
        const fm = readFrontmatter(path.join(localDocs, ent.name));
        if (/^\s*hidden:\s*true/m.test(fm.sidebar ?? '')) continue;
        const order = id === 'docs' ? -Infinity : Number(/^\s*order:\s*(-?[\d.]+)/m.exec(fm.sidebar ?? '')?.[1] ?? Infinity);
        pages.push({ id, order });
      }
    }
  }
  pages.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const sections = [
    ...project.mounts.map((m) => ({
      key: slugify(m.route.split('/')[0]),
      group: { label: m.label, items: mountItems(m, '', listMountFiles(m), overview) },
    })),
    ...subGroups,
  ];
  const known = sections.map((s) => s.key);
  const unknown = order.filter((name) => !known.includes(slugify(name)));
  if (unknown.length) {
    throw new Error(
      `docsOrder: ${unknown.map((n) => JSON.stringify(n)).join(', ')} ${unknown.length > 1 ? 'are not docs sections' : 'is not a docs section'}. ` +
        `The sections are: ${known.join(', ') || '(none)'}.`,
    );
  }
  const rank = (/** @type {string} */ key) => {
    const i = order.findIndex((name) => slugify(name) === key);
    return i === -1 ? Infinity : i;
  };
  // Array.prototype.sort is stable: unlisted sections keep their default order (Infinity - Infinity is NaN → 0).
  sections.sort((a, b) => rank(a.key) - rank(b.key) || 0);
  return [...pages.map((p) => ({ slug: p.id })), ...sections.map((s) => s.group)];
}

/** Sidebar items for one folder of a mount (recursive). Folder index first, then `order`, then file names. */
function mountItems(/** @type {Mount} */ mount, /** @type {string} */ folder, /** @type {string[]} */ files, overview = 'Overview') {
  const prefix = folder ? folder + '/' : '';
  const here = files.filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes('/'));
  const subdirs = [...new Set(files.filter((f) => f.startsWith(prefix) && f.slice(prefix.length).includes('/'))
    .map((f) => prefix + f.slice(prefix.length).split('/')[0]))].sort();
  const rank = (/** @type {string} */ rel) => {
    const name = rel.slice(prefix.length).replace(MD_EXT, '').toLowerCase();
    if (name === 'readme' || name === 'index') return -1;
    const i = mount.order.findIndex((o) => o.replace(MD_EXT, '').toLowerCase() === rel.replace(MD_EXT, '').toLowerCase());
    return i === -1 ? Infinity : i;
  };
  /** @type {any[]} */
  const items = here
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((rel) => (rank(rel) === -1 ? { slug: idForFile(mount, rel), label: overview } : { slug: idForFile(mount, rel) }));
  for (const dir of subdirs) {
    const readme = files.find((f) => f.toLowerCase() === `${dir}/readme.md`.toLowerCase());
    items.push({
      label: (readme && readTitle(path.join(mount.dir, readme))) || titleCase(posix.basename(dir)),
      collapsed: true,
      items: mountItems(mount, dir, files, overview),
    });
  }
  return items;
}

// ---------- markdown text helpers ----------

/** Splits markdown into lines, flagging those inside fenced code blocks. */
export function scanLines(/** @type {string} */ md) {
  /** @type {{ text: string, code: boolean }[]} */
  const out = [];
  /** @type {string | null} */
  let fence = null;
  for (const text of md.split('\n')) {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(text);
    if (fence) {
      out.push({ text, code: true });
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !text.trim().slice(m[1].length).trim()) fence = null;
    } else if (m) {
      fence = m[1];
      out.push({ text, code: true });
    } else out.push({ text, code: false });
  }
  return out;
}

const H1 = /^ {0,3}#\s+(.+?)(?:\s+#+)?\s*$/;

/** Markdown inline syntax to plain text (good enough for titles and descriptions). */
export function plain(/** @type {string} */ md) {
  /** @type {string[]} */
  const code = [];
  return md
    .replace(/(`+)\s?([^`]*?)\s?\1/g, (_m, _t, inner) => `\u0000${code.push(inner) - 1}\u0000`)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\*\*|\*|(?<!\w)_|_(?!\w)/g, '')
    .replace(/\u0000(\d+)\u0000/g, (_m, i) => code[Number(i)])
    .replace(/\s+/g, ' ')
    .trim();
}

/** First `# H1` outside code: its plain text and line index. */
export function findTitle(/** @type {string} */ body) {
  const lines = scanLines(body);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].code) continue;
    const m = H1.exec(lines[i].text);
    if (m) return { title: plain(m[1]), line: i, leading: lines.slice(0, i).every((l) => !l.text.trim()) };
  }
  return undefined;
}

export function readTitle(/** @type {string} */ file) {
  try {
    return findTitle(fs.readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, ''))?.title;
  } catch {
    return undefined;
  }
}

/** First prose paragraph (not a heading, list, table, quote, html or code), as one plain sentence-ish line. */
export function describe(/** @type {string} */ body) {
  const lines = scanLines(body);
  /** @type {string[]} */
  let para = [];
  for (const { text, code } of lines) {
    const t = text.trim();
    if (!code && /^#{1,6}\s/.test(t) && !para.length) break; // only the intro, before the first heading
    if (code || !t || /^(#|[-*+] |\d+[.)] |\||>|<|import |export )/.test(t)) {
      if (para.length) break;
      continue;
    }
    para.push(t);
  }
  const text = plain(para.join(' '));
  if (!text) return undefined;
  const sentence = /^(.{40,}?[.!?])(\s|$)/.exec(text)?.[1] ?? text;
  return sentence.length > 200 ? sentence.slice(0, 197).replace(/\s+\S*$/, '') + '…' : sentence;
}

/** Simple frontmatter peek for sidebar ordering: returns the raw `sidebar:` block text. */
function readFrontmatter(/** @type {string} */ file) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(file, 'utf8'))?.[1] ?? '';
  const sidebar = /^sidebar:\s*\n((?:[ \t]+.*\n?)*)/m.exec(fm)?.[1];
  return { sidebar };
}

// ---------- link rewriting ----------

/**
 * Rewrites relative links in a mounted markdown file (`abs` is its absolute path) so they work on the site:
 *   - `foo.md`, `../other/foo.md#x`, `sub/` (with a README) inside any mount → /docs/<route>/... (an anchor pointing at
 *     the target's H1 is dropped, since that heading becomes the page title)
 *   - anything else relative (source files, folders, docs outside every mount) → the file on GitHub (<repo>/blob|tree/<branch>/...)
 * Absolute URLs, root-relative paths, pure #anchors, images and code are left alone.
 */
export function rewriteLinks(/** @type {Project} */ project, /** @type {string} */ abs, /** @type {string} */ body) {
  const fix = (/** @type {string} */ href) => resolveHref(project, abs, href) ?? href;
  return scanLines(body)
    .map(({ text, code }) => {
      if (code) return text;
      // Reference definitions: [id]: href "title"
      const def = /^(\s{0,3}\[[^\]]+\]:\s*)(<[^>]*>|\S+)(.*)$/.exec(text);
      if (def) return def[1] + wrapLike(def[2], fix(unwrap(def[2]))) + def[3];
      // Inline code spans are masked so links inside them stay as written, while links whose label is code still work.
      /** @type {string[]} */
      const spans = [];
      const masked = text.replace(/(`+)[^`]*?\1/g, (m) => `\u0000${spans.push(m) - 1}\u0000`);
      return rewriteInline(masked, fix).replace(/\u0000(\d+)\u0000/g, (_m, i) => spans[Number(i)]);
    })
    .join('\n');
}

function rewriteInline(/** @type {string} */ text, /** @type {(h: string) => string} */ fix) {
  return text
    .replace(/(!?)\[((?:[^\[\]]|\[[^\]]*\])*)\]\(\s*(<[^>]*>|[^\s)]+)((?:\s+(?:"[^"]*"|'[^']*'))?\s*)\)/g,
      (all, bang, label, href, rest) => (bang ? all : `[${label}](${wrapLike(href, fix(unwrap(href)))}${rest})`))
    .replace(/(<a\s[^>]*?href=)(["'])(.*?)\2/gi, (_all, pre, q, href) => `${pre}${q}${fix(href)}${q}`);
}

const unwrap = (/** @type {string} */ h) => (h.startsWith('<') && h.endsWith('>') ? h.slice(1, -1) : h);
const wrapLike = (/** @type {string} */ orig, /** @type {string} */ h) => (orig.startsWith('<') ? `<${h}>` : h);

/** @type {Map<string, string | undefined>} */
const titleSlugCache = new Map();

/** The new href for `href` written in file `abs`, or undefined to keep it. */
export function resolveHref(/** @type {Project} */ project, /** @type {string} */ abs, /** @type {string} */ href) {
  if (!href || /^([a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(href)) return undefined;
  const [, rawPath, hash = ''] = /^([^#?]*)(?:\?[^#]*)?(#.*)?$/.exec(href) ?? [];
  if (!rawPath) return undefined;
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { decoded = rawPath; }
  const target = path.resolve(path.dirname(abs), decoded);
  // Deepest mount first; a mount whose globs leave the file out (e.g. `include: ['README.md']` at the repo root)
  // passes it on to the next one, and finally to the repo link below.
  for (const mount of mountsFor(project, target)) {
    let rel = toPosix(path.relative(mount.dir, target));
    let file = target;
    if (!MD_EXT.test(rel)) {
      const readme = ['README.md', 'readme.md', 'index.md'].map((n) => path.join(target, n)).find((p) => fs.existsSync(p));
      if (readme) { file = readme; rel = toPosix(path.relative(mount.dir, readme)); }
    }
    if (!MD_EXT.test(rel) || !accepts(mount, rel)) continue;
    if (fs.existsSync(file)) return hrefForId(idForFile(mount, rel)) + (hash && hash.slice(1) === titleSlug(file) ? '' : hash);
    return hrefForId(idForFile(mount, rel)) + hash; // missing file: let the link validator flag it
  }
  const inRepo = repoPath(project, target);
  if (inRepo === undefined) return undefined;
  const kind = fs.existsSync(target) && fs.statSync(target).isDirectory() ? 'tree' : 'blob';
  return `${project.repo}/${kind}/${project.branch}/${encodePath(inRepo)}${hash}`;
}

function titleSlug(/** @type {string} */ file) {
  if (!titleSlugCache.has(file)) {
    const t = readTitle(file);
    titleSlugCache.set(file, t ? slugify(t) : undefined);
  }
  return titleSlugCache.get(file);
}

/** Root-relative links (`](/docs/...)`, `href="/..."`) to absolute site URLs, for text read outside the site. */
export function absolutizeLinks(/** @type {string} */ md, /** @type {string} */ siteUrl) {
  return scanLines(md)
    .map(({ text, code }) => (code ? text : text
      .replace(/\]\(\s*<?\/(?!\/)/g, (m) => m.replace('/', siteUrl + '/'))
      .replace(/(href=["'])\/(?!\/)/g, `$1${siteUrl}/`)))
    .join('\n');
}

// ---------- small utils ----------

const toPosix = (/** @type {string} */ p) => p.split(path.sep).join('/');
function isInside(/** @type {string} */ child, /** @type {string} */ parent) {
  const rel = path.relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}
const encodePath = (/** @type {string} */ p) => p.split('/').map(encodeURIComponent).join('/');
export function titleCase(/** @type {string} */ name) {
  const s = name.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
