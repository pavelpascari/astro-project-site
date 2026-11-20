# Changelog

## Unreleased

Responsive design and accessibility pass, checked in Chromium, Firefox and WebKit from 320px phones to 2560px
screens, at 200%/400% zoom and with a large default font.

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
