// <Live runner> for the landing page's docs-mount demo: takes a markdown file from a project's docs/ folder and
// shows it the way the site serves it: title from the first heading, `.md` links rewritten to docs pages, other
// relative links sent to the file on GitHub. It follows the rules of the package's docs/mount.mjs (resolveHref), on
// a file list passed in ctx.options at build time; the markdown renderer is a small one for this demo only.
//
// ctx.options: { route, label, repo, branch, dir (mount folder, repo-relative), file (this file, mount-relative),
//                files: { [mountRelativePath]: titleSlug | null }, sidebar: [{ label, href, depth }] }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const slugify = (t) => t.trim().toLowerCase().replace(/\s/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '');

/** posix path.normalize for 'a/b/../c' (may climb above the root: returns a leading '../'). */
function normalize(p) {
  const out = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..' && out.length && out.at(-1) !== '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

function idFor(o, rel) {
  const parts = rel.replace(/\.md$/i, '').split('/');
  const last = parts.at(-1)?.toLowerCase();
  if (last === 'readme' || last === 'index') parts.pop();
  return `/docs/${[o.route, ...parts.map(slugify)].filter(Boolean).join('/')}/`;
}

/** { href, kind: 'docs' | 'repo' | 'missing' | 'kept' } for a link written in the current file. */
function resolve(o, href) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^(https?|mailto):/i.test(href)) return { href: '#', kind: 'kept' };
  if (!href || /^([a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(href)) return { href, kind: 'kept' };
  const [, rawPath = '', hash = ''] = /^([^#?]*)(?:\?[^#]*)?(#.*)?$/.exec(href) ?? [];
  const fromDir = o.file.split('/').slice(0, -1).join('/');
  const target = normalize(`${fromDir}/${rawPath}`);
  if (!target.startsWith('..')) {
    let rel = target;
    if (!/\.md$/i.test(rel)) {
      const readme = ['README.md', 'readme.md', 'index.md'].map((n) => (rel ? `${rel}/${n}` : n)).find((n) => n in o.files);
      if (readme) rel = readme;
    }
    if (/\.md$/i.test(rel)) {
      const exists = rel in o.files;
      const dropHash = exists && hash && hash.slice(1) === o.files[rel];
      return { href: idFor(o, rel) + (dropHash ? '' : hash), kind: exists ? 'docs' : 'missing' };
    }
  }
  const inRepo = normalize(`${o.dir}/${target}`);
  const kind = /\/$/.test(rawPath) || !/\.\w+$/.test(rawPath) ? 'tree' : 'blob';
  return { href: `${o.repo}/${kind}/${o.branch}/${inRepo}${hash}`, kind: 'repo' };
}

/** Inline markdown: code spans, links, bold, emphasis. Text is escaped first. */
function inline(text, o, links) {
  const codes = [];
  let s = text.replace(/(`+)\s?([^`]*?)\s?\1/g, (_m, _t, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = esc(s);
  s = s.replace(/\[([^\]]*)\]\(\s*([^\s)]+)\s*\)/g, (_m, label, rawHref) => {
    const href = rawHref.replace(/&amp;/g, '&');
    const r = resolve(o, href);
    links.push({ from: href, ...r });
    const note = r.kind === 'kept' ? '' : `<span class="dm-to" data-kind="${r.kind}">${esc(r.kind === 'repo' ? 'GitHub' : r.href)}</span>`;
    return `<a href="${esc(r.href)}" data-kind="${r.kind}"${r.kind === 'repo' ? ' rel="noopener"' : ''}>${label}</a>${note}`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^\w*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_m, n) => `<code>${esc(codes[Number(n)])}</code>`);
}

function render(md, o, links) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let title;
  let para = [];
  let list = null;
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '), o, links)}</p>`);
    para = [];
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i, o, links)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    const fence = /^\s{0,3}(`{3,}|~{3,})\s*([\w-]*)/.exec(line);
    if (fence) {
      flush();
      const body = [];
      while (++n < lines.length && !lines[n].trimStart().startsWith(fence[1])) body.push(lines[n]);
      out.push(`<pre data-lang="${esc(fence[2])}"><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    const h = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      flush();
      if (h[1].length === 1 && title === undefined) {
        title = h[2];
        continue;
      }
      // Page headings, shown as styled paragraphs so the demo does not add to this page's outline.
      out.push(`<p class="dm-h" data-level="${h[1].length}" id="dm-${esc(slugify(h[2]))}">${inline(h[2], o, links)}</p>`);
      continue;
    }
    const item = /^\s{0,3}([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      const tag = /\d/.test(item[1]) ? 'ol' : 'ul';
      if (para.length || (list && list.tag !== tag)) flush();
      list ??= { tag, items: [] };
      list.items.push(item[2]);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (/^\s{0,3}>\s?/.test(line)) {
      flush();
      out.push(`<blockquote><p>${inline(line.replace(/^\s{0,3}>\s?/, ''), o, links)}</p></blockquote>`);
      continue;
    }
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  return { title, html: out.join('\n') };
}

export function run(source, mount, ctx) {
  const o = ctx.options;
  const links = [];
  const { title, html } = render(source, o, links);
  const pageTitle = title ? title.replace(/[`*_]/g, '') : o.file.replace(/\.md$/i, '');
  const self = idFor(o, o.file);

  const box = document.createElement('div');
  box.className = 'dm';
  box.innerHTML = `
    <div class="dm-url" aria-hidden="true"><code>${esc(new URL(self, 'https://x').pathname)}</code></div>
    <div class="dm-page">
      <nav class="dm-side" aria-label="Generated sidebar (preview)">
        <p class="dm-group">${esc(o.label)}</p>
        <ul>${o.sidebar
          .map((s) => `<li data-depth="${s.depth}"${s.href === self ? ' aria-current="page"' : ''}>${s.href ? `<a href="${esc(s.href)}">${esc(s.label)}</a>` : `<span>${esc(s.label)}</span>`}</li>`)
          .join('')}</ul>
      </nav>
      <article class="dm-body">
        <p class="dm-title">${esc(pageTitle)}</p>
        ${html}
      </article>
    </div>`;
  mount.append(box);

  const docs = links.filter((l) => l.kind === 'docs').length;
  const repo = links.filter((l) => l.kind === 'repo').length;
  const missing = links.filter((l) => l.kind === 'missing');
  if (!title) ctx.status('No "# Title" line: the page would be titled after its file name.', 'warn');
  else if (missing.length) {
    ctx.status(`${missing.map((l) => l.from).join(', ')}: no such file in docs/; the build’s link check would fail here.`, 'warn');
  } else {
    ctx.status(`ok: title from the first heading; ${docs} link${docs === 1 ? '' : 's'} → docs pages, ${repo} → GitHub`, 'ok');
  }
}
