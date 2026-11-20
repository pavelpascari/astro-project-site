// The files `project-site init` writes, from what detectProject() found. Pure: returns paths and contents (or
// starter files to copy); src/init.mjs does the writing.
import fs from 'node:fs';
import path from 'node:path';
import { oneLine } from '../detect/index.mjs';
import { idForFile } from '../docs/mount.mjs';
import { comment, lit, note, str } from './js.mjs';

/**
 * @typedef {import('../detect/index.mjs').Detected} Detected
 * @typedef {{ to: string, content?: string, from?: string }} PlannedFile  from: absolute path of a starter file to copy
 * @typedef {{ packageSpec: string, version: string, today: string, starter: string }} GenerateOptions
 */

/** Folders of working notes inside docs/ that are left out of the site unless the user removes the exclude. */
const INTERNAL_DOCS = ['plans', 'research', 'internal', 'drafts', 'notes', 'wip', 'private', 'scratch'];

/** The `externalDocs` route for the docs folder and for the project files. */
export const DOCS_ROUTE = 'reference';
export const PROJECT_ROUTE = 'project';
/** URL prefix of mirrored demo folders. */
export const APPS_ROUTE = 'apps';

/** Everything the site config needs, decided once (also used for the summary). */
export function siteModel(/** @type {Detected} */ d) {
  const example = d.empty;
  const r = d.toRoot;
  /** @type {{ dir: string, route: string, label: string, order?: string[], include?: string[], exclude?: string[], pages: number, index?: string }[]} */
  const mounts = [];
  if (example) {
    mounts.push({ dir: './example/docs', route: DOCS_ROUTE, label: 'Reference', order: ['getting-started.md'], pages: 4, index: `/docs/${DOCS_ROUTE}/` });
  } else if (d.docs) {
    const docs = d.docs;
    // Working notes kept next to the docs (plans/, research/, ...) stay out of the site by default.
    const internal = INTERNAL_DOCS.filter((dir) => docs.pages.some((p) => p.split('/')[0].toLowerCase() === dir));
    const exclude = internal.length ? internal.map((dir) => `${dir}/**`) : undefined;
    const published = docs.pages.filter((p) => !internal.includes(p.split('/')[0].toLowerCase()));
    const first = d.docs.hasIndex ? undefined : (d.docs.order[0] ?? d.docs.pages.find((p) => !p.includes('/')) ?? d.docs.pages[0]);
    mounts.push({
      dir: `${r}/${d.docs.dir}`,
      route: DOCS_ROUTE,
      label: 'Reference',
      order: d.docs.order.length ? d.docs.order : undefined,
      exclude,
      pages: published.length,
      index: `/${idForFile(/** @type {any} */ ({ routeId: `docs/${DOCS_ROUTE}` }), first ?? 'README.md')}/`,
    });
  }
  const projectFiles = [d.project.readme, d.project.changelog, d.project.contributing].filter((f) => f !== undefined);
  if (projectFiles.length) {
    const first = d.project.readme ?? projectFiles[0];
    mounts.push({
      dir: r,
      route: PROJECT_ROUTE,
      label: 'Project',
      include: projectFiles,
      pages: projectFiles.length,
      index: `/${idForFile(/** @type {any} */ ({ routeId: `docs/${PROJECT_ROUTE}` }), first)}/`,
    });
  }

  /** @type {{ from: string, to: string, include?: string[] }[]} */
  const mirrors = example
    ? [{ from: './example/apps', to: APPS_ROUTE }]
    : d.demos.dirs.length
      ? [{ from: r, to: APPS_ROUTE, include: [...d.demos.dirs.map((x) => x.dir), ...d.demos.needs] }]
      : [];

  /** @type {{ slug: string, title: string, description: string, href: string, tags: string[], order: number }[]} */
  const gallery = [];
  for (const dir of d.demos.dirs) {
    for (const page of dir.pages) {
      const rel = page.file.replace(/(^|\/)index\.html?$/i, '$1');
      gallery.push({
        slug: page.file.replace(/\.html?$/i, '').replace(/[^\w-]+/g, '-').toLowerCase(),
        title: oneLine(page.title) ?? 'Untitled page',
        description: oneLine(page.description) ?? oneLine(`A page from the ${dir.dir}/ folder.`) ?? '',
        href: `/${APPS_ROUTE}/${rel}`,
        tags: [dir.dir],
        order: (gallery.length + 1) * 10,
      });
    }
  }
  const hasGallery = example || gallery.length > 0;

  const docsStart = mounts.find((m) => m.route === DOCS_ROUTE);
  const gettingStarted = !example && d.docs?.order[0] ? `/${idForFile(/** @type {any} */ ({ routeId: `docs/${DOCS_ROUTE}` }), d.docs.order[0])}/` : undefined;

  const nav = [
    { label: 'Docs', href: '/docs/' },
    { label: 'Blog', href: '/blog/' },
    ...(hasGallery ? [{ label: 'Gallery', href: '/gallery/' }] : []),
    ...(example ? [{ label: 'Playground', href: '/apps/hello/' }] : []),
  ];
  const licence = d.license?.spdx ? `Released under the ${d.license.spdx} licence.` : d.license?.file ? `See ${d.license.file} for the licence.` : undefined;
  return { example, mounts, mirrors, gallery, hasGallery, nav, docsStart, gettingStarted, licence };
}

