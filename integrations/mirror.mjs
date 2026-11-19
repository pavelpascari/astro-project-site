// OWNER: deploy agent. Copies static apps listed in site.config `mirrors` into the build, and serves them in dev.
//
// A mirror is a folder of plain HTML/JS (a studio, demo pages, the framework's own src/) that must reach the
// browser byte for byte, with its relative layout intact, so `../src/x.js` and `fetch('../examples/a.json')`
// keep working. Astro never sees these files: in dev a middleware serves them straight from disk, and at build
// they are copied into the output after Astro has finished.
//
//   mirrors: [{ from: '../', to: 'pixel', include: ['src', 'studio', 'demo'], exclude: ['*.test.js'] }]
//
// - from     folder to copy, relative to the site root. May be outside it (`../`, `../../framework`).
// - to       URL prefix it is served under (`pixel` → /pixel/...). Nested prefixes (`pixel/src`) are fine,
//            and several mirrors may share one prefix.
// - include  globs relative to `from`; when given, only matching paths are mirrored.
// - exclude  globs relative to `from`; matching paths are skipped.
//   Globs: `*` and `?` stay within one path segment, `**` crosses segments, `{a,b}` is alternation.
//   A pattern that matches a folder covers everything inside it (`src` = `src/**`). A pattern without
//   a `/` is tried against every path segment, so `*.map` or `test` match at any depth.
// Always skipped: dotfiles and dot-folders (.git, .env, ...), node_modules, and the site's own folder when
// `from` contains it (so `from: '../'` from a `website/` subfolder does not mirror the site into itself).
import { cp, mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
};

/** @param {{ mirrors?: { from: string; to: string; include?: string[]; exclude?: string[] }[] }} site */
export function mirror(site) {
  /** @type {ReturnType<typeof resolveMirror>[]} */
  let mirrors = [];

  return {
    name: 'project-site:mirror',
    hooks: {
      'astro:config:setup': ({ config }) => {
        const root = resolve(fileURLToPath(config.root));
        mirrors = (site.mirrors ?? []).map((m, i) => resolveMirror(m, i, root, resolve(fileURLToPath(config.outDir))));
      },

      'astro:server:setup': ({ server, logger }) => {
        if (!mirrors.length) return;
        // Longest prefix first, so `pixel/src` wins over `pixel` when both exist.
        const ordered = [...mirrors].sort((a, b) => b.to.length - a.to.length);
        server.middlewares.use(async (req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') return next();
          try {
            const hit = await resolveRequest(ordered, req.url ?? '/');
            if (!hit) return next();
            if (hit.redirect) {
              res.writeHead(301, { location: hit.redirect, 'cache-control': 'no-store' });
              return res.end();
            }
            const body = await readFile(hit.file);
            res.writeHead(200, {
              'content-type': MIME[extname(hit.file).toLowerCase()] ?? 'application/octet-stream',
              'content-length': body.length,
              'cache-control': 'no-store',
            });
            res.end(req.method === 'HEAD' ? undefined : body);
          } catch (err) {
            logger.error(`Serving ${req.url} failed: ${err instanceof Error ? err.message : err}`);
            next(err);
          }
        });
        for (const m of mirrors) logger.info(`/${m.to}/ → ${m.source} (${m.from})`);
      },

      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        /** Files Astro (or an earlier mirror) wrote, so a mirror never silently replaces a page. */
        const owners = new Map();
        for (const m of mirrors) {
          const files = await collect(m);
          let bytes = 0;
          for (const rel of files) {
            const target = join(out, m.to, rel);
            const key = relative(out, target);
            if (owners.has(key)) {
              logger.warn(`/${key} is mirrored by both ${owners.get(key)} and ${m.label}; the latter wins.`);
            } else if (existsSync(target)) {
              throw new Error(`[mirror] ${m.label} would overwrite /${key}, which the site itself builds. Change \`to\` or exclude the file.`);
            }
            owners.set(key, m.label);
            await mkdir(dirname(target), { recursive: true });
            await cp(join(m.from, rel), target, { dereference: true, preserveTimestamps: true });
            bytes += (await stat(target)).size;
          }
          if (!files.length) logger.warn(`${m.label} matched no files.`);
          logger.info(`/${m.to}/ ← ${m.source}: ${files.length} files, ${formatBytes(bytes)}`);
        }
      },
    },
  };
}

