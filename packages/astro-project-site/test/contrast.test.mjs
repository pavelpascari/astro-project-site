import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { accentWarnings, contrast, mixOklab, parseColor, THEME, themePairs } from '../src/contrast.mjs';

/** A colour that must parse. */
const rgb = (/** @type {string} */ s) => /** @type {[number, number, number]} */ (parseColor(s));

const css = readFileSync(path.resolve(import.meta.dirname, '../src/styles/theme.css'), 'utf8');

test('colour maths: parsing, WCAG ratios, oklab mixing', () => {
  assert.deepEqual(parseColor('#fff'), [1, 1, 1]);
  assert.deepEqual(parseColor('rgb(255 0 0)'), [1, 0, 0]);
  assert.deepEqual(parseColor('hsl(0, 0%, 0%)'), [0, 0, 0]);
  assert.equal(parseColor('rebeccapurple'), undefined);
  assert.equal(contrast([1, 1, 1], [0, 0, 0]).toFixed(1), '21.0');
  assert.equal(contrast(rgb('#777'), [1, 1, 1]).toFixed(2), '4.48');
  // color-mix(in oklab, white 50%, black) is #636363 in browsers.
  const grey = mixOklab([1, 1, 1], 0.5, [0, 0, 0]).map((c) => Math.round(c * 255));
  assert.deepEqual(grey, [99, 99, 99]);
});

test('THEME matches the brand tokens in theme.css', () => {
  const block = (/** @type {RegExp} */ start) => css.slice(css.search(start), css.indexOf('}', css.search(start)));
  const read = (/** @type {string} */ text) =>
    Object.fromEntries([...text.matchAll(/--site-(accent|bg|surface|text|muted|code-bg|code-text):\s*(#[0-9a-f]+)/gi)].map((m) => [m[1].replace(/-(\w)/, (_, c) => c.toUpperCase()), m[2]]));
  assert.deepEqual(read(block(/\/\* Dark theme/)), { ...THEME.dark });
  assert.deepEqual(read(block(/^:root\[data-theme='light'\] \{\n  --site-accent/m)), { ...THEME.light });
});

for (const mode of /** @type {const} */ (['dark', 'light'])) {
  test(`the ${mode} theme meets WCAG 2.2 AA for every pair`, () => {
    const failing = themePairs(THEME[mode]).filter((p) => p.ratio < p.min).map((p) => `${p.name}: ${p.ratio.toFixed(2)}:1 < ${p.min}:1`);
    assert.deepEqual(failing, []);
  });
}

test('"Increase contrast" raises secondary text to at least 7:1 (AAA) in both themes', () => {
  assert.match(css, /@media \(prefers-contrast: more\)[^}]*--site-muted: color-mix\(in oklab, var\(--site-text\) 82%, var\(--site-bg\)\)/);
  for (const t of Object.values(THEME)) {
    const muted = mixOklab(rgb(t.text), 0.82, rgb(t.bg));
    assert.ok(contrast(muted, rgb(t.bg)) >= 7, `${contrast(muted, rgb(t.bg)).toFixed(2)}:1`);
  }
});

test('a faint theme.accent is reported; a good one, or one we cannot parse, is not', () => {
  assert.deepEqual(accentWarnings({}), []);
  assert.deepEqual(accentWarnings({ accent: '#3b4fd8' }).filter((w) => w.includes('light')), []);
  assert.deepEqual(accentWarnings({ accent: 'oklch(60% 0.2 250)' }), []);
  const yellow = accentWarnings({ accent: '#ffe066' });
  assert.ok(yellow.some((w) => /light theme: primary button text|light theme: focus ring/.test(w)), yellow.join('\n'));
  assert.ok(accentWarnings({ accent: '#3b4fd8', accentDark: '#1a237e' }).some((w) => w.startsWith('theme.accentDark #1a237e in the dark theme')));
});
