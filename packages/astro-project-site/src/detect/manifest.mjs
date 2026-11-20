// The project's manifest: package.json, Cargo.toml, pyproject.toml, go.mod, composer.json or *.gemspec.
// Pure: each parser takes the file's text; detectManifest() only reads the first one found.
import fs from 'node:fs';
import path from 'node:path';
import { normalizeRepoUrl } from './git.mjs';

/**
 * @typedef {{ name?: string, url?: string }} Person
 * @typedef {{
 *   file: string, ecosystem: 'npm' | 'cargo' | 'python' | 'go' | 'composer' | 'ruby',
 *   name?: string, description?: string, version?: string, license?: string, homepage?: string,
 *   repository?: string, authors: Person[], private?: boolean, install?: string,
 * }} Manifest
 */

/** "Name <mail> (url)" → { name, url } */
export function parsePerson(/** @type {unknown} */ p) {
  if (!p) return undefined;
  if (typeof p === 'object') {
    const o = /** @type {Record<string, unknown>} */ (p);
    return typeof o.name === 'string' && o.name.trim() ? { name: o.name.trim(), url: typeof o.url === 'string' ? o.url : undefined } : undefined;
  }
  if (typeof p !== 'string') return undefined;
  const m = /^([^<(]+?)\s*(?:<[^>]*>)?\s*(?:\(([^)]*)\))?\s*$/.exec(p.trim());
  return m?.[1] ? { name: m[1].trim(), url: m[2]?.trim() || undefined } : undefined;
}

