# Changelog

## Unreleased

### Blog

- New option `blog` (`true` or `{ route, title, description, authors, postsPerPage, rss, landing }`), off unless set.
  Posts are `src/content/blog/**/*.{md,mdx}` (new `blog` collection in `projectSiteCollections()`, silent when the
  folder is missing); frontmatter `title`, `description`, `date` (required), `updated`, `authors`, `tags`, `draft`,
  `image`, `imageAlt`, `canonical`. A missing field fails the build naming the file.
- Pages: `/blog/` (paginated `/blog/2/`), `/blog/<path>/`, `/blog/tags/`, `/blog/tags/<tag>/`, `/blog/rss.xml` (summary
  feed, `<link rel="alternate">` on every page, docs included). Posts go into `/llms.txt`, `/llms-full.txt` and the
  sitemap; drafts are built in dev only, with a badge. A "Blog" nav item is added to the default `nav`.
- New component slots `BlogIndex`, `BlogPost`, `BlogCard`; new components `LatestPosts` (also on the built-in landing,
  `blog.landing`), `BlogTags`, `PostMeta`, `TagList`; long-form styles `components/blog/prose.css` (`--blog-*` tokens).
- New `MarginNote` component (`astro-project-site/components` or `astro-project-site/margin-note`): side notes in the
  margin of posts, beside the paragraph in docs, inline asides on narrow screens; `kind` note / field / warning,
  optional numbering.
- `BaseLayout`/`SiteHead`: new `type` (`website` | `article`) and `canonical` props.
- Option errors: a union option (`blog: { routee }`) names the unknown key instead of "Invalid input".
- New dependency `@astrojs/rss` (MIT).

### `init` reads the repository

