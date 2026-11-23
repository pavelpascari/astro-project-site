// <Live runner> for the landing hero: reads an astro.config.mjs, finds the projectSite({...}) call and draws what
// that config produces: the header and hero of the site, and every route it serves.
//
// The config is parsed, never evaluated (a small object-literal parser: strings, numbers, booleans, arrays, objects,
// comments, trailing commas, `...spread`). Spreads are filled from ctx.options.spreads. Validation mirrors the
// package's options.mjs closely enough to show its error format; the build is the real check.

// Copies of OPTION_NAMES and COMPONENT_NAMES in options.mjs (this file runs in the browser, without zod);
// scripts/landing-runners.test.mjs fails when they differ.
export const KNOWN = [
  'name', 'tagline', 'url', 'repo', 'repoBranch', 'versionFrom', 'nav', 'externalDocs', 'docsOrder', 'mirrors',
  'install', 'favicon', 'ogImage', 'ogImageFor', 'theme', 'landing', 'gallery', 'blog', 'header', 'footer', 'labels',
  'llms', 'linksValidator', 'customCss', 'head', 'components', 'starlight', 'markdown',
];
export const COMPONENTS = ['Header', 'Footer', 'Hero', 'Landing', 'GalleryCard', 'Gallery', 'BlogIndex', 'BlogPost', 'BlogCard'];

class ParseError extends Error {
  constructor(message, src, at) {
    const line = src.slice(0, at).split('\n').length;
    super(`astro.config.mjs, line ${line}: ${message}`);
    this.name = 'SyntaxError';
  }
}

/** Parses the object literal starting at `start` (a `{`). Returns { value, spreads }. */
function parseObjectLiteral(src, start) {
  let i = start;
  const spreads = [];
  const ws = () => {
    for (;;) {
      if (/\s/.test(src[i] ?? '')) i++;
      else if (src.startsWith('//', i)) i = src.indexOf('\n', i) === -1 ? src.length : src.indexOf('\n', i);
      else if (src.startsWith('/*', i)) {
        const end = src.indexOf('*/', i + 2);
        if (end === -1) throw new ParseError('unclosed comment', src, i);
        i = end + 2;
      } else return;
    }
  };
  const fail = (what) => {
    throw new ParseError(`expected ${what}, found ${src[i] ? JSON.stringify(src.slice(i, i + 12).split('\n')[0]) : 'the end'}`, src, i);
  };
  const ident = () => {
    const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
    if (!m) return undefined;
    i += m[0].length;
    return m[0];
  };
  const string = () => {
    const q = src[i];
    let out = '';
    i++;
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') {
        const n = src[i + 1];
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
        i += 2;
      } else if (q === '`' && src.startsWith('${', i)) {
        throw new ParseError('template expressions (${…}) are not supported in this preview', src, i);
      } else if (q !== '`' && src[i] === '\n') {
        throw new ParseError('unterminated string', src, i);
      } else out += src[i++];
    }
    if (src[i] !== q) throw new ParseError('unterminated string', src, i);
    i++;
    return out;
  };
  const value = (path) => {
    ws();
    const c = src[i];
    if (c === '{') return object(path);
    if (c === '[') return array(path);
    if (c === "'" || c === '"' || c === '`') return string();
    const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    const id = ident();
    if (id === 'true') return true;
    if (id === 'false') return false;
    if (id === 'null') return null;
    if (id === 'undefined') return undefined;
    if (id) return { $ref: id };
    return fail('a value');
  };
  const array = (path) => {
    i++;
    const out = [];
    for (;;) {
      ws();
      if (src[i] === ']') {
        i++;
        return out;
      }
      out.push(value(`${path}[${out.length}]`));
      ws();
      if (src[i] === ',') i++;
      else if (src[i] !== ']') fail("',' or ']'");
    }
  };
  const object = (path) => {
    i++;
    const out = {};
    for (;;) {
      ws();
      if (src[i] === '}') {
        i++;
        return out;
      }
      if (src.startsWith('...', i)) {
        i += 3;
        const name = ident() ?? fail('a name after ...');
        spreads.push({ path, name, into: out });
      } else {
        const key = src[i] === "'" || src[i] === '"' ? string() : (ident() ?? fail('a property name'));
        ws();
        if (src[i] !== ':') fail("':'");
        i++;
        out[key] = value(path ? `${path}.${key}` : key);
      }
      ws();
      if (src[i] === ',') i++;
      else if (src[i] !== '}') fail("',' or '}'");
    }
  };
  ws();
  if (src[i] !== '{') fail("'{'");
  const result = object('');
  return { value: result, spreads };
}