/** @param {Detected} d @param {ReturnType<typeof siteModel>} m */
export function astroConfig(d, m) {
  const src = (/** @type {{ from?: string, todo?: boolean } | undefined} */ f) => (f?.todo ? undefined : f?.from);
  const sources = [d.manifest?.file, d.readmeFile, d.docs && `${d.docs.dir}/`, d.git?.origin && 'git origin'].filter(Boolean);
  const steps = d.readme?.steps ?? [];
  const features = d.readme?.features ?? [];

  /** @type {Record<string, unknown>} */
  const hero = {
    lead: d.lead ? note(d.lead, { comment: `${d.readmeFile}: the intro` }) : undefined,
    primary: { label: 'Get started', href: m.gettingStarted ?? '/docs/' },
    secondary: m.hasGallery
      ? { label: 'Gallery', href: '/gallery/' }
      : !d.repo.todo
        ? { label: 'Source', href: d.repo.value }
        : undefined,
  };
  /** @type {Record<string, unknown>} */
  const landing = {
    hero,
    features: features.length
      ? note({ title: d.readme?.featuresHeading ?? 'Features', items: features }, { comment: `${d.readmeFile}, "${d.readme?.featuresHeading}"` })
      : note(undefined, { comment: `features: [{ title, body }], cards under the hero (none found in ${d.readmeFile ?? 'a README'}).` }),
    steps: steps.length
      ? note(
          { title: d.readme?.stepsHeading && d.readme.stepsHeading.length <= 60 ? d.readme.stepsHeading : 'Get started', items: steps },
          { comment: `${d.readmeFile}, "${d.readme?.stepsHeading}": its code blocks` },
        )
      : d.install
        ? note({ title: 'Get started', items: [{ title: 'Install', body: '', code: d.install.value, lang: 'sh' }] }, { comment: `steps: the install command (${d.install.from})` })
        : undefined,
  };

  const blog = d.authors.length
    ? { authors: Object.fromEntries(d.authors.map((a) => [a.key, a.url ? { name: a.name, url: a.url } : { name: a.name }])) }
    : true;

  const options = {
    name: note(d.name.value, { comment: d.name.todo ? 'TODO: the project name (from the folder name).' : `from ${d.name.from}` }),
    tagline: note(d.tagline.value, { comment: d.tagline.todo ? 'TODO: one line about the project, shown under the name and in meta descriptions.' : `from ${d.tagline.from}` }),
    url: note(d.url.value, {
      comment: d.url.todo
        ? ['TODO: the production URL. With wrangler.jsonc as generated, that is', `https://${d.slug}.<your-subdomain>.workers.dev (or your custom domain).`]
        : `from ${d.url.from}`,
    }),
    repo: note(d.repo.value, { comment: d.repo.todo ? 'TODO: the source repository (no git origin or manifest repository found).' : `from ${src(d.repo)}` }),
    repoBranch: d.branch.value !== 'main' || d.branch.todo ? note(d.branch.value, { comment: d.branch.todo ? 'TODO: the default branch.' : undefined }) : undefined,
    versionFrom: d.versionFrom ? note(d.versionFrom, { comment: `the header shows its version (${d.version?.value})` }) : undefined,
    install: d.install
      ? note(d.install.value, { comment: `from ${d.install.from}` })
      : d.manifest?.private
        ? note(undefined, { comment: `install: no install command: ${d.manifest.file} is private and the README shows none.` })
        : undefined,
    nav: m.nav,
    externalDocs: m.mounts.length
      ? note(
          m.mounts.map((x) => ({ dir: x.dir, route: x.route, label: x.label, order: x.order, include: x.include, exclude: x.exclude })),
          {
            comment: [
              m.example
                ? 'Stand-in docs, mounted under /docs/reference/: point `dir` at your markdown folder.'
                : 'Markdown from the repository, mounted under /docs/<route>/. Links between mounted files become site',
              ...(m.example ? [] : ['links; other relative links point at the file in the repo. `include` picks files from a folder.']),
            ],
          },
        )
      : undefined,
    mirrors: m.mirrors.length
      ? note(m.mirrors, {
          comment: m.example
            ? 'Stand-in static apps, served as they are under /apps/: point `from` at your own.'
            : [
                `Static pages served byte for byte under /${APPS_ROUTE}/${d.demos.needs.length ? ', with the folders they load from' : ''}, so their`,
                'relative URLs keep working. One gallery entry per page is in src/content/gallery/.',
              ],
        })
      : undefined,
    gallery: m.hasGallery ? undefined : note(false, { comment: 'No demo pages found (examples/, demo/, demos/, playground/ with .html): no /gallery/.' }),
    landing: note(landing, { comment: 'The landing page at /. Hero title defaults to `name`, its lead to `tagline`.' }),
    blog: note(blog, {
      comment: [
        'The blog at /blog/: one file per post in src/content/blog/ (title, description, date, authors, tags, draft).',
        ...(d.authors.length ? [`Authors from ${d.authors[0].from}.`] : []),
      ],
    }),
    footer: m.licence
      ? note({ note: m.licence }, { comment: `from ${d.license?.file ?? d.manifest?.file}` })
      : undefined,
    ogImage: m.example
      ? '/og.png'
      : note('/og.png', { off: true, comment: 'A default social image (1200×630) in public/:' }),
  };

  const header = m.example
    ? 'Created by `project-site init` with placeholders: nothing to read from in this folder.'
    : `Generated by \`project-site init\` from ${sources.join(', ') || 'the repository'}.`;
  return `// @ts-check
// ${comment(header)}
// Every option: https://github.com/pavelpascari/astro-project-site#options${anyTodo(d) ? '\n// Search for TODO: those values are placeholders.' : ''}
import { defineConfig } from 'astro/config';
import projectSite from 'astro-project-site';

export default defineConfig({
  integrations: [
    projectSite(${lit(options, 2)}),
  ],
});
`;
}

