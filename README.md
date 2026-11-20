# astro-project-site

A site for an open-source library or framework, as one Astro integration: a landing page, Starlight docs that mount
the project's own markdown folder, live examples, a gallery, static apps served as they are, and Cloudflare deploys
with a preview per pull request. Astro 7 + Starlight 0.43, MIT.

```bash
npx astro-project-site init my-site
cd my-site && npm install && npm run dev
```

The package's documentation (options, exports, CLI, CI): [packages/astro-project-site/README.md](packages/astro-project-site/README.md).

## This repository

npm workspaces:

| folder | what |
|---|---|
| `packages/astro-project-site/` | the package: integration, components, content helpers, theme, CLI, tests |
| `site/` | the template's own website, consuming the package like any project |
| `starters/default/` | the minimal project `project-site init` copies; also built in CI |
| `.github/workflows/` | `deploy.yml`, the reusable workflow projects call; `ci.yml`, this repo's CI |

```bash
npm install
npm test             # node --test: options, docs-gen, link rewriting and mounts, mirrors, init
npm run build        # package type check, then site/ and starters/default/ (astro check, build, docs:check)
npm run dev          # site/ at http://localhost:4321
npm run dev:starter  # the starter
```

## Licences

Every dependency is free software (MIT, ISC, BSD, Apache-2.0 or similar), except two build-time tools pulled in by
Astro and Vite, neither of which ends up in the built site: Lightning CSS (MPL-2.0) and libvips via sharp
(LGPL-3.0).
