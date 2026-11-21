// The landing page's config preview (site/public/landing-assets/runners/config-preview.js) checks options in the
// browser with its own copy of the option names, since it cannot load options.mjs (zod). These tests keep that copy
// in step with the package and make sure the site's own config passes it: a stale list once made the preview show
// `unknown option "blog"` instead of the site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPONENT_NAMES, OPTION_NAMES } from '../packages/astro-project-site/src/options.mjs';
import { COMPONENTS, KNOWN, extract, validate } from '../site/public/landing-assets/runners/config-preview.js';
import docs from '../site/docs.config.mjs';

test('config preview knows every option and component override of the package', () => {
  assert.deepEqual([...KNOWN].sort(), [...OPTION_NAMES].sort());
  assert.deepEqual([...COMPONENTS].sort(), [...COMPONENT_NAMES].sort());
});

test("config preview accepts the site's own astro.config.mjs", () => {
  const source = readFileSync(new URL('../site/astro.config.mjs', import.meta.url), 'utf8');
  const { value, spreads } = extract(source);
  for (const s of spreads) Object.assign(s.into, { ...docs, ...s.into });
  assert.doesNotThrow(() => validate(value));
});


test('config preview takes an externalDocs entry with `dir` or `git`, not both or neither', () => {
  const base = { name: 'N', tagline: 't', url: 'https://n.dev', repo: 'https://github.com/o/n' };
  const docs = (/** @type {object} */ entry) => ({ ...base, externalDocs: [{ route: 'r', label: 'R', ...entry }] });
  assert.doesNotThrow(() => validate(docs({ dir: '../docs' })));
  assert.doesNotThrow(() => validate(docs({ git: { repo: 'https://github.com/o/lib', ref: 'v1', path: 'docs' } })));
  assert.throws(() => validate(docs({})), /externalDocs\[0\]: give either `dir`/);
  assert.throws(() => validate(docs({ dir: 'd', git: { repo: 'https://h/r', ref: 'v1' } })), /not both/);
});
