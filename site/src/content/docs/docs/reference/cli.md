---
title: CLI
description: The project-site command - init, docs:gen, docs:check, deploy:preview.
sidebar:
  order: 5
---

The package's only bin is `project-site`. In a project it is on the npm scripts' `PATH`; elsewhere run it with
`npx astro-project-site <command>` (npx picks the package's single bin).

<!-- gen:cli -->
```text
Usage: project-site <command> [options]

Commands:
  init [dir]          Create a new project site from the starter (default dir: .)
      --name <name>       Project name shown on the site (default: from the folder name)
      --package <spec>    Version spec for the astro-project-site dependency (default: ^<this version>)
      --force             Overwrite files that already exist
  docs:gen            Fill <!-- gen:... --> blocks in markdown (reads ./docs-gen.config.mjs)
      --check             Change nothing; exit 1 with a diff when a block is stale
      --config <file>     Another config file
  docs:check          Same as docs:gen --check
  deploy:preview      Upload dist/ to Cloudflare as a preview version (uses the project's wrangler)
      --alias <name>      Preview alias (default: the git branch)
      --message <text>    Version message
      --dry-run           Validate without uploading
```
<!-- /gen -->

## init

Copies the starter into `dir` (default `.`) and names it:

- `package.json` → `name` is the slug of `--name` or the folder; the `astro-project-site` dependency becomes
  `--package` (default `^<version of the CLI>`).
- `wrangler.jsonc` → the first `"name"` becomes the slug.
- `astro.config.mjs` → `name: '…'` becomes `--name` or the folder name in title case (`my-lib` → "My Lib").
- `.github/workflows/site.yml` → the reusable workflow is pinned to `@v<version of the CLI>`.
- `_gitignore` is written as `.gitignore`. `node_modules`, `dist`, `.astro`, `.wrangler` and `package-lock.json`
  are never copied.

If any starter file already exists in the target, it lists them and writes nothing (exit 1) unless you pass
`--force`, which overwrites them. Other files in the folder are left alone.

## docs:gen and docs:check

Reads `docs-gen.config.mjs` from the current folder (or `--config`), fills every
`<!-- gen:name key=value -->` … `<!-- /gen -->` block. `docs:check` (= `docs:gen --check`) writes nothing and
exits 1 with a diff when a block is stale. Errors (exit 1): an unknown generator, an unclosed or nested block,
a generator that throws or returns a non-string, a listed path that does not exist.
See [Docs generation](/docs/guides/docs-generation/).

## deploy:preview

Run from the project root after `npm run build`. It:

1. reads the Worker name from `wrangler.jsonc` (or `wrangler.json`);
2. makes the alias from `--alias`, else `$PREVIEW_ALIAS`, else the current git branch: lowercased, non
   `[a-z0-9]` runs become `-`, prefixed with `b-` if it does not start with a letter, cut so that
   `<alias>-<worker>` fits in 63 characters;
3. runs the **project's own** wrangler (`node_modules/wrangler`; it fails if there is none, it never downloads
   one): `wrangler versions upload --preview-alias <alias> [--message …] [--dry-run] [extra args]`;
4. prints the alias URL and, inside GitHub Actions, writes `url`, `alias`, `version_url`, `version_id` to
   `$GITHUB_OUTPUT`.

It fails when `dist/` is missing, or when the upload has no preview URL (`preview_urls` off, or no workers.dev
subdomain). Arguments after `--` go to wrangler.
