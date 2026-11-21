# astro-project-site

[![npm (beta)](https://img.shields.io/npm/v/astro-project-site/beta?label=npm%40beta)](https://www.npmjs.com/package/astro-project-site)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue)](LICENSE)

A whole website for an open-source library or framework, as one Astro integration: a landing page, Starlight docs
that mount the project's own markdown folder, live examples, a gallery, a blog, static apps served as they are, and
Cloudflare deploys with a preview per pull request. Built on Astro 7 and Starlight 0.43.

> **Status: beta.** The package is published under the npm `beta` tag. Options and exports may still change
> between beta releases; every change is listed in the [changelog](packages/astro-project-site/CHANGELOG.md).

## Get started

Run it inside the repository of the project you want a site for:

```bash
npx astro-project-site@beta init website
cd website && npm install && npm run dev
```

`init` reads the repository (README, `package.json` or other manifests, docs folder, licence, demo pages), shows what
it found and what it will write, asks, and then writes a complete site into `website/` that builds as it is: the
config, a landing page, your docs mounted under `/docs/`, a gallery, and a GitHub Actions workflow for Cloudflare
deploys. Anything it could not work out is marked `TODO`; `--dry-run` shows the plan without writing. In an empty
folder you get the plain starter. Requires Node.js 22.23.4 or newer (or Node 24).

## Documentation

- **Site and docs:** [astro-project-site.workers.dev](https://astro-project-site.workers.dev/docs/), built with
  astro-project-site itself from [`site/`](site/).
- **Package reference** (options, exports, CLI, deploys and CI):
  [packages/astro-project-site/README.md](packages/astro-project-site/README.md).
- **npm:** [astro-project-site](https://www.npmjs.com/package/astro-project-site).
- **Releases and changelog:** [GitHub releases](https://github.com/pavelpascari/astro-project-site/releases) (each
  with the npm tarball and its SHA-256) and the [changelog](packages/astro-project-site/CHANGELOG.md).

## Options

Every option of the integration is documented in the package README, under
[Options](packages/astro-project-site/README.md#options).

## This repository

npm workspaces:

| folder | what |
|---|---|
| `packages/astro-project-site/` | the package: integration, components, content helpers, theme, CLI, tests |
| `site/` | the template's own website, consuming the package like any project |
| `starters/default/` | the minimal project `project-site init` copies; also built in CI |
| `.github/workflows/` | `deploy.yml`, the reusable workflow projects call; `ci.yml`, this repo's CI; `release.yml` |

```bash
npm ci
npm test             # unit tests (node --test)
npm run build        # package type check, then site/ and starters/default/ (astro check, build, docs:check)
npm run test:a11y    # accessibility checks on what was just built
npm run test:i18n    # the site built in French and in Arabic (right to left), checked
npm run dev          # site/ at http://localhost:4321
```

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md).
Report security problems privately, as described in [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE) © Pavel Pascari.

Every runtime dependency of the package is MIT, ISC or BSD licensed. The build tools that Astro and Vite pull in
include two with other licences, neither of which ends up in a built site: Lightning CSS (MPL-2.0) and libvips via
sharp (LGPL-3.0). Mermaid, an optional peer dependency, pulls in elkjs (EPL-2.0 or GPL-3.0).
