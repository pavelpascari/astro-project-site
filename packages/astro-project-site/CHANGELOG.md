# Changelog

## Unreleased

### Changed

- The header search is compact outside the docs. On the landing page, gallery, blog and your `BaseLayout` pages it
  is now a small button (a magnifier, with the ⌘K / Ctrl K hint on wide screens) next to the source link, instead of
  the wide search field, so the nav and the project name have the room and the nav moves into the menu less often.
  It is the same search: the button opens the same dialog, Ctrl/⌘ K works as before, and its accessible name is
  still "Search". Docs pages keep the full field, and phones are unchanged (the search was a button there already).
  For the full field everywhere, set `header: { search: 'full' }`.

### Added

- `header.search` option: `'compact'` (default) or `'full'`, how the search shows on pages outside the docs. A
  `components.Header` override receives it as the `search` prop (`'full'` on docs pages).

### Fixed

- Blog posts no longer show "Section titled …" as a visible link under each heading when `externalDocs` mounts a
  folder that contains them (for example the repository root, to show its README). Starlight adds its own heading
  links to every file under a mounted folder, and its styles for them aren't loaded outside the docs: that markup
  now gets the same look as the template's heading links (hidden label, link icon beside the heading).

## 0.1.0-beta.7 - 2026-11-21

### Fixed

- The docs menu on phones works in browsers without the Popover API (Safari and every iOS browser before 17,
  Firefox before 125, older Android browsers). Starlight's menu button relies on it, so there the button did nothing
  and the sidebar covered the page. A small inline script in the docs `<head>` now opens and closes the menu in
  those browsers (Escape and a tap outside close it; `aria-expanded` and the icons follow); where the API exists it
  does nothing.
- Small screens: the header's search button no longer slides under the docs menu button when the project name is
  long. The search keeps its width; the name is cut with an ellipsis instead, and the version badge goes first.

## 0.1.0-beta.6 - 2026-11-21

### Added

- `externalDocs` entries can mount a folder of another repository: `git: { repo, ref, path }` instead of `dir`.
  The build downloads only that folder at `ref` (a shallow, sparse fetch with the `git` command) into Astro's cache
  folder, then mounts it like a local one. A tag or commit is downloaded once and reused offline; a branch is
  fetched on every start, with a warning, falling back to the last copy. Links to files of that repository that
  are not mounted go to it at `ref`, and "Edit page" to its default branch. `GITHUB_TOKEN` (when set) reaches
  private github.com repositories; a repo URL with credentials in it is refused, and symlinks in the downloaded
  repository are checked out as plain files.

## 0.1.0-beta.5 - 2026-11-21

### Changed

- `init` no longer writes the GitHub workflow unless asked: `--ci` adds `.github/workflows/site.yml` (checks, a
  preview per pull request, production on tags). Without it a site deploys from your machine with
  `npm run deploy`, and `init`'s next steps say how to add CI later. The deploying guide covers both.

## 0.1.0-beta.4 - 2026-11-21

### Fixes

- The header and the phone menu mark one nav link as current, the most specific: with Docs (`/docs/`) and Guide
  (`/docs/guide/`) in the nav, a guide page highlighted both. New helper `activeHref(hrefs, pathname)`.
- Text taken from a README (`project-site init`'s tagline and step titles) decodes HTML entities once: `&amp;lt;`
  is now the text `&lt;`, not `<`.
- Mirror paths and globs trim slashes in linear time, and the blog's reading-time count strips tags in linear time
  (both regexes could take seconds on pathological input). Found by CodeQL, now enabled on this repository.

## 0.1.0-beta.3 - 2026-11-21

### Options

- `docsOrder`: the order of the top-level docs sections (mount routes and folders of `src/content/docs/docs/`) in
  the sidebar and in the docs cards on the docs index and the landing page. Listed sections come first; the rest
  keep the default order (mounts as configured, then local folders by name). An unknown name fails the build.

## 0.1.0-beta.2 - 2026-11-21

(0.1.0-beta.1 was never published: its tag was retired when the release moved to staged publishing.)

### Languages

- The template's own words (85 of them: buttons, screen-reader names, empty states, alert titles, the theme
  switch, reading time, dates, the default nav and section headings) follow the site's language, from Starlight's
  root locale. Built in: English, French, German, Spanish; any other language gets English until set.