const anyTodo = (/** @type {Detected} */ d) => d.name.todo || d.tagline.todo || d.url.todo || d.repo.todo || d.branch.todo;

/** The first blog post, drafted from the README. Only restates what the README says. */
export function firstPost(/** @type {Detected} */ d, /** @type {ReturnType<typeof siteModel>} */ m, /** @type {string} */ today) {
  const r = d.readme;
  const lines = [
    '---',
    `title: ${yaml(`Introducing ${d.name.value}`)}`,
    `description: ${yaml(d.tagline.value)}`,
    `date: ${today}`,
    ...(d.authors.length ? [`authors: [${d.authors.map((a) => a.key).join(', ')}]`] : []),
    'tags: [announcement]',
    'draft: true',
    '---',
    '',
    `<!-- Drafted by \`project-site init\` from ${mdComment(d.readmeFile ?? 'placeholders')}. Read it through, make it yours, then set \`draft: false\`. -->`,
    '',
    '## What it is',
    '',
    d.lead ?? r?.intro ?? (d.tagline.todo ? `<!-- TODO: what ${mdComment(d.name.value)} is, in a paragraph. -->` : d.tagline.value),
    '',
    '## Why',
    '',
  ];
  if (r?.features.length) {
    for (const f of r.features) lines.push(`- **${f.title}**${f.body ? ` — ${f.body}` : ''}`);
  } else {
    lines.push(`<!-- TODO: why ${mdComment(d.name.value)} exists: the problem, and what it does differently. -->`);
  }
  lines.push('', '## Getting started', '');
  const code = (/** @type {string} */ lang, /** @type {string} */ body) => {
    const fence = body.includes('```') ? '~~~' : '```';
    return [fence + lang, body, fence];
  };
  const steps = r?.steps ?? [];
  if (d.install && !steps.some((s) => s.code.includes(d.install?.value ?? '\0'))) lines.push(...code('sh', d.install.value), '');
  for (const s of steps) {
    const label = /^Step \d+$/.test(s.title) ? '' : s.title;
    if (label && (steps.length > 1 || s.body)) lines.push(s.body ? `${label}: ${s.body}` : `${label}:`, '');
    lines.push(...code(s.lang, s.code), '');
  }
  if (!d.install && !steps.length) lines.push(`<!-- TODO: how to install and use ${mdComment(d.name.value)}. -->`, '');
  lines.push(`The [documentation](${m.gettingStarted ?? '/docs/'}) has the rest.`, '', "## What's next", '');
  if (d.project.changelog && !m.example) lines.push(`- What changed in each release is in the [changelog](/docs/${PROJECT_ROUTE}/changelog/).`);
  if (!d.repo.todo) lines.push(`- The source, issues and discussions are on [${d.repo.value.replace(/^https:\/\//, '')}](${d.repo.value}).`);
  if (d.project.contributing && !m.example) lines.push(`- Contributions are welcome: see [contributing](/docs/${PROJECT_ROUTE}/contributing/).`);
  lines.push('', `<!-- TODO: what you are working on next. -->`, '');
  return lines.join('\n');
}

