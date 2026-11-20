// Git facts read straight from the .git folder (no `git` process): the repository root, the `origin` URL and the
// default branch. Pure apart from reading files, so it can be tested against fixture repos.
import fs from 'node:fs';
import path from 'node:path';

/** The nearest folder at or above `from` holding a `.git` folder or file, or undefined. */
export function findGitRoot(/** @type {string} */ from) {
  for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    if (path.dirname(dir) === dir) return undefined;
  }
}

/** The git dir of a checkout (`.git`, or where a worktree's `.git` file points), and the common dir holding config. */
function gitDirs(/** @type {string} */ root) {
  const dotGit = path.join(root, '.git');
  let gitDir = dotGit;
  if (fs.statSync(dotGit).isFile()) {
    const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(dotGit, 'utf8'));
    if (!m) return undefined;
    gitDir = path.resolve(root, m[1].trim());
  }
  let commonDir = gitDir;
  const common = path.join(gitDir, 'commondir');
  if (fs.existsSync(common)) commonDir = path.resolve(gitDir, fs.readFileSync(common, 'utf8').trim());
  return { gitDir, commonDir };
}

/**
 * Minimal git-config reader: `{ 'remote "origin"': { url: '...' }, user: { name: '...' } }`. Later values win.
 * @returns {Record<string, Record<string, string>>}
 */
export function parseGitConfig(/** @type {string} */ text) {
  /** @type {Record<string, Record<string, string>>} */
  const out = {};
  let section = '';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/(^|\s)[#;].*$/, '').trim();
    if (!line) continue;
    const head = /^\[\s*([^\]\s"]+)(?:\s+"([^"]*)")?\s*\]$/.exec(line);
    if (head) {
      section = head[2] === undefined ? head[1].toLowerCase() : `${head[1].toLowerCase()} "${head[2]}"`;
      out[section] ??= {};
      continue;
    }
    const kv = /^([\w.-]+)\s*=\s*(.*)$/.exec(line);
    if (kv && section) out[section][kv[1].toLowerCase()] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return out;
}

/**
 * A repository URL as a browsable https URL: `git@github.com:me/lib.git`, `ssh://git@github.com/me/lib`,
 * `git+https://github.com/me/lib.git`, `github:me/lib` and `me/lib` all become `https://github.com/me/lib`.
 * @returns {string | undefined}
 */
export function normalizeRepoUrl(/** @type {string | undefined} */ url) {
  if (!url) return undefined;
  let u = url.trim();
  const shorthand = /^(github|gitlab|bitbucket):([\w.-]+\/[\w.-]+)$/.exec(u);
  if (shorthand) u = `https://${shorthand[1]}.${shorthand[1] === 'bitbucket' ? 'org' : 'com'}/${shorthand[2]}`;
  else if (/^[\w.-]+\/[\w.-]+$/.test(u)) u = `https://github.com/${u}`;
  u = u.replace(/^git\+/, '');
  const scp = /^(?:[\w.-]+@)?([\w.-]+):(?!\/\/)(.+)$/.exec(u); // git@host:owner/repo
  if (scp && !/^[a-z]+:\/\//i.test(u)) u = `https://${scp[1]}/${scp[2]}`;
  u = u.replace(/^(?:ssh|git|http|https):\/\/(?:[^@/]+@)?/i, 'https://');
  u = u.replace(/#.*$/, '').replace(/\.git\/?$/, '').replace(/\/+$/, '');
  // Only a plain URL: it ends up in config, markdown links and edit URLs.
  return /^https:\/\/[\w.-]+(?::\d+)?\/[\w.~%+@/-]+$/.test(u) ? u : undefined;
}

/**
 * `origin` (https form) and the default branch: origin's HEAD if known, else `main`/`master` when present, else
 * the checked-out branch. Undefined fields when unknown.
 * @returns {{ root: string, origin?: string, branch?: string, userName?: string } | undefined}
 */
export function readGit(/** @type {string} */ from) {
  const root = findGitRoot(from);
  if (!root) return undefined;
  const dirs = gitDirs(root);
  if (!dirs) return { root };
  const read = (/** @type {string} */ p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
  const config = parseGitConfig(read(path.join(dirs.commonDir, 'config')));
  const origin = normalizeRepoUrl(config['remote "origin"']?.url);

  const originHead = /^ref:\s*refs\/remotes\/origin\/(.+)$/m.exec(read(path.join(dirs.commonDir, 'refs/remotes/origin/HEAD')))?.[1];
  const packed = read(path.join(dirs.commonDir, 'packed-refs'));
  const hasBranch = (/** @type {string} */ b) =>
    fs.existsSync(path.join(dirs.commonDir, 'refs/heads', b)) ||
    fs.existsSync(path.join(dirs.commonDir, 'refs/remotes/origin', b)) ||
    packed.includes(` refs/heads/${b}\n`) ||
    packed.includes(` refs/remotes/origin/${b}\n`);
  const current = /^ref:\s*refs\/heads\/(.+)$/m.exec(read(path.join(dirs.gitDir, 'HEAD')))?.[1]?.trim();
  const branch = originHead?.trim() ?? ['main', 'master'].find(hasBranch) ?? current;
  return { root, origin, branch, userName: config.user?.name };
}

/** `user.name` from a global git config file (e.g. ~/.gitconfig), or undefined. */
export function readGlobalGitUser(/** @type {string | undefined} */ file) {
  if (!file || !fs.existsSync(file)) return undefined;
  return parseGitConfig(fs.readFileSync(file, 'utf8')).user?.name;
}