export function extract(source) {
  const call = /projectSite\s*\(/.exec(source);
  const from = call ? call.index + call[0].length : 0;
  const brace = source.indexOf('{', from);
  if (brace === -1) throw new ParseError("no options object: expected projectSite({ … })", source, from);
  return parseObjectLiteral(source, brace);
}

function isUrl(s) {
  try {
    return typeof s === 'string' && /^https?:$/.test(new URL(s).protocol);
  } catch {
    return false;
  }
}

/** The same "field: problem" lines the integration prints, for the mistakes worth showing. */
export function validate(o) {
  const problems = [];
  const str = (k, v, required) => {
    if (v === undefined) {
      if (required) problems.push(`${k}: Invalid input: expected string, received undefined`);
    } else if (typeof v !== 'string') problems.push(`${k}: Invalid input: expected string`);
  };
  str('name', o.name, true);
  if (o.name === '') problems.push('name: Too small: expected string to have >=1 characters');
  str('tagline', o.tagline, true);
  for (const k of ['url', 'repo']) {
    if (o[k] === undefined) problems.push(`${k}: Invalid input: expected string, received undefined`);
    else if (!isUrl(o[k])) problems.push(`${k}: Invalid URL`);
  }
  const unknown = Object.keys(o).filter((k) => !KNOWN.includes(k));
  if (unknown.length) problems.push(`unknown option${unknown.length > 1 ? 's' : ''} ${unknown.map((k) => `"${k}"`).join(', ')}`);
  const list = (k, fields) => {
    if (o[k] === undefined) return;
    if (!Array.isArray(o[k])) return problems.push(`${k}: Invalid input: expected array`);
    o[k].forEach((item, n) => {
      for (const f of fields) {
        if (typeof item?.[f] !== 'string') problems.push(`${k}[${n}].${f}: Invalid input: expected string, received ${item?.[f] === undefined ? 'undefined' : typeof item[f]}`);
      }
    });
  };
  list('nav', ['label', 'href']);
  list('externalDocs', ['route', 'label']);
  (Array.isArray(o.externalDocs) ? o.externalDocs : []).forEach((d, n) => {
    const local = typeof d?.dir === 'string';
    const git = d?.git && typeof d.git === 'object' && typeof d.git.repo === 'string' && typeof d.git.ref === 'string';
    if (local === !!git) problems.push(`externalDocs[${n}]: give either \`dir\` (a local folder) or \`git\` ({ repo, ref, path? }), not both`);
  });
  list('mirrors', ['from', 'to']);
  if (o.components && typeof o.components === 'object') {
    const bad = Object.keys(o.components).filter((k) => !COMPONENTS.includes(k));
    if (bad.length) problems.push(`components: unknown option${bad.length > 1 ? 's' : ''} ${bad.map((k) => `"${k}"`).join(', ')}`);
  }
  if (problems.length) {
    const err = new Error(`Invalid projectSite() options:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    err.name = 'ProjectSiteOptionsError';
    throw err;
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project-site';
const trim = (s) => s.replace(/^\/+|\/+$/g, '');
const shown = (v, fallback) => (v && typeof v === 'object' && '$ref' in v ? fallback : v);

const GITHUB =
  'M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8 0 3.2.9.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1 .9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3';

export function run(source, mount, ctx) {
  const { value: o, spreads } = extract(source);
  const missing = [];
  for (const s of spreads) {
    const data = ctx.options.spreads?.[s.name];
    if (data && typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) if (!(k in s.into)) s.into[k] = v;
    } else missing.push(s.name);
  }
  validate(o);

  const version = ctx.options.version;
  const host = new URL(o.url).host;
  const nav = o.nav ?? [{ label: 'Docs', href: '/docs/' }, ...(o.gallery === false ? [] : [{ label: 'Gallery', href: '/gallery/' }])];
  const accent = ctx.theme === 'dark' ? (o.theme?.accentDark ?? o.theme?.accent) : o.theme?.accent;
  const landing = o.landing === false ? undefined : (o.landing ?? {});
  const hero = landing?.hero ?? {};
  const primary = hero.primary ?? { label: 'Get started' };

  /** @type {[string, string][]} */
  const routes = [];
  const own = ctx.options.ownPages ?? [];
  routes.push([
    '/',
    own.includes('/')
      ? 'landing page: your own, src/pages/index.astro'
      : o.landing === false
      ? 'no landing page (landing: false)'
      : o.components?.Landing
        ? `landing page: your component, ${o.components.Landing}`
        : 'landing page, from the landing option',
  ]);
  routes.push(['/docs/', 'Starlight docs: search, sitemap, link checks, edit links']);
  for (const d of o.externalDocs ?? []) {
    const from = d.git ? `${d.git.path || 'the root'} of ${d.git.repo} at ${d.git.ref}, downloaded and` : `the markdown in ${d.dir},`;
    routes.push([`/docs/${trim(String(d.route))}/`, `${d.label}: ${from} mounted`]);
  }
  if (o.gallery !== false) {
    routes.push(['/gallery/', own.includes('/gallery/') ? 'gallery: your own page' : 'gallery, from src/content/gallery/']);
  }
  // blog: true, or an object (its `route` defaults to "blog"); false or absent: no blog.
  if (o.blog) {
    const route = trim(String((typeof o.blog === 'object' && o.blog.route) || 'blog'));
    routes.push([`/${route}/`, 'blog, from src/content/blog/: tags, feeds, reading time']);
  }
  for (const m of o.mirrors ?? []) routes.push([`/${trim(String(m.to))}/`, `${m.from}, served byte for byte`]);
  if (o.llms !== false) routes.push(['/llms.txt', 'and /llms-full.txt, the docs for LLMs']);
  const worker = slug(String(o.name));
  routes.push([`pr-12-${worker}.…workers.dev`, 'a preview for every pull request (the starter’s CI)']);

  const box = document.createElement('div');
  box.className = 'cp';
  if (accent) box.style.setProperty('--cp-accent', accent);
  box.innerHTML = `
    <div class="cp-window" aria-label="The site this config builds">
      <div class="cp-chrome" aria-hidden="true"><span></span><span></span><span></span><code>${esc(host)}</code></div>
      <div class="cp-bar">
        <span class="cp-brand">${esc(o.name)}</span>
        ${version ? `<span class="cp-ver">v${esc(version)}</span>` : ''}
        <span class="cp-nav">${nav.map((n) => `<span>${esc(n.label)}</span>`).join('')}</span>
        ${/github\.com/.test(String(o.repo)) ? `<svg class="cp-gh" viewBox="0 0 24 24" aria-label="GitHub" role="img"><path fill="currentColor" d="${GITHUB}"/></svg>` : ''}
      </div>
      ${
        landing
          ? `<div class="cp-hero">
        <p class="cp-title">${esc(shown(hero.title, o.name) ?? o.name)}</p>
        <p class="cp-lead">${esc(shown(hero.lead, o.tagline) ?? o.tagline)}</p>
        <p class="cp-actions"><span class="cp-btn">${esc(shown(primary.label, 'Get started'))}</span>${
          o.install ? `<code class="cp-install">$ ${esc(o.install)}</code>` : ''
        }</p>
      </div>`
          : ''
      }
    </div>
    <p class="cp-routes-label">Serves</p>
    <ul class="cp-routes">${routes.map(([r, what]) => `<li><code>${esc(r)}</code><span>${esc(what)}</span></li>`).join('')}</ul>`;
  mount.append(box);

  const lines = source.split('\n').filter((l) => l.trim() && !/^\s*\/\//.test(l)).length;
  const note = missing.length ? ` (…${missing.join(', ')}: not resolved in this preview)` : '';
  ctx.status(`ok: ${lines} lines of config → ${routes.length - 1} routes and a preview per PR${note}`, 'ok');
}