/**
 * A YAML scalar: plain when it is unmistakably plain text, else double-quoted with every line break and control
 * character escaped (a JSON string, which is valid YAML, plus U+2028/U+2029/U+0085 escaped).
 */
export function yaml(/** @type {string} */ s) {
  if (/^[A-Za-z0-9(][A-Za-z0-9 .()/_+@'’—–-]*$/.test(s) && !/\s$/.test(s) && !/^(true|false|null|yes|no|on|off|y|n)$/i.test(s) && !/^[\d.+-]+$/.test(s)) return s;
  return JSON.stringify(s).replace(/[\u0085\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Text for inside an HTML comment in markdown: one line, never closing the comment. */
const mdComment = (/** @type {string} */ s) => comment(s).replace(/--+/g, '-');

/** src/content/docs/docs/index.md: the /docs/ page, pointing at the mounted sections. */
export function docsIndex(/** @type {Detected} */ d, /** @type {ReturnType<typeof siteModel>} */ m) {
  const lines = ['---', `title: ${yaml(`${d.name.value} documentation`)}`, `description: ${yaml(d.tagline.value)}`, '---', ''];
  lines.push(d.lead ?? d.tagline.value, '');
  for (const x of m.mounts) {
    const what = x.route === PROJECT_ROUTE
      ? `${x.include?.join(', ')} from the repository root`
      : `the ${path.posix.basename(x.dir)}/ folder of the repository (${x.pages} page${x.pages === 1 ? '' : 's'})`;
    lines.push(`- [${x.label}](${x.index}): ${what}.`);
  }
  if (!m.mounts.length) lines.push('<!-- TODO: write the docs here, in src/content/docs/docs/, or mount a markdown folder with `externalDocs`. -->');
  lines.push('', 'Pages in `src/content/docs/docs/` appear here too, next to the mounted ones.', '');
  return lines.join('\n');
}

/** One gallery entry (YAML). */
export function galleryEntry(/** @type {ReturnType<typeof siteModel>['gallery'][number]} */ g) {
  return [
    '# A demo page found by `project-site init` (title from its <title>). Fields: title, description, href, kind,',
    '# tags, order, poster (an image next to this file) or posterUrl, posterAlt, pixelated, external, draft.',
    `title: ${yaml(g.title)}`,
    `description: ${yaml(g.description)}`,
    `href: ${yaml(g.href)}`,
    'kind: demo',
    `tags: [${g.tags.map((t) => JSON.stringify(t).replace(/[\u0085\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`)).join(', ')}]`,
    `order: ${g.order}`,
    '',
  ].join('\n');
}

/** The site's package.json, from the starter's (scripts, dependency versions). */
export function packageJson(/** @type {string} */ starterText, /** @type {string} */ name, /** @type {string} */ packageSpec) {
  const json = JSON.parse(starterText);
  json.name = name;
  json.dependencies = { ...json.dependencies, 'astro-project-site': packageSpec };
  return `${JSON.stringify(json, null, 2)}\n`;
}

/** The CI workflow, pinned to this release; `working-directory` when the site is a subfolder of the repo. */
export function workflow(/** @type {string} */ starterText, /** @type {string} */ version, /** @type {string | undefined} */ workingDirectory) {
  let text = starterText.replace(/(astro-project-site\/\.github\/workflows\/deploy\.yml)@[\w.-]+/, `$1@v${version}`);
  if (workingDirectory && workingDirectory !== '.') {
    text = text
      .replace(/permissions: \{/, () => `with: { working-directory: ${yaml(workingDirectory)} }, permissions: {`)
      .replace(/^(# Pinned.*)$/m, `$1\n# GitHub runs workflows from the repository's .github/workflows/ only: move this file there.`);
  }
  return text;
}

/** wrangler.jsonc named after the project. Worker names are lowercase letters, digits and dashes (max 63). */
export function wrangler(/** @type {string} */ starterText, /** @type {string} */ name) {
  const safe = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name) ? name : 'project-site';
  return starterText.replace(/"name":\s*"[^"]*"/, () => `"name": ${JSON.stringify(safe)}`);
}

/** The site's README. */
export function siteReadme(/** @type {Detected} */ d, /** @type {ReturnType<typeof siteModel>} */ m) {
  return `# ${comment(d.name.value)} — website

Built with [astro-project-site](https://github.com/pavelpascari/astro-project-site): a landing page, docs, a blog
and a gallery${m.example ? '' : `, from the repository's own files`}.

\`\`\`bash
npm install
npm run dev            # http://localhost:4321
npm run build          # astro check + build into dist/ + docs:check
npm run deploy         # Cloudflare Workers (after \`npx wrangler login\`)
\`\`\`

| file | what it is |
|---|---|
| \`astro.config.mjs\` | everything about the site: \`projectSite({ ... })\` |
${m.mounts.filter((x) => !m.example).map((x) => `| \`${x.dir}${x.include ? `/{${x.include.join(',')}}` : '/'}\` | mounted under \`/docs/${x.route}/\` (\`externalDocs\`) |\n`).join('')}| \`src/content/docs/docs/\` | docs pages of the site itself, under \`/docs/\` |
| \`src/content/blog/\` | blog posts (\`draft: true\` ones are not published) |
${m.hasGallery ? '| `src/content/gallery/` | one file per gallery item |\n' : ''}${m.example ? '| `example/` | stand-ins for your docs and apps: point `externalDocs` and `mirrors` at the real ones |\n' : ''}| \`wrangler.jsonc\`, \`public/_headers\` | Cloudflare Workers deploy |
| \`.github/workflows/site.yml\` | CI: checks, a preview per PR, production on \`v*\` tags${d.sameFolder || m.example ? '' : ' (move it to the repo root\'s `.github/workflows/`)'} |
`;
}

