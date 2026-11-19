// Uploads dist/ as a new Worker version (not deployed to production) under a stable preview alias, and prints its URL.
//
//   node scripts/deploy-preview.mjs [--alias pr-12] [--message "..."] [--dry-run] [-- <extra wrangler args>]
//
// The alias defaults to the current git branch. The same alias always maps to the same URL,
// https://<alias>-<worker-name>.<your-subdomain>.workers.dev, and each upload moves it to the newest version.
// In GitHub Actions the results are also written to $GITHUB_OUTPUT as `url`, `alias`, `version_url`, `version_id`.
import { spawnSync, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  options: {
    alias: { type: 'string' },
    message: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

const workerName = readWorkerName();
const alias = toAlias(values.alias ?? process.env.PREVIEW_ALIAS ?? currentBranch(), workerName);
if (!existsSync('dist')) fail('dist/ not found: run `npm run build` first.');

const outDir = mkdtempSync(join(tmpdir(), 'wrangler-out-'));
const outFile = join(outDir, 'output.ndjson');
const wrangler = join(dirname(createRequire(import.meta.url).resolve('wrangler/package.json')), 'bin', 'wrangler.js');
const args = ['versions', 'upload', '--preview-alias', alias];
if (values.message) args.push('--message', values.message.slice(0, 100));
if (values['dry-run']) args.push('--dry-run');
args.push(...positionals);

console.log(`Uploading a preview version of "${workerName}" with alias "${alias}"…`);
const run = spawnSync(process.execPath, [wrangler, ...args], {
  stdio: 'inherit',
  env: { ...process.env, WRANGLER_OUTPUT_FILE_PATH: outFile },
});
if (run.status !== 0) fail(`wrangler exited with ${run.status ?? run.signal}.`);
if (values['dry-run']) process.exit(0);

const entries = existsSync(outFile)
  ? readFileSync(outFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
  : [];
rmSync(outDir, { recursive: true, force: true });
const upload = entries.findLast((e) => e.type === 'version-upload');
if (!upload) fail('wrangler did not report a version upload.');
const url = upload.preview_alias_url ?? upload.preview_url;
if (!url) {
  fail(
    'The version was uploaded but has no preview URL. Check that `preview_urls` is true in wrangler.jsonc ' +
      'and that the workers.dev subdomain is enabled for the account.',
  );
}

console.log(`\nPreview: ${url}`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `url=${url}\nalias=${alias}\nversion_url=${upload.preview_url ?? ''}\nversion_id=${upload.version_id ?? ''}\n`,
  );
}

/** Reads the top-level `name` from wrangler.jsonc (the first "name" key; comments are skipped). */
function readWorkerName() {
  const file = ['wrangler.jsonc', 'wrangler.json'].find((f) => existsSync(f));
  if (!file) fail('wrangler.jsonc not found: run this from the site root.');
  const text = readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const match = text.match(/"name"\s*:\s*"([^"]+)"/);
  if (!match) fail(`No "name" in ${file}.`);
  return match[1];
}

function currentBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    fail('Not a git checkout: pass --alias <name>.');
  }
}

/** Aliases become part of a DNS label: lowercase letters, digits, dashes; `<alias>-<worker>` must fit in 63 chars. */
function toAlias(raw, worker) {
  let slug = String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!/^[a-z]/.test(slug)) slug = `b-${slug}`;
  slug = slug.slice(0, Math.max(1, 62 - worker.length)).replace(/-+$/, '');
  if (!slug) fail(`Cannot make a preview alias from "${raw}".`);
  return slug;
}

function fail(message) {
  console.error(`deploy-preview: ${message}`);
  process.exit(1);
}
