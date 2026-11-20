#!/usr/bin/env node
// project-site: the astro-project-site command line. Zero dependencies.
//
//   project-site init [dir] [--name "My Project"] [--force] [--package <npm spec>]
//   project-site docs:gen [--check] [--config docs-gen.config.mjs]
//   project-site docs:check [--config docs-gen.config.mjs]
//   project-site deploy:preview [--alias pr-12] [--message "..."] [--dry-run] [-- <wrangler args>]
import { parseArgs } from 'node:util';
import { init } from '../src/init.mjs';

const HELP = `Usage: project-site <command> [options]

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
`;

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case 'init': {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { name: { type: 'string' }, package: { type: 'string' }, force: { type: 'boolean', default: false } },
      allowPositionals: true,
    });
    process.exitCode = await init({ dir: positionals[0] ?? '.', name: values.name, packageSpec: values.package, force: values.force });
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