- New option `labels`: set any of those words by name, in any language, with plural forms where something is
  counted (`{ one: '{n} page', other: '{n} pages' }`). Unknown names are a build error.
- Multilingual docs: a docs page in a second locale gets that locale's built-in words.
- Authors are joined the way the language does it ("Ada et Grace"), with `Intl.ListFormat`.
- Right to left: shell commands stay left to right; the theme switch, live-example buttons and link arrows
  mirror. Styles use logical properties only (a test keeps it that way).

### Options

- `landing.docs`: the heading and intro of the landing page's docs sections, or `false` to hide them. The
  heading was fixed to "Documentation".
- `gallery.route`: the gallery's URL path (default `gallery`); the nav, the landing page's link and the links
  validator follow it.
- `footer.copyright`: the copyright line (`{year}`, `{name}` filled in), or `false` for none. Default unchanged.
- `landing.features` no longer adds a default intro ("The short version, for people deciding whether to read
  on."): a default should not put words on a page the site never wrote.
- The footer's repository link is named after its host (GitHub, GitLab, Codeberg), like the header's, instead of
  "Source". One list of hosts now serves the header, the footer and Starlight.

### Accessibility

- Code blocks' copy buttons have an accessible name (they only had a tooltip) and `type="button"`.
- Docs pages with a sidebar render one small-screen menu, not two, so the site nav's landmarks have unique names.
- `<Live>` previews are a named `<section>` instead of `<div role="region">`.
- `SiteHeader` has a `menu` prop and `SiteFooter` a `navLabel` prop.
- A `theme.accent` that would make links, buttons, the current nav item or focus rings fall below WCAG 2.2 AA
  contrast is reported at build time, with the pair and the ratio.
- The repository now checks every built page with html-validate's accessibility rules, and the theme's colours
  against WCAG 2.2 AA in both themes.

### Fixes

- Section cards outside the docs (the landing page) list `externalDocs` mounts in the order they are configured,
  not alphabetically.
- `externalDocs[].description`: one sentence for the section's card on /docs/ and the landing page, and the meta
  description of its README page. Without it the card still guesses from the README's first paragraph, which can be
  a footer line when the README is mostly a table.
- Phones: the hero's install command fills the width, reads from the left and no longer runs under its Copy
  button; an unfilled hero `live` slot no longer leaves an empty band; hero and section spacing is tighter below 50rem.
- Docs: Starlight's mobile menu button matches the site header's (a plain icon in the bar, centred) instead of a
  floating white disc.
- `InstallCommand`: a word longer than the line (a URL or a `github:` spec) wraps inside itself instead of making
  the page scroll sideways on phones; shorter words still move to the next line whole.

- Peer dependency `astro` raised to `^7.4.7` (fixes GHSA-mh32-jxcr-mh9f and GHSA-r3h5-4585-7x3w in earlier 7.x), which
  needs Node.js 22.23.4 or newer (or Node 24); `engines.node` says so.

## 0.1.0-beta.0 - 2026-11-20

The first published release: on npm under the `beta` tag (`npx astro-project-site@beta init website`), and as a
tarball with its SHA-256 on the GitHub release. Everything below, from the package's first layout to the blog,
the repository-reading `init` and GitHub-flavoured markdown.

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

- Working-note folders inside `docs/` (`plans/`, `research/`, `internal/`, `drafts/`, `notes/`, `wip/`, `private/`,
  `scratch/`) are left out of the generated mount with `exclude`; delete the line to publish them.
- A mount root is titled by its `label` ("Reference", "Project") on overview and landing cards, not by its README's
  heading.
- A README code block with no sentence before it is titled from its code ("Run npx tool a, b and c", "Add it
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

- `mermaid` is an optional peer dependency (about 127 MB installed): `npm i mermaid` in the site to draw
  ```` ```mermaid ```` diagrams. Without it they show their source with a note, and the build warns once with the
  first file. `project-site init` adds it when the repository's markdown has a diagram.
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

### The package

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
