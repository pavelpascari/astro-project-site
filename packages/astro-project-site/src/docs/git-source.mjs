// `externalDocs` entries with a `git` source: a folder of another repository, downloaded at build time and then
// mounted like a local folder.
//
//   externalDocs: [{ git: { repo: 'https://github.com/org/lib', ref: 'v1.4.0', path: 'docs' }, route: 'lib', label: 'Lib' }]
//
// The download is a shallow, sparse fetch (only `path`, at `ref`, no history) into Astro's cache folder
// (node_modules/.astro/project-site-git/ by default). A tag or commit is fetched once and reused, offline too; a
// branch moves, so it is fetched again on every build (falling back to the last copy, with a warning, when the
// network is down). Needs the `git` command.
//
// fetchGitDocs gives each git entry a `dir` (the downloaded folder, relative to the project root) and a `source`
// (where the files came from), so the rest of the pipeline mounts it as it mounts any folder; links to files that
// are not mounted, and "Edit page", point at the other repository (see mount.mjs).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const META = 'project-site-source.json';
const SHA = /^[0-9a-f]{40}$/i;

export class GitDocsError extends Error {
  constructor(/** @type {string} */ message) {
    super(message);
    this.name = 'GitDocsError';
  }
}

/**
 * @typedef {{ repo: string, ref: string, path: string }} GitSpec
 * @typedef {{ repo: string, ref: string, path: string, commit: string, kind: 'tag' | 'branch' | 'commit',
 *   defaultBranch?: string }} GitMeta
 * @typedef {{ info?: (m: string) => void, warn?: (m: string) => void }} Logger
 */

/**
 * Downloads every `externalDocs[].git` folder (or reuses the cached copy) and sets the entry's `dir` and `source`.
 * Mutates `options.externalDocs`. Throws GitDocsError naming the entry when a fetch fails and nothing is cached.
 * @param {{ externalDocs: any[] }} options
 * @param {string} root absolute project root
 * @param {{ cacheDir: string, logger?: Logger, env?: NodeJS.ProcessEnv }} ctx
 */
export function fetchGitDocs(options, root, { cacheDir, logger = {}, env = process.env }) {
  options.externalDocs.forEach((entry, i) => {
    if (!entry.git) return;
    /** @type {GitSpec} */
    const spec = entry.git;
    const where = `externalDocs[${i}].git (${spec.repo} at ${spec.ref})`;
    const checkout = path.join(cacheDir, 'project-site-git', cacheName(spec));
    const meta = ensureCheckout(spec, checkout, where, logger, env);
    const dir = path.join(checkout, spec.path);
    entry.dir = toPosix(path.relative(root, dir)) || '.';
    entry.source = {
      root: toPosix(path.relative(root, checkout)),
      web: webUrl(spec.repo),
      ref: spec.ref,
      commit: meta.commit,
      editBranch: meta.defaultBranch,
    };
  });
}

/** Folder name in the cache: readable, plus a hash of everything that changes the content. */
export function cacheName(/** @type {GitSpec} */ spec) {
  const name = (spec.repo.replace(/\.git$/, '').split(/[/:]/).filter(Boolean).at(-1) ?? 'repo').replace(/[^\w.-]/g, '_');
  const hash = createHash('sha256').update(`${spec.repo}\n${spec.ref}\n${spec.path}`).digest('hex').slice(0, 12);
  return `${name}-${hash}`;
}

/**
 * Browser URL of a repository, for links and edit links: `https://host/owner/repo` from https, ssh and scp-style
 * (`git@host:owner/repo.git`) URLs. undefined for anything else (file://), which leaves those links as written.
 */
export function webUrl(/** @type {string} */ repo) {
  const strip = (/** @type {string} */ u) => u.replace(/\.git$/, '').replace(/\/+$/, '');
  if (/^https?:\/\//.test(repo)) {
    const u = new URL(repo);
    u.username = '';
    u.password = '';
    return strip(u.toString());
  }
  const scp = /^git@([^:/]+):(.+)$/.exec(repo);
  if (scp) return strip(`https://${scp[1]}/${scp[2]}`);
  const ssh = /^ssh:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/.exec(repo);
  if (ssh) return strip(`https://${ssh[1]}/${ssh[2]}`);
  return undefined;
}

/** The cached checkout's metadata when it can be used as is, else a fresh download (falling back to the cache). */
function ensureCheckout(
  /** @type {GitSpec} */ spec,
  /** @type {string} */ checkout,
  /** @type {string} */ where,
  /** @type {Logger} */ logger,
  /** @type {NodeJS.ProcessEnv} */ env,
) {
  const cached = readMeta(checkout, spec);
  if (cached && cached.kind !== 'branch') return cached;
  const tmp = `${checkout}.tmp-${process.pid}`;
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
    const meta = download(spec, tmp, env);
    fs.rmSync(checkout, { recursive: true, force: true });
    fs.renameSync(tmp, checkout);
    if (meta.kind === 'branch') {
      logger.warn?.(`${where}: "${spec.ref}" is a branch, so these docs change when it moves. Pin a tag or commit for builds that repeat.`);
    }
    logger.info?.(`${where}: fetched ${spec.path || '(repository root)'} at ${meta.commit.slice(0, 12)}`);
    return meta;
  } catch (error) {
    fs.rmSync(tmp, { recursive: true, force: true });
    const reason = error instanceof Error ? error.message : String(error);
    if (cached) {
      logger.warn?.(`${where}: could not fetch (${reason}); using the copy from ${cached.commit.slice(0, 12)}.`);
      return cached;
    }
    throw new GitDocsError(`${where}: ${reason}`);
  }
}

