#!/usr/bin/env node
// project-site: the astro-project-site command line. Zero dependencies.
//
//   project-site init [dir] [--from <repo>] [--yes] [--dry-run] [--force] [--blank] [--name "My Project"] [--package <npm spec>]
//   project-site docs:gen [--check] [--config docs-gen.config.mjs]
//   project-site docs:check [--config docs-gen.config.mjs]
//   project-site deploy:preview [--alias pr-12] [--message "..."] [--dry-run] [-- <wrangler args>]
import { parseArgs } from 'node:util';
import { init } from '../src/init.mjs';

const HELP = `Usage: project-site <command> [options]

Commands:
  init [dir]          Create a project site in dir (default: .) from the repository it is for: landing page
                      from the README, its markdown as docs, demo pages in a gallery, a blog with a draft post
      --from <dir>        Repository to read (default: dir's parent inside a git repo, else the current folder)
      --yes, -y           Write without asking (needed when not run in a terminal)
      --dry-run           Print what was found and what would be written; write nothing
      --force             Overwrite files that already exist
      --blank             Copy the plain starter instead (placeholders and example docs, no detection)
      --name <name>       Project name shown on the site (default: README title, manifest or folder name)
      --package <spec>    Version spec for the astro-project-site dependency (default: ^<this version>)
  docs:gen            Fill <!-- gen:... --> blocks in markdown (reads ./docs-gen.config.mjs)
      --check             Change nothing; exit 1 with a diff when a block is stale
      --config <file>     Another config file
  docs:check          Same as docs:gen --check
  deploy:preview      Upload dist/ to Cloudflare as a preview version (uses the project's wrangler)
      --alias <name>      Preview alias (default: the git branch)
      --message <text>    Version message
      --dry-run           Validate without uploading
`;

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case 'init': {
    const { values, positionals } = parseArgs({
      args: rest,
      options: {
        name: { type: 'string' },
        package: { type: 'string' },
        from: { type: 'string' },
        force: { type: 'boolean', default: false },
        yes: { type: 'boolean', short: 'y', default: false },
        'dry-run': { type: 'boolean', default: false },
        blank: { type: 'boolean', default: false },
      },
      allowPositionals: true,
    });
    if (positionals.length > 1) {
      console.error(`project-site init: one folder only (got ${positionals.join(', ')}).\n\n${HELP}`);
      process.exitCode = 1;
      break;
    }
    process.exitCode = await init({
      dir: positionals[0] ?? '.',
      from: values.from,
      name: values.name,
      packageSpec: values.package,
      force: values.force,
      yes: values.yes,
      dryRun: values['dry-run'],
      blank: values.blank,
    });
    break;
  }
  case 'docs:gen':
  case 'docs:check': {
    const { values } = parseArgs({
      args: rest,
      options: { check: { type: 'boolean', default: command === 'docs:check' }, config: { type: 'string' } },
    });
    const { docsGen } = await import('../src/docs-gen.mjs');
    const result = await docsGen({ check: values.check, config: values.config });
    for (const line of result.stdout) console.log(line);
    for (const line of result.stderr) console.error(line);
    process.exitCode = result.code;
    break;
  }
  case 'deploy:preview': {
    const { deployPreview } = await import('../src/deploy-preview.mjs');
    deployPreview(rest);
    break;
  }
  case undefined:
  case '-h':
  case '--help':
  case 'help':
    console.log(HELP);
    break;
  default:
    console.error(`project-site: unknown command "${command}"\n\n${HELP}`);
    process.exitCode = 1;
}
