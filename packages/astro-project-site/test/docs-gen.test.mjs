import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { diff, docsGen, parseBlocks } from '../src/docs-gen.mjs';
import { fixture } from './helpers.mjs';

const CONFIG = `export default {
  files: ['docs', 'README.md'],
  generators: {
    upper: ({ args }) => String(args.text).toUpperCase(),
    rel: ({ relFile, root }) => relFile + ' ' + (typeof root),
    bad: () => 42,
    boom: () => { throw new Error('kaboom'); },
  },
};
`;

function project(/** @type {Record<string, string>} */ files) {
  return fixture({ 'docs-gen.config.mjs': CONFIG, 'README.md': 'no blocks\n', ...files });
}

test('fills stale blocks, idempotently', async () => {
  const dir = project({
    'docs/a.md': '# A\n<!-- gen:upper text="hello there" -->\nold\n<!-- /gen -->\nend\n',
    'README.md': 'no blocks\n',
  });
  const first = await docsGen({ cwd: dir });
  assert.equal(first.code, 0, first.stderr.join('\n'));
  assert.deepEqual(first.stdout, ['updated docs/a.md', 'docs-gen: updated 1 file(s).']);
  assert.equal(readFileSync(path.join(dir, 'docs/a.md'), 'utf8'), '# A\n<!-- gen:upper text="hello there" -->\nHELLO THERE\n<!-- /gen -->\nend\n');
  const second = await docsGen({ cwd: dir });
  assert.deepEqual(second.stdout, ['docs-gen: 2 file(s), nothing to update.']);
});

test('--check changes nothing and reports a diff', async () => {
  const dir = project({ 'docs/a.md': '<!-- gen:upper text=x -->\nold\n<!-- /gen -->\n' });
  const result = await docsGen({ cwd: dir, check: true });
  assert.equal(result.code, 1);
  assert.match(result.stderr.join('\n'), /docs\/a\.md:1: gen:upper is stale\n {2}\+ X\n {2}- old/);
  assert.match(result.stderr.join('\n'), /1 stale block\(s\)/);
  assert.equal(readFileSync(path.join(dir, 'docs/a.md'), 'utf8'), '<!-- gen:upper text=x -->\nold\n<!-- /gen -->\n');
  await docsGen({ cwd: dir });
  assert.equal((await docsGen({ cwd: dir, check: true })).code, 0);
});

test('markers inside fenced code are ignored', async () => {
  const dir = project({ 'docs/a.md': '```md\n<!-- gen:upper text=x -->\n<!-- /gen -->\n```\n' });
  const result = await docsGen({ cwd: dir, check: true });
  assert.equal(result.code, 0, result.stderr.join('\n'));
});

test('errors: unknown generator, wrong return type, throwing generator', async () => {
  const dir = project({
    'docs/a.md': '<!-- gen:nope -->\n<!-- /gen -->\n<!-- gen:bad -->\n<!-- /gen -->\n<!-- gen:boom -->\n<!-- /gen -->\n',
  });
  const result = await docsGen({ cwd: dir });
  assert.equal(result.code, 1);
  const text = result.stderr.join('\n');
  assert.match(text, /docs\/a\.md:1: unknown generator "gen:nope" \(known: upper, rel, bad, boom\)/);
  assert.match(text, /docs\/a\.md:3: gen:bad returned number, expected a string/);
  assert.match(text, /docs\/a\.md:5: gen:boom threw: Error: kaboom/);
});

test('errors: unclosed, nested and orphan markers', () => {
  /** @type {string[]} */
  const errors = [];
  assert.equal(parseBlocks('a.md', '<!-- gen:x -->\ntext', errors), undefined);
  assert.equal(parseBlocks('b.md', '<!-- gen:x -->\n<!-- gen:y -->\n<!-- /gen -->', errors), undefined);
  assert.equal(parseBlocks('c.md', 'text\n<!-- /gen -->', errors), undefined);
  assert.deepEqual(errors, [
    'a.md:1: gen:x is never closed with <!-- /gen -->',
    'b.md:2: gen:y opened inside gen:x (line 1); blocks cannot nest',
    'c.md:2: <!-- /gen --> without an opening <!-- gen:name -->',
  ]);
  assert.deepEqual(parseBlocks('d.md', '<!-- gen:x a=1 b="two words" c=\'q\' -->\n<!-- /gen -->', errors), [
    { name: 'x', args: { a: '1', b: 'two words', c: 'q' }, start: 0, end: 1 },
  ]);
});

test('a missing config or listed file fails cleanly', async () => {
  const empty = fixture({});
  const result = await docsGen({ cwd: empty });
  assert.equal(result.code, 1);
  assert.match(result.stderr[0], /config not found/);
  const missing = fixture({ 'docs-gen.config.mjs': "export default { files: ['nope'], generators: {} };" });
  assert.match((await docsGen({ cwd: missing })).stderr[0], /listed in config but missing: nope/);
});

test('diff shows two lines of context around changes', () => {
  assert.equal(diff('a\nb\nc\nd\ne\nf\ng', 'a\nB\nc\nd\ne\nf\ng'), '    a\n  + B\n  - b\n    c\n    d\n    ...');
});
