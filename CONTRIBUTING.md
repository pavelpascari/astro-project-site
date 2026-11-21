# Contributing to astro-project-site

Thanks for helping. astro-project-site is maintained by one person, so small, focused changes with a clear reason
are the easiest to review and merge. For anything larger than a fix (a new option, component or CLI command), open
an issue first so we can agree on the shape before you write it.

Security problems: please do not open an issue or a pull request; see [SECURITY.md](SECURITY.md).

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).

## Repository layout

npm workspaces:

| folder | what |
|---|---|
| `packages/astro-project-site/` | the published package: integration, components, content helpers, theme, CLI, tests |
| `site/` | the template's own website, consuming the package like any project |
| `starters/default/` | the minimal project `project-site init` copies (packed into the package as `starter/`) |
| `.github/workflows/` | `deploy.yml`, the reusable workflow projects call; `ci.yml`; `release.yml` |
| `scripts/` | repository scripts such as `release-prepare.mjs` |

## Development setup

You need Node.js 22.23.4 or newer (Astro 7.4 requires it; CI and releases use Node 24) and npm.

```bash
git clone https://github.com/pavelpascari/astro-project-site.git
cd astro-project-site
npm ci
```

Day to day:

```bash
npm test             # node --test: the package's unit tests and the repository scripts' tests
npm run build        # package type check, then site/ and starters/default/ (astro check, astro build, docs:check)
npm run docs:check   # the docs link and structure check on its own, for site/ and the starter
npm run dev          # site/ at http://localhost:4321
npm run dev:starter  # the starter
npm run test:a11y    # accessibility checks on the built site/ and starter (after npm run build)
npm run test:i18n    # builds the i18n fixture in French and Arabic (right to left) and checks both
```

Before opening a pull request, `npm test`, `npm run build`, `npm run test:a11y` and `npm run test:i18n` must pass;
CI runs the same. A word that shows on a page belongs in `packages/astro-project-site/src/labels.mjs` (with its
French, German and Spanish), not in a component: a test fails on English written into a template.

### The UX harness

Changes to layout, components, styles or anything visible should also pass the responsive/UX check. It drives
Chromium, Firefox and WebKit through Playwright against a running site. Playwright is deliberately not a
dependency of this repository, so install it somewhere else once:

```bash
mkdir -p /tmp/pw && (cd /tmp/pw && npm i playwright && npx playwright install chromium firefox webkit)

npm run build && (cd site && npx astro preview --port 4433 &)
PLAYWRIGHT_DIR=/tmp/pw node packages/astro-project-site/test/ux/ux-check.mjs --url http://localhost:4433 --out ux-report
```

`--quick` runs Chromium only at four viewports. The report lands in `ux-report/` (git-ignored); it exits 1 on any
error-level finding. What it checks is described in the package README, under
[Development](packages/astro-project-site/README.md#development).

## Pull requests

- Keep each pull request to one change. Add or update tests in `packages/astro-project-site/test/` for behaviour
  changes.
- Update the docs that describe what you changed: the package README, the pages in `site/src/content/docs/`, and
  the starter if it is affected.
- Add a line under `## Unreleased` in [packages/astro-project-site/CHANGELOG.md](packages/astro-project-site/CHANGELOG.md)
  for anything a user of the package would notice (see below).
- Fill in the pull request template's checklist.

### Commit signing

Commits on `main` are expected to be signed (GPG or SSH, showing as "Verified" on GitHub), and release tags must be
signed. Please sign the commits in your pull request; see GitHub's guide on
[signing commits](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits).

### Changelog

`packages/astro-project-site/CHANGELOG.md` is written by hand, for people upgrading the package. Each release has
one section, `## <version> - <date>`, grouped by topic, saying what changed and what (if anything) a project has to
do. Between releases, notes collect under `## Unreleased`. The GitHub release notes are this section, copied as it
is, so write it to be read on its own.

## Releases

Releases are cut by hand by the maintainer:

1. `npm run release:prepare -- <version>` (for example `0.1.0-beta.1`). It sets the package version, the
   workspace dependency ranges and every `deploy.yml@v…` pin, moves the `## Unreleased` notes under
   `## <version> - <date>`, and refreshes the lockfile. It commits nothing. `--dry-run` shows what it would do.
2. Review `git diff`, then commit it signed: `git commit -S -m "Release <version>"`.
3. Tag it signed: `git tag -s v<version> -m "v<version>"`.
4. Push the commit and the tag: `git push origin main v<version>`.

The tag runs [`.github/workflows/release.yml`](.github/workflows/release.yml): it checks the tag against the package
version, runs the tests and the build, packs the package, creates the GitHub release (a pre-release for versions
with a `-`) with the tarball, its SHA-256 and the changelog section, and publishes the same tarball to npm with
[trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC, no stored token): `--tag beta` for
pre-releases, `latest` otherwise.

## Licence of contributions

astro-project-site is [MIT licensed](LICENSE). By contributing, you agree that your contribution is licensed under
the same MIT licence (inbound = outbound), and that you have the right to submit it under that licence. Do not add
code, images, fonts or other assets you did not create unless their licence is compatible with MIT, and say where
they come from in the pull request.
