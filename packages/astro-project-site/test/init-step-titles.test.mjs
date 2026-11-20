import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleFromCode, parseReadme } from '../src/detect/readme.mjs';

test('shell blocks sharing a tool become one "Run" title', () => {
  const code = 'npx pixel validate my.json   # errors\nnpx pixel preview  my.json --out a.png\nnpx pixel bundle   my.json --out b.json';
  assert.equal(titleFromCode(code, 'bash'), 'Run `npx pixel validate`, `preview` and `bundle`');
});

test('a single shell command keeps its first words; prompts and comments are dropped', () => {
  assert.equal(titleFromCode('$ cargo run --release  # go', 'sh'), 'Run `cargo run`');
  assert.equal(titleFromCode('# only a comment', 'sh'), undefined);
});

test('other languages get a short phrase, unknown ones nothing', () => {
  assert.equal(titleFromCode('<my-el></my-el>', 'html'), 'Add it to your page');
  assert.equal(titleFromCode('{}', 'json'), 'Configure it');
  assert.equal(titleFromCode('x = 1', 'python'), 'Use it in code');
  assert.equal(titleFromCode('???', 'brainfuck'), undefined);
});

test('a README step without a lead sentence is titled from its code, not "Step N"', () => {
  const md = '# Lib\n\nIntro.\n\n## Quick start\n\n```bash\nnpm i lib\n```\n\nWrite a config:\n\n```json\n{}\n```\n\n```bash\nnpx lib check a.json\nnpx lib build a.json\n```\n';
  const titles = parseReadme(md).steps.map((s) => s.title);
  assert.equal(titles.length, 3);
  assert.equal(titles[2], 'Run `npx lib check` and `build`');
  assert.ok(!titles.some((t) => /^Step \d/.test(t)));
});