function readMeta(/** @type {string} */ checkout, /** @type {GitSpec} */ spec) {
  try {
    /** @type {GitMeta} */
    const meta = JSON.parse(fs.readFileSync(path.join(checkout, '.git', META), 'utf8'));
    return meta.repo === spec.repo && meta.ref === spec.ref && meta.path === spec.path ? meta : undefined;
  } catch {
    return undefined;
  }
}

/** Fetches `spec.path` at `spec.ref` into `dir` (a new folder). Throws an Error with a readable message. */
function download(/** @type {GitSpec} */ spec, /** @type {string} */ dir, /** @type {NodeJS.ProcessEnv} */ env) {
  fs.mkdirSync(dir, { recursive: true });
  const run = gitRunner(dir, spec.repo, env);
  run(['init', '-q']);
  run(['remote', 'add', 'origin', spec.repo]);

  // What `ref` names (and the default branch, for edit links), in one round trip.
  const listing = run(['ls-remote', '--symref', 'origin', 'HEAD', `refs/heads/${spec.ref}`, `refs/tags/${spec.ref}`]);
  const defaultBranch = /^ref: refs\/heads\/(\S+)\s+HEAD$/m.exec(listing)?.[1];
  /** @type {GitMeta['kind']} */
  let kind;
  if (new RegExp(`\\srefs/tags/${escapeRegExp(spec.ref)}$`, 'm').test(listing)) kind = 'tag';
  else if (new RegExp(`\\srefs/heads/${escapeRegExp(spec.ref)}$`, 'm').test(listing)) kind = 'branch';
  else if (SHA.test(spec.ref)) kind = 'commit';
  else throw new Error(`no tag or branch "${spec.ref}" (a commit must be given as its full 40-character SHA)`);

  if (spec.path) run(['sparse-checkout', 'set', '--cone', '--', spec.path]);
  const want = kind === 'commit' ? spec.ref : kind === 'tag' ? `refs/tags/${spec.ref}` : `refs/heads/${spec.ref}`;
  run(['fetch', '-q', '--depth', '1', '--filter=blob:none', '--no-tags', 'origin', want]);
  run(['-c', 'advice.detachedHead=false', 'checkout', '-q', 'FETCH_HEAD']);
  const commit = run(['rev-parse', 'HEAD']).trim();
  const folder = path.join(dir, spec.path);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) throw new Error(`the repository has no folder "${spec.path}" at that ref`);

  /** @type {GitMeta} */
  const meta = { repo: spec.repo, ref: spec.ref, path: spec.path, commit, kind, defaultBranch };
  fs.writeFileSync(path.join(dir, '.git', META), JSON.stringify(meta, null, 2) + '\n');
  return meta;
}

/**
 * The environment git runs with: it never prompts, and for github.com over https it sends GITHUB_TOKEN (when set)
 * as a header through GIT_CONFIG_* variables, so the token is neither on the command line nor written to the
 * checkout's config.
 */
export function gitEnvFor(/** @type {string} */ repo, /** @type {NodeJS.ProcessEnv} */ env) {
  /** @type {NodeJS.ProcessEnv} */
  const gitEnv = { ...env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' };
  const token = env.GITHUB_TOKEN;
  if (token && /^https:\/\/(www\.)?github\.com\//.test(repo)) {
    const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
    const n = Number(env.GIT_CONFIG_COUNT ?? 0) || 0;
    gitEnv.GIT_CONFIG_COUNT = String(n + 1);
    gitEnv[`GIT_CONFIG_KEY_${n}`] = 'http.https://github.com/.extraheader';
    gitEnv[`GIT_CONFIG_VALUE_${n}`] = `AUTHORIZATION: basic ${basic}`;
  }
  return gitEnv;
}

/** Runs git in `cwd` (no hooks, see gitEnvFor) and returns stdout; a failure throws git's own message. */
function gitRunner(/** @type {string} */ cwd, /** @type {string} */ repo, /** @type {NodeJS.ProcessEnv} */ env) {
  const gitEnv = gitEnvFor(repo, env);
  return (/** @type {string[]} */ args) => {
    const r = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd, env: gitEnv, encoding: 'utf8', timeout: 120_000 });
    if (r.error) {
      throw new Error(
        /** @type {NodeJS.ErrnoException} */ (r.error).code === 'ENOENT' ? 'the `git` command is not installed' : r.error.message,
      );
    }
    if (r.status !== 0) {
      const text = r.stderr
        .split('\n')
        .filter((l) => l.trim() && !/filtering not recognized by server/.test(l))
        .join(' ')
        .trim();
      throw new Error(text || `git ${args[0]} failed`);
    }
    return r.stdout;
  };
}

const escapeRegExp = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toPosix = (/** @type {string} */ p) => p.split(path.sep).join('/');
