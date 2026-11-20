// detectProject(): everything `project-site init` learns about a repository, and where each fact came from.
// Reads files under the repository root only (and the git config); never runs anything.
import fs from 'node:fs';
import path from 'node:path';
import { detectDemos, detectDocs, detectLicense, detectProjectFiles } from './files.mjs';
import { readGit } from './git.mjs';
import { detectManifest } from './manifest.mjs';
import { parseReadme } from './readme.mjs';

export { normalizeRepoUrl, parseGitConfig, readGit, readGlobalGitUser, findGitRoot } from './git.mjs';
export { parseReadme, splitFeature } from './readme.mjs';
export * from './manifest.mjs';
export { detectDemos, detectDocs, detectLicense, detectProjectFiles, identifyLicense, htmlMeta } from './files.mjs';

const GENERIC = new Set(['website', 'site', 'web', 'www', 'docs', 'doc', 'documentation', 'homepage', 'pages']);

/** `my-lib` from a project or folder name (an npm scope is dropped). */
export const slugify = (/** @type {string} */ s) =>
  s.replace(/^@[^/]+\//, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project-site';

/** "My Lib" from a folder or package name. */
export const titleFrom = (/** @type {string} */ s) =>
  s.replace(/^@[^/]+\//, '').replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()) || 'My Project';

/** One line of plain text: every run of whitespace (line breaks, U+2028/U+2029 included) becomes one space. */
export const oneLine = (/** @type {string | undefined} */ s) => s?.replace(/[\s\u0085]+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim() || undefined;

/** A version worth showing: `1.2.3`, `0.2.0-alpha.0`, `2.0.0+build.5`. Anything else is ignored. */
const VERSION = /^[\w.+-]+$/;
/** An SPDX-ish licence expression: `MIT`, `MIT OR Apache-2.0`, `(MIT AND BSD-3-Clause)`. */
const SPDX = /^[\w.+() -]{1,80}$/;
/** An absolute http(s) URL without spaces, quotes or angle brackets. */
const SAFE_URL = /^https?:\/\/[^\s"'`<>\\]+$/;

/** Manifest fields reduced to what is safe to show and write: one-line text, a plain version, http(s) URLs. */
function sanitizeManifest(/** @type {import('./manifest.mjs').Manifest} */ m) {
  return {
    ...m,
    name: oneLine(m.name),
    description: oneLine(m.description),
    version: m.version && VERSION.test(m.version) ? m.version : undefined,
    license: m.license && SPDX.test(m.license) ? m.license : undefined,
    homepage: m.homepage && SAFE_URL.test(m.homepage) ? m.homepage : undefined,
    install: oneLine(m.install),
    authors: m.authors
      .map((a) => ({ name: oneLine(a.name), url: a.url && SAFE_URL.test(a.url) ? a.url : undefined }))
      .filter((a) => a.name),
  };
}

/** README facts with one-line titles and text (code blocks are kept as written; they are only ever quoted). */
function sanitizeReadme(/** @type {import('./readme.mjs').ReadmeFacts} */ r) {
  return {
    ...r,
    title: oneLine(r.title),
    intro: oneLine(r.intro),
    tagline: oneLine(r.tagline),
    featuresHeading: oneLine(r.featuresHeading),
    stepsHeading: oneLine(r.stepsHeading),
    install: oneLine(r.install),
    features: r.features.map((f) => ({ title: oneLine(f.title) ?? '', body: oneLine(f.body) ?? '' })).filter((f) => f.title),
    steps: r.steps.map((st) => ({ ...st, title: oneLine(st.title) ?? 'Step', body: oneLine(st.body) ?? '' })),
  };
}

/** A value and where it came from (`package.json`, `README.md`, `git origin`), or a placeholder (`todo`). */
/** @template T @typedef {{ value: T, from?: string, todo?: boolean }} Fact */

/**
 * @typedef {{
 *   root: string, site: string, toRoot: string, sameFolder: boolean,
 *   git?: ReturnType<typeof readGit>,
 *   manifest?: import('./manifest.mjs').Manifest, errors: string[],
 *   readmeFile?: string, readme?: import('./readme.mjs').ReadmeFacts,
 *   docs?: ReturnType<typeof detectDocs>, project: ReturnType<typeof detectProjectFiles>,
 *   license?: ReturnType<typeof detectLicense>, demos: ReturnType<typeof detectDemos>,
 *   name: Fact<string>, slug: string, tagline: Fact<string>, lead?: string, repo: Fact<string>, branch: Fact<string>,
 *   url: Fact<string>, install?: Fact<string>, version?: Fact<string>, versionFrom?: string,
 *   authors: { key: string, name: string, url?: string, from: string }[],
 *   empty: boolean,
 *   usesMermaid: boolean,
 * }} Detected
 */

/**
 * @param {{ root: string, site: string, name?: string, gitUser?: string }} opts
 *   root: the repository root to read; site: the folder the site goes to (never read, never mounted);
 *   name: --name; gitUser: the global git user.name, when the repo config has none.
 * @returns {Detected}
 */
export function detectProject({ root, site, name: nameOverride, gitUser }) {
  root = path.resolve(root);
  site = path.resolve(site);
  const sameFolder = root === site;
  const toRoot = path.relative(site, root).split(path.sep).join('/') || '.';
  // The site's own folder is never part of what is read, mounted or mirrored.
  const skip = sameFolder ? [] : [site];
  const git = readGit(root);
  const { manifest: rawManifest, errors } = detectManifest(root);
  const manifest = rawManifest && sanitizeManifest(rawManifest);
  const project = sameFolder ? { readme: undefined, changelog: undefined, contributing: undefined } : detectProjectFiles(root);
  const readmeFile = sameFolder ? undefined : project.readme;
  const readme = readmeFile ? sanitizeReadme(parseReadme(fs.readFileSync(path.join(root, readmeFile), 'utf8'))) : undefined;
  const docs = sameFolder ? undefined : detectDocs(root, skip);
  const license = detectLicense(root, manifest?.license);
  if (license?.spdx && !SPDX.test(license.spdx)) license.spdx = undefined;
  const demos = sameFolder ? { dirs: [], needs: [] } : detectDemos(root, skip);

  // The site folder's name, unless it is a generic one (`website`): then the repository folder's.
  const folder = GENERIC.has(path.basename(site).toLowerCase()) ? path.basename(root) : path.basename(site);
  /** @type {Fact<string>} */
  const name = nameOverride
    ? { value: oneLine(nameOverride) ?? 'My Project', from: '--name' }
    : readme?.title && readme.title.length <= 40
      ? { value: readme.title, from: readmeFile }
      : manifest?.name
        ? { value: titleFrom(manifest.name), from: manifest.file }
        : { value: titleFrom(folder), from: 'folder name', todo: !readme?.title };
  const slug = slugify(manifest?.name ?? name.value);

  const desc = manifest?.description;
  /** @type {Fact<string>} */
  const tagline = desc && desc.length <= 160
    ? { value: desc, from: manifest?.file }
    : readme?.tagline
      ? { value: readme.tagline, from: readmeFile }
      : desc
        ? { value: desc, from: manifest?.file }
        : { value: `${name.value}: one line about what it does.`, todo: true };
  const lead = readme?.intro && readme.intro !== tagline.value ? readme.intro : undefined;

  /** @type {Fact<string>} */
  const repo = git?.origin
    ? { value: git.origin, from: 'git origin' }
    : manifest?.repository
      ? { value: manifest.repository, from: manifest.file }
      : { value: `https://github.com/OWNER/${slug}`, todo: true };
  /** @type {Fact<string>} */
  const branch = git?.branch ? { value: git.branch, from: 'git' } : { value: 'main', todo: !!git };

  const home = manifest?.homepage?.replace(/#.*$/, '').replace(/\/+$/, '');
  const homeIsRepo = !home || home.startsWith(repo.value) || /github\.com|gitlab\.com|npmjs\.com|crates\.io|pypi\.org/.test(home);
  /** @type {Fact<string>} */
  const url = !homeIsRepo && home && SAFE_URL.test(home)
    ? { value: home, from: `${manifest?.file} homepage` }
    : { value: `https://${slug}.example.workers.dev`, todo: true };

  /** @type {Fact<string> | undefined} */
  const install = readme?.install
    ? { value: readme.install, from: readmeFile }
    : manifest?.install
      ? { value: manifest.install, from: manifest.file }
      : undefined;

  const versionFrom = manifest?.file === 'package.json' && manifest.version && !sameFolder ? `${toRoot}/package.json` : undefined;
  const version = manifest?.version ? { value: manifest.version, from: manifest.file } : undefined;

  const people = manifest?.authors?.length
    ? manifest.authors.map((a) => ({ ...a, from: manifest.file }))
    : oneLine(git?.userName ?? gitUser)
      ? [{ name: /** @type {string} */ (oneLine(git?.userName ?? gitUser)), url: undefined, from: 'git user.name' }]
      : [];
  const authors = people
    .filter((p) => p.name)
    .slice(0, 3)
    .map((p) => ({ key: slugify(/** @type {string} */ (p.name)), name: /** @type {string} */ (p.name), url: p.url, from: p.from }));

  const empty = !manifest && !readme && !docs && !demos.dirs.length && !project.changelog && !project.contributing;
  // Mermaid is an optional dependency of the template: add it only when the markdown being mounted has diagrams.
  const markdownFiles = [
    ...[project.readme, project.changelog, project.contributing].filter((f) => f !== undefined).map((f) => path.join(root, f)),
    ...(docs ? docs.pages.map((p) => path.join(root, docs.dir, p)) : []),
  ];
  const usesMermaid = markdownFiles.some((file) => {
    try {
      return /^\s{0,3}(`{3,}|~{3,})\s*mermaid\b/m.test(fs.readFileSync(file, 'utf8'));
    } catch {
      return false;
    }
  });

  return {
    root, site, toRoot, sameFolder, git, manifest, errors, readmeFile, readme, docs, project, license, demos,
    name, slug, tagline, lead, repo, branch, url, install, version, versionFrom, authors, empty, usesMermaid,
  };
}
