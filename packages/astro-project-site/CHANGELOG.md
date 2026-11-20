# Changelog

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