- A README code block with no sentence before it is titled from its code ("Run `npx tool a`, `b` and `c`", "Add it
  to your page") instead of "Step N".
- The blog's empty page says when drafts are waiting (they are left out of production builds) instead of "No posts
  yet".
`project-site init` builds the site from the repository it is for:

- Reads the manifest (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `composer.json`, `*.gemspec`), the
  git `origin` and default branch, the README (title, intro, features, install/usage code), `docs/`, `CHANGELOG.md`,
  `CONTRIBUTING.md`, `LICENSE` and demo folders with HTML pages. Writes a commented `astro.config.mjs` (landing page,
  docs mounts, mirrors, blog, footer; placeholders marked `TODO`), one gallery entry per demo page, a draft first
  blog post from the README, `/docs/` index page, `package.json`, `wrangler.jsonc` named after the project and the
  pinned CI workflow (`working-directory` set when the site is a subfolder).
- Prints a "Found" summary and the files it will write, then asks; `--yes` skips the question (required without a
  terminal, unless `--dry-run`), `--dry-run` writes nothing, `--from <dir>` reads another folder. Never writes
  outside the target folder, never overwrites without `--force`.
- Repository text is data, never code: every comment in generated files is one line (line terminators, U+2028/
  U+2029 become spaces), strings are escaped JS literals or quoted YAML, versions/licences/URLs that do not look
  like one are dropped, the Worker name is a slug, and only plainly named `*.gemspec` files are read.
- An empty folder still gets the starter's placeholders and example docs/apps; `--blank` always copies the plain
  starter (the previous behaviour).
- `externalDocs[].include`: globs picking the files of a mount, so a repo-root mount
  (`{ dir: '..', route: 'project', label: 'Project', include: ['README.md', 'CHANGELOG.md'] }`) mounts just those.
  The site's own folder is never mounted (also without `include`). A file belongs to the deepest mount whose globs
  accept it, for link rewriting, the content loader and llms.txt.

### Markdown: GitHub parity

Markdown renders at least as well as on GitHub everywhere it appears (docs, `externalDocs` folders, blog posts,
a project's own `.md` pages): the plugins are registered on Astro's global markdown processor (Sätteri).

- GitHub alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`), emoji shortcodes, visible
  "Footnotes" label, named task-list checkboxes, tables that scroll in their own box, `<details>`/`<kbd>` styles.
- Math (`$…$`, `$$…$$`, ```` ```math ````) typeset with KaTeX at build time; KaTeX's CSS and fonts are served from
  `/_project-site/katex-<version>/` and linked only from pages with math. `$5 and $6` stays text (GitHub's rule).
- ```` ```mermaid ```` diagrams rendered in the browser: Mermaid is loaded only on pages with diagrams, when one
  scrolls near; themed from the site tokens and redrawn on theme switch; wide diagrams scroll; source kept as the
  text alternative and shown when a diagram cannot be drawn.
- Code blocks: line numbers (`showLineNumbers`) and collapsible sections (`collapse={…}`) plugins, shell prompts
  that are neither selectable nor copied (output lines left out of the copy), a "Wrap lines" toggle on blocks that
  overflow, and aliases for `shell-session`, `terminal`, `env`, … Also applied to `<Code>`/`<Live>`.
- Heading anchor links on markdown pages outside the docs; `--` is no longer turned into an en dash.
- New `markdown` option: `{ alerts, emoji, math, mermaid, headingLinks, codeWrapToggle }`, all `true` by default.
- New dependencies (all MIT unless noted): `mermaid`, `katex`, `gemoji`, `github-slugger` (ISC),
  `hast-util-from-html`, `@expressive-code/core`, `@expressive-code/plugin-line-numbers`,
  `@expressive-code/plugin-collapsible-sections`.

### Responsive design and accessibility

Responsive design and accessibility pass, checked in Chromium, Firefox and WebKit from 320px phones to 2560px
screens, at 200%/400% zoom and with a large default font.

- `InstallCommand` wraps between words on narrow screens instead of cutting the command off in a scroll box.
- Landing and gallery pages no longer load Starlight's base stylesheet (~64 KB): `<Live>` imports Expressive
  Code's `<Code>` directly (new internal virtual module `virtual:astro-project-site/code`).
- Small-screen site menu: closes when focus leaves it, announces `aria-expanded` immediately, and scrolls inside
  itself on short screens (phones in landscape) instead of running off the bottom.
- Touch screens (`pointer: coarse`): header links, menu buttons (Starlight's included), theme select, copy and
  Reset buttons, gallery filters and footer links are at least 44×44; the `<Live>` caption anchor is always visible
  where there is no hover.
- Wide tables and code blocks that scroll sideways get a keyboard tab stop with a focus ring (Safari has none).
- Forced colours (Windows high contrast): pressed gallery filters and the current nav item stay distinguishable.
- `prefers-contrast: more` moves `--site-muted` toward the text colour.
- Print: docs pages print without the site nav and footer links; editable `<Live>` examples print their code.
- Header and menu nav landmarks are labelled "Site" (Starlight's sidebar is "Main"), so docs pages no longer have
  two landmarks with the same name.
- Landing "how it works" code uses `github-light-default`/`github-dark-default` (comments meet AA contrast).
- `test/ux/ux-check.mjs`: a re-runnable responsive/UX check (README, Development).
- `base.css` no longer restyles docs pages: an MDX page importing `astro-project-site/components` pulled it in, and
  its unlayered `a { color }` beat Starlight (e.g. the sidebar's current-page link became unreadable). Its element
  rules are now scoped to BaseLayout's `<html data-site-page>` at element specificity.
- Component overrides are bundled only into pages that render them: the package imports each slot from its own
  virtual module (`virtual:astro-project-site/components/<Slot>`); docs pages no longer carry a `components.Landing`
  override and its CSS. The aggregate `virtual:astro-project-site/components` still exists.
- `<Live>` in iframe mode with `base`: no more failed module load and 404 in Firefox (its preloader ignores `<base>`
  in srcdoc documents; script and link URLs are resolved against `base` up front).
- Header: when the bar is too narrow for the nav (long project name, many items, search), the nav moves into the
  menu instead of squeezing the project name; when even that is too tight (a phone with a large default font) the
  version badge is hidden (the footer shows the version).
- Landing and gallery components carry their own shared classes (`styles/components.css`), so `Hero`, `Section`,
  `CallToAction`, the gallery and `InstallCommand` are styled inside docs pages too.
- The shared header on docs pages takes Search and ThemeSelect from Starlight's resolved components, so a search
  plugin that replaces Starlight's search is used (previously only `starlight.components.Search` was).
- Pages outside the docs take `lang`/`dir` from Starlight's root/default locale instead of always `en`.
- `externalDocs[].exclude` and docs-gen `files` globs support `{a,b}` and `[…]`: one glob implementation
  (`src/glob.mjs`) for them and mirrors.
- `starlight.title`, `description` and `favicon` log a warning (they change the docs only).
- Landing: no layout shift when the install Copy button and an editable `<Live>`'s toolbar appear.
- `<Live>`: a runner or module that cannot be fetched (404, server stopped) shows "Couldn't load the runner … Check
  the path, or that the site is still being served." with the browser's message under Details, and a Retry
  button (Reset too, when editable) that imports it again under a fresh URL (browsers cache failed imports).
- New option `head`: tags for the `<head>` of every page, docs included.
- New (additive): `getSource()`/`setSource(code)` on the `<live-example>` element (type `LiveExampleElement`);
  `OPTION_NAMES` and `COMPONENT_NAMES` from `astro-project-site` and `astro-project-site/config`; the
  `astro-project-site/live` export (`<Live>` without the components barrel).

## 0.1.0 (unreleased)

First release as a package. Previously a copy-and-edit template.

- `projectSite(options)` integration: sets up Starlight (docs pipeline, links validator, edit links), mirrors, the
  shared header/footer and theme, and injects `/`, `/gallery/`, `/llms.txt`, `/llms-full.txt`.
- Options validated with readable, per-field errors; `components` overrides; `starlight` passthrough; `landing: false`,
  `gallery: false`, `llms: false`; a project page at the same path replaces an injected one.
- `astro-project-site/components`, `/content`, `/config`, `/theme.css` exports; types for the virtual modules are
  injected so `astro check` passes.
- CLI `project-site`: `init`, `docs:gen`, `docs:check`, `deploy:preview`.
- Docs pages end with the shared site footer and get `og:image` from the same `ogImage`/`ogImageFor` hook.
- On small screens the site nav lives in Starlight's mobile menu (one menu button on docs pages).
- No more "i18n collection" and "Entry docs → 404" warnings; `<Live>` is styled on non-docs pages.
- Reusable GitHub workflow `deploy.yml` (check, build, preview per PR, production on tags).