/** Validates one config entry and turns it into absolute paths and compiled matchers. */
function resolveMirror(entry, index, root, outDir) {
  const label = `mirrors[${index}]`;
  if (!entry || typeof entry.from !== 'string' || typeof entry.to !== 'string') {
    throw new Error(`[mirror] ${label} needs string \`from\` and \`to\`.`);
  }
  const from = resolve(root, entry.from);
  if (!existsSync(from) || !statSync(from).isDirectory()) {
    throw new Error(
      `[mirror] ${label}.from "${entry.from}" resolves to ${from}, which is not a folder. ` +
        `Paths are relative to the site root (${root}). In CI, check that the repository holding it is checked out.`,
    );
  }
  const to = entry.to.replace(/^\/+|\/+$/g, '');
  if (!to || to.split('/').some((seg) => !seg || seg === '.' || seg === '..' || seg.startsWith('.'))) {
    throw new Error(`[mirror] ${label}.to "${entry.to}" must be a URL prefix like "apps" or "pixel/src".`);
  }
  // Never mirror the site's own folder (and with it dist/, node_modules/) into itself.
  const skip = [root, outDir].filter((p) => isInside(p, from));
  return {
    label: `${label} (${entry.from})`,
    source: entry.from,
    from,
    to,
    skip,
    include: (entry.include ?? []).map(compileGlob),
    exclude: (entry.exclude ?? []).map(compileGlob),
  };
}

/** Maps a dev request URL to a file in a mirror, a trailing-slash redirect, or null (not ours: let Astro answer). */
async function resolveRequest(mirrors, url) {
  const { pathname, search } = new URL(url, 'http://local');
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (path.includes('\0')) return null;
  for (const m of mirrors) {
    const prefix = `/${m.to}`;
    if (path !== prefix && !path.startsWith(`${prefix}/`)) continue;
    if (path === prefix) return { redirect: `${prefix}/${search}` };
    const rel = path.slice(prefix.length + 1);
    const segments = rel.split('/').filter(Boolean);
    // Traversal and hidden paths are refused outright, before touching the disk.
    if (segments.some((s) => s === '..' || s.startsWith('.') || s === 'node_modules' || s.includes('\\'))) return null;
    const file = resolve(m.from, ...segments);
    if (file !== m.from && !isInside(file, m.from)) return null;
    if (m.skip.some((s) => file === s || isInside(file, s))) return null;
    const info = await stat(file).catch(() => null);
    if (!info) continue;
    if (info.isDirectory()) {
      if (rel && !rel.endsWith('/')) return { redirect: `${pathname}/${search}` };
      const index = join(file, 'index.html');
      if (existsSync(index) && allowed(m, [...segments, 'index.html'].join('/'))) return { file: index };
      continue;
    }
    if (allowed(m, segments.join('/'))) return { file };
  }
  return null;
}

/** Lists files (posix paths relative to `from`) that a mirror copies. */
async function collect(m) {
  const files = [];
  async function walk(dir, rel) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const abs = join(dir, entry.name);
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (m.skip.includes(abs) || matchesAny(m.exclude, path)) continue;
        if (m.include.length && !matchesAny(m.include, path) && !m.include.some((g) => g.couldMatchBelow(path))) continue;
        await walk(abs, path);
      } else if (allowed(m, path) && (entry.isFile() || (entry.isSymbolicLink() && (await stat(abs).catch(() => null))?.isFile()))) {
        files.push(path); // symlinks to files are copied as the file they point to; symlinked folders are skipped
      }
    }
  }
  await walk(m.from, '');
  return files.sort();
}

function allowed(m, path) {
  if (matchesAny(m.exclude, path)) return false;
  return !m.include.length || matchesAny(m.include, path);
}

/** True if the glob matches the path or one of its parent folders. */
function matchesAny(globs, path) {
  if (!globs.length) return false;
  const segs = path.split('/');
  for (let i = segs.length; i > 0; i--) {
    const sub = segs.slice(0, i).join('/');
    if (globs.some((g) => g.test(sub, segs[i - 1]))) return true;
  }
  return false;
}

/** Compiles a small glob dialect (`*`, `?`, `**`, `{a,b}`, `[...]`) to a matcher, no dependencies. */
function compileGlob(pattern) {
  const clean = pattern.replace(/^\.\//, '').replace(/\/+$/, '');
  const anyDepth = !clean.includes('/');
  const whole = new RegExp(`^${globToRegex(clean)}$`);
  const segments = clean.split('/').map((s) => (s === '**' ? null : new RegExp(`^${globToRegex(s)}$`)));
  return {
    test: (path, basename) => (anyDepth ? whole.test(basename) : whole.test(path)),
    /** Whether something inside folder `dir` could still match, so the walk must descend into it. */
    couldMatchBelow(dir) {
      if (anyDepth) return true;
      const parts = dir.split('/');
      for (let i = 0; i < parts.length; i++) {
        if (i >= segments.length) return false;
        if (segments[i] === null) return true;
        if (!segments[i].test(parts[i])) return false;
      }
      return true;
    },
  };
}

function globToRegex(glob) {
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

function isInside(child, parent) {
  const rel = relative(parent, child);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