const str = (/** @type {unknown} */ v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const people = (/** @type {unknown} */ list) =>
  /** @type {Person[]} */ ((Array.isArray(list) ? list : list ? [list] : []).map(parsePerson).filter(Boolean));

/** @returns {Omit<Manifest, 'file'>} */
export function parsePackageJson(/** @type {string} */ text) {
  const pkg = JSON.parse(text);
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const name = str(pkg.name);
  return {
    ecosystem: 'npm',
    name,
    description: str(pkg.description),
    version: str(pkg.version),
    license: str(pkg.license) ?? str(pkg.license?.type),
    homepage: str(pkg.homepage),
    repository: normalizeRepoUrl(repo),
    authors: people(pkg.author ?? pkg.contributors?.[0]),
    private: pkg.private === true,
    install: name && pkg.private !== true ? `npm i ${name}` : undefined,
  };
}

/**
 * A tiny TOML subset: `[table]` headers, `key = "string" | 'string' | number | bool | [array] | { inline }`.
 * Enough for the manifest fields read here; values it does not understand are kept as raw text.
 * @returns {Record<string, Record<string, unknown>>}
 */
export function parseToml(/** @type {string} */ text) {
  /** @type {Record<string, Record<string, unknown>>} */
  const out = { '': {} };
  let table = '';
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const head = /^\[\[?\s*([^\]]+?)\s*\]\]?$/.exec(line);
    if (head) {
      table = head[1].replace(/"/g, '');
      out[table] ??= {};
      continue;
    }
    const kv = /^("[^"]+"|'[^']+'|[\w.-]+)\s*=\s*(.*)$/.exec(line);
    if (!kv) continue;
    let raw = kv[2];
    // Multi-line arrays and strings.
    const open = (/** @type {string} */ s) => (s.match(/\[/g)?.length ?? 0) - (s.match(/\]/g)?.length ?? 0);
    while (raw.startsWith('[') && open(raw) > 0 && i + 1 < lines.length) raw += ` ${lines[++i].trim()}`;
    if (/^("""|''')/.test(raw) && !raw.slice(3).includes(raw.slice(0, 3))) {
      const q = raw.slice(0, 3);
      while (i + 1 < lines.length && !raw.slice(3).includes(q)) raw += `\n${lines[++i]}`;
    }
    out[table][kv[1].replace(/^["']|["']$/g, '')] = tomlValue(raw);
  }
  return out;
}

/** @returns {unknown} */
function tomlValue(/** @type {string} */ raw) {
  const v = raw.replace(/\s+#[^"']*$/, '').trim();
  const triple = /^("""|''')\n?([\s\S]*?)\1/.exec(v);
  if (triple) return triple[2].trim();
  const s = /^"((?:[^"\\]|\\.)*)"|^'([^']*)'/.exec(v);
  if (s) return s[2] ?? s[1].replace(/\\(["\\])/g, '$1').replace(/\\n/g, '\n');
  if (v === 'true' || v === 'false') return v === 'true';
  if (v.startsWith('[')) {
    return [...v.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|\{([^}]*)\}/g)].map((m) =>
      m[3] !== undefined ? inlineTable(m[3]) : (m[2] ?? m[1]),
    );
  }
  if (v.startsWith('{')) return inlineTable(v.slice(1, -1));
  return v;
}

function inlineTable(/** @type {string} */ body) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const m of body.matchAll(/([\w.-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*'|true|false|[\w.-]+)/g)) out[m[1]] = tomlValue(m[2]);
  return out;
}

/** @returns {Omit<Manifest, 'file'>} */
export function parseCargoToml(/** @type {string} */ text) {
  const t = parseToml(text);
  const p = t.package ?? {};
  const name = str(p.name);
  return {
    ecosystem: 'cargo',
    name,
    description: str(p.description),
    version: str(p.version),
    license: str(p.license),
    homepage: str(p.homepage) ?? str(p.documentation),
    repository: normalizeRepoUrl(str(p.repository)),
    authors: people(p.authors),
    install: name ? `cargo add ${name}` : undefined,
  };
}

/** @returns {Omit<Manifest, 'file'>} */
export function parsePyproject(/** @type {string} */ text) {
  const t = parseToml(text);
  const poetry = t['tool.poetry'] ?? {};
  const p = { ...poetry, ...(t.project ?? {}) };
  const urls = { ...(t['tool.poetry.urls'] ?? {}), ...(t['project.urls'] ?? {}) };
  const url = (/** @type {RegExp} */ re) => str(Object.entries(urls).find(([k]) => re.test(k))?.[1]);
  const lic = p.license;
  const name = str(p.name);
  return {
    ecosystem: 'python',
    name,
    description: str(p.description),
    version: str(p.version),
    license: str(lic) ?? str(/** @type {any} */ (lic)?.text),
    homepage: str(p.homepage) ?? url(/^(home ?page|documentation|docs)$/i),
    repository: normalizeRepoUrl(str(p.repository) ?? url(/^(repository|source|source ?code|github|code)$/i)),
    authors: people(p.authors),
    install: name ? `pip install ${name}` : undefined,
  };
}

/** @returns {Omit<Manifest, 'file'>} */
export function parseGoMod(/** @type {string} */ text) {
  const module = /^module\s+(\S+)/m.exec(text)?.[1];
  const host = module?.split('/')[0] ?? '';
  return {
    ecosystem: 'go',
    name: module?.split('/').filter((s) => !/^v\d+$/.test(s)).at(-1),
    repository: /\./.test(host) && module ? normalizeRepoUrl(`https://${module.split('/').slice(0, 3).join('/')}`) : undefined,
    authors: [],
    install: module ? `go get ${module}` : undefined,
  };
}

/** @returns {Omit<Manifest, 'file'>} */
export function parseComposerJson(/** @type {string} */ text) {
  const c = JSON.parse(text);
  const name = str(c.name);
  return {
    ecosystem: 'composer',
    name: name?.split('/').at(-1),
    description: str(c.description),
    version: str(c.version),
    license: Array.isArray(c.license) ? str(c.license[0]) : str(c.license),
    homepage: str(c.homepage),
    repository: normalizeRepoUrl(str(c.support?.source)),
    authors: people(c.authors),
    install: name ? `composer require ${name}` : undefined,
  };
}

/** @returns {Omit<Manifest, 'file'>} */
export function parseGemspec(/** @type {string} */ text) {
  const field = (/** @type {string} */ f) =>
    new RegExp(`\\.${f}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\[\\s*["']([^"']*)["'])`).exec(text)?.slice(1).find((v) => v !== undefined);
  const name = field('name');
  const uri = /["']source_code_uri["']\s*=>\s*["']([^"']+)["']/.exec(text)?.[1];
  const homepage = field('homepage');
  return {
    ecosystem: 'ruby',
    name,
    description: field('summary') ?? field('description'),
    version: field('version'),
    license: field('license') ?? field('licenses'),
    homepage,
    repository: normalizeRepoUrl(uri ?? (homepage && /github\.com|gitlab\.com/.test(homepage) ? homepage : undefined)),
    authors: people(field('authors') ?? field('author')),
    install: name ? `gem install ${name}` : undefined,
  };
}

/** @type {[string, (text: string) => Omit<Manifest, 'file'>][]} */
const PARSERS = ([
  ['package.json', parsePackageJson],
  ['Cargo.toml', parseCargoToml],
  ['pyproject.toml', parsePyproject],
  ['go.mod', parseGoMod],
  ['composer.json', parseComposerJson],
]);

/**
 * The first manifest found in `root`, parsed. Malformed files are reported in `error` and skipped.
 * @returns {{ manifest?: Manifest, errors: string[] }}
 */
export function detectManifest(/** @type {string} */ root) {
  /** @type {string[]} */
  const errors = [];
  const names = fs.existsSync(root) ? fs.readdirSync(root) : [];
  /** @type {[string, (text: string) => Omit<Manifest, 'file'>][]} */
  const candidates = [...PARSERS];
  const gemspec = names.filter((n) => /^[\w.-]+\.gemspec$/.test(n)).sort()[0];
  if (gemspec) candidates.push([gemspec, parseGemspec]);
  for (const [file, parse] of candidates) {
    if (!names.includes(file)) continue;
    try {
      return { manifest: { file, ...parse(fs.readFileSync(path.join(root, file), 'utf8')) }, errors };
    } catch (error) {
      errors.push(`${file}: ${/** @type {Error} */ (error).message}`);
    }
  }
  return { errors };
}