/** The docs-gen config: the starter's generators, over the mounted docs folder. */
export function docsGenConfig(/** @type {string} */ starterText, /** @type {string[]} */ files) {
  return starterText.replace(/files: \[[^\]]*\]/, `files: ${lit(files)}`);
}

/** Every file to write, in order. */
export function planFiles(/** @type {Detected} */ d, /** @type {GenerateOptions} */ o) {
  const m = siteModel(d);
  const s = (/** @type {string} */ rel) => path.join(o.starter, rel);
  const read = (/** @type {string} */ rel) => fs.readFileSync(s(rel), 'utf8');
  const siteName = m.example || d.name.from === 'folder name' ? d.slug : `${d.slug}-site`;
  const workingDirectory = d.sameFolder ? undefined : path.relative(d.git?.root ?? d.root, d.site).split(path.sep).join('/');

  /** @type {PlannedFile[]} */
  const files = [
    { to: 'astro.config.mjs', content: astroConfig(d, m) },
    { to: 'package.json', content: packageJson(read('package.json'), siteName, o.packageSpec) },
    { to: 'README.md', content: siteReadme(d, m) },
    { to: 'wrangler.jsonc', content: wrangler(read('wrangler.jsonc'), d.slug) },
    { to: '.github/workflows/site.yml', content: workflow(read('.github/workflows/site.yml'), o.version, workingDirectory) },
    { to: '.gitignore', from: s('_gitignore') },
    { to: 'tsconfig.json', content: m.example ? read('tsconfig.json') : read('tsconfig.json').replace(/, "example\/apps"/, '') },
    { to: 'docs-gen.config.mjs', content: docsGenConfig(read('docs-gen.config.mjs'), m.example ? ['example/docs'] : d.docs ? [`${d.toRoot}/${d.docs.dir}`] : ['src/content/docs']) },
    { to: 'src/content.config.ts', from: s('src/content.config.ts') },
    { to: 'public/_headers', from: s('public/_headers') },
    { to: 'public/favicon.svg', from: s('public/favicon.svg') },
  ];
  if (m.example) {
    files.push({ to: 'public/og.png', from: s('public/og.png') });
    files.push({ to: 'src/content/docs/docs/index.mdx', from: s('src/content/docs/docs/index.mdx') });
    for (const rel of walk(s('example'))) files.push({ to: `example/${rel}`, from: s(`example/${rel}`) });
    files.push({ to: 'src/content/gallery/hello.yaml', from: s('src/content/gallery/hello.yaml') });
    files.push({ to: 'src/content/gallery/hello.png', from: s('src/content/gallery/hello.png') });
  } else {
    files.push({ to: 'src/content/docs/docs/index.md', content: docsIndex(d, m) });
    for (const g of m.gallery) files.push({ to: `src/content/gallery/${g.slug}.yaml`, content: galleryEntry(g) });
    // The gallery collection is defined either way; an existing (empty) folder keeps its loader from warning.
    if (!m.gallery.length) files.push({ to: 'src/content/gallery/.gitkeep', content: '' });
  }
  files.push({ to: `src/content/blog/${o.today}-introducing-${d.slug}.md`, content: firstPost(d, m, o.today) });
  return { files, model: m };
}

function walk(/** @type {string} */ dir, prefix = '') {
  /** @type {string[]} */
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (ent.name === '.DS_Store' || ent.name === 'node_modules') continue;
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...walk(path.join(dir, ent.name), rel));
    else out.push(rel);
  }
  return out;
}

export { str };
