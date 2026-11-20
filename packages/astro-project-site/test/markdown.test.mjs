// The markdown plugins (src/markdown/) run through Sätteri, Astro's markdown processor, on a GitHub-style sample
// (test/fixtures/markdown-gfm.md). Expectations follow what GitHub renders for the same file
// (`gh api -X POST /markdown -f mode=gfm`): the same features, not the same HTML.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { markdownToHtml, mdxToJs } from 'satteri';
import { commandsToCopy, expressiveCodeConfig, jsonSafe, LANG_ALIAS } from '../src/markdown/expressive-code.mjs';
import { katexAssets, starlightDirs } from '../src/markdown/index.mjs';
import { markdownPlugins, replaceShortcodes } from '../src/markdown/plugins.mjs';
import { parseOptions } from '../src/options.mjs';
import { fixture } from './helpers.mjs';

const sample = readFileSync(path.join(import.meta.dirname, 'fixtures/markdown-gfm.md'), 'utf8');
const all = { alerts: true, emoji: true, math: true, mermaid: true, headingLinks: true };

/** Renders like Astro does: our `first` plugins at the front, the rest after (Expressive Code is not involved). */
async function render(source = sample, { features = all, starlight = false, mdx = false } = {}) {
  const { first, rest } = markdownPlugins({ features, katexCss: '/_project-site/katex/katex.min.css', isStarlightFile: () => starlight });
  const opts = {
    features: { gfm: true, math: true },
    hastPlugins: [...first, ...rest],
    fileURL: new URL(`file:///site/src/content/blog/post.${mdx ? 'mdx' : 'md'}`),
  };
  return mdx ? (await mdxToJs(source, opts)).code : (await markdownToHtml(source, opts)).html;
}

test('GFM basics render as on GitHub', async () => {
  const html = await render();
  assert.match(html, /<del>strike<\/del>/);
  assert.match(html, /<a href="http:\/\/www\.example\.com">/);
  assert.match(html, /<a href="https:\/\/example\.com\/a\?b=1">https:\/\/example\.com\/a\?b=1<\/a>\./, 'trailing dot is not part of the URL');
  assert.match(html, /<a href="mailto:me@example\.com">/);
  assert.match(html, /<sub>2<\/sub>.*<sup>2<\/sup>.*<kbd>Ctrl<\/kbd>/s);
  assert.equal((html.match(/class="task-list-item"/g) ?? []).length, 2);
  assert.match(html, /<input type="checkbox" checked disabled aria-label="done">/);
  assert.match(html, /<input type="checkbox" disabled aria-label="todo">/);
  assert.match(html, /<th style="text-align: center">Centre<\/th>/);
  assert.match(html, /<table class="md-table">/);
  assert.match(html, /<details>\s*<summary>More<\/summary>\s*<p>Inner <strong>markdown<\/strong>/);
});

test('emoji shortcodes: GitHub names in text, never in code, unknown names kept', async () => {
  const html = await render();
  assert.match(html, /<code>code :tada:<\/code> 🎉 :not_an_emoji:/);
  assert.equal(replaceShortcodes(':+1: :ROCKET: 12:30:00'), '👍 🚀 12:30:00');
});

test('alerts: the five types, GitHub marker rules', async () => {
  const html = await render();
  assert.match(html, /<aside class="md-alert md-alert--note" aria-label="Note">.*?<\/svg>Note<\/p><div class="md-alert__content"><p>A note with <em>emphasis<\/em>\.<\/p>/s);
  assert.match(html, /md-alert--caution.*?<p>Lower-case marker, body in its own paragraph\.<\/p>/s);
  // Marker not alone on its line: a blockquote, as on GitHub. Plain quotes stay quotes.
  assert.match(html, /<blockquote>\s*<p>\[!WARNING\] not alone on its line/);
  assert.match(html, /<blockquote>\s*<p>A plain quote\.<\/p>/);
  assert.equal((html.match(/md-alert--/g) ?? []).length, 2);
});

test('footnotes: numbered refs, back-links and a visible label', async () => {
  const html = await render();
  assert.match(html, /<sup><a href="#user-content-fn-1" id="user-content-fnref-1" data-footnote-ref/);
  assert.match(html, /<h2 class="md-footnotes__label" id="footnote-label">Footnotes<\/h2>/);
  assert.match(html, /href="#user-content-fnref-note"[^>]*data-footnote-backref/);
});

test('math: KaTeX HTML + MathML for $…$, $$…$$ and ```math, with the stylesheet linked once', async () => {
  const html = await render();
  assert.equal((html.match(/<span class="katex">/g) ?? []).length, 3);
  assert.equal((html.match(/<math /g) ?? []).length, 3);
  assert.equal((html.match(/class="md-math md-math--display"/g) ?? []).length, 2);
  assert.ok(html.startsWith('<link rel="stylesheet" href="/_project-site/katex/katex.min.css">'));
  assert.equal((html.match(/katex\.min\.css/g) ?? []).length, 1);
  // No math, no stylesheet.
  // Prices are not math (Pandoc's and GitHub's rule: no space inside the dollars, no digit right after the closing one).
  const prices = await render('# Plain\n\nNo math here, $5 and $6, or $ 7$.');
  assert.doesNotMatch(prices, /katex/);
  assert.match(prices, /No math here, \$5 and \$6, or \$ 7\$\./);
  assert.match(await render('Costs $x$5 here.'), /Costs \$x\$5 here\./);
});

test('mermaid: a figure with the source, outside Expressive Code’s reach (no <code>)', async () => {
  const html = await render();
  assert.match(html, /<figure class="md-mermaid" data-mermaid=""><pre class="md-mermaid__source">graph TD; A--&gt;B<\/pre><\/figure>/);
  // Other code blocks are left for Expressive Code.
  assert.match(html, /<pre><code class="language-js">const a = 1;/);
});

test('headings: github-slugger ids, anchor links outside Starlight only', async () => {
  const html = await render();
  assert.match(html, /<h2 id="emphasis--links">/, 'same slug as GitHub (& dropped, spaces kept as dashes)');
  assert.match(html, /<h2 id="repeated-heading">.*<h2 id="repeated-heading-1">/s);
  assert.match(html, /<div class="md-heading md-heading--h2"><h2 id="table">Table<\/h2><a class="md-heading__anchor" href="#table">/);
  assert.doesNotMatch(html, /<a class="md-heading__anchor" href="#gfm-sample"/, 'no anchor on the h1');
  const docs = await render(sample, { starlight: true });
  assert.doesNotMatch(docs, /md-heading/, 'Starlight adds its own in its folders');
});

test('switches turn features off', async () => {
  const off = { alerts: false, emoji: false, math: false, mermaid: false, headingLinks: false };
  const html = await render(sample, { features: off });
  for (const marker of ['md-alert', '🎉', 'katex', 'md-mermaid', 'md-heading']) assert.ok(!html.includes(marker), marker);
});

test('MDX: the same plugins compile to JSX (KaTeX as elements, not raw HTML)', async () => {
  const code = await render('> [!TIP]\n> Hi :tada:\n\nInline $\\frac{1}{2}$.\n\n```mermaid\ngraph LR; a-->b\n```\n', { mdx: true });
  assert.match(code, /md-alert md-alert--tip/);
  assert.match(code, /🎉/);
  assert.match(code, /className: "katex"/);
  assert.doesNotMatch(code, /":xmlns"/);
  assert.match(code, /md-mermaid__source/);
});

test('copy text of terminal blocks: commands only, prompts removed', () => {
  assert.equal(commandsToCopy('$ npm i x\nadded 1 package\n$ npm run build \\\n  --watch\ndone'), 'npm i x\nnpm run build \\\n  --watch');
  assert.equal(commandsToCopy('PS C:\\> dir\n  output'), 'dir');
  assert.equal(commandsToCopy('npm i x\nnpm test'), undefined, 'no prompts: copied as written');
});

test('expressiveCode option: ours first, the project’s merged in, JSON-safe plugins', () => {
  const options = parseOptions({ name: 'L', tagline: 't', url: 'https://l.dev', repo: 'https://github.com/a/b' });
  assert.equal(expressiveCodeConfig(options, false), false);
  const mine = { name: 'mine', hooks: {} };
  const ec = /** @type {any} */ (expressiveCodeConfig(options, { plugins: [mine], defaultProps: { showLineNumbers: true }, shiki: { langAlias: { foo: 'js' } } }));
  assert.deepEqual(ec.plugins.map((/** @type {any} */ p) => p.name), ['Line numbers', 'Collapsible sections', 'project-site-code', 'mine']);
  assert.equal(ec.defaultProps.showLineNumbers, true);
  assert.equal(ec.defaultProps.collapseStyle, 'github');
  assert.deepEqual(ec.shiki.langAlias, { ...LANG_ALIAS, foo: 'js' });
  // Expressive Code's <Code> refuses options with functions in their JSON.
  assert.doesNotMatch(JSON.stringify(ec.plugins.slice(0, 3)), /Function|hooks/);
  assert.equal(typeof ec.plugins[2].hooks.annotateCode, 'function');
  const safe = jsonSafe({ name: 'x', baseStyles: () => '' });
  assert.equal(JSON.stringify(safe), '{"name":"x"}');
});

test('markdown option: validated switches, defaults on', () => {
  const base = { name: 'L', tagline: 't', url: 'https://l.dev', repo: 'https://github.com/a/b' };
  assert.deepEqual(parseOptions(base).markdown, {});
  assert.equal(parseOptions({ ...base, markdown: { math: false } }).markdown.math, false);
  assert.throws(() => parseOptions({ ...base, markdown: { maths: false } }), /markdown: unknown option "maths"/);
});

test('Starlight folders: docs collection, mounts and processedDirs', () => {
  const root = fixture({ 'docs/README.md': '# Docs\n', 'extra/a.md': '' });
  const options = parseOptions({
    name: 'L', tagline: 't', url: 'https://l.dev', repo: 'https://github.com/a/b',
    externalDocs: [{ dir: './docs', route: 'ref', label: 'Ref' }],
    starlight: { markdown: { processedDirs: ['./extra'] } },
  });
  const dirs = starlightDirs(options, root, new URL(`file://${root}/src/`));
  const posix = (/** @type {string} */ p) => p.split(path.sep).join('/');
  assert.deepEqual(dirs, [`${posix(root)}/src/content/docs/`, `${posix(root)}/docs/`, `${posix(root)}/extra/`]);
});

test('KaTeX assets: versioned path, stylesheet present', () => {
  const k = katexAssets();
  assert.match(k.path, /^_project-site\/katex-\d+\.\d+\.\d+$/);
  assert.ok(readFileSync(path.join(k.dist, 'katex.min.css'), 'utf8').includes('KaTeX_Main'));
});

test('prompt annotation output is valid hast (no nested root), so Sätteri accepts it', async () => {
  const { createRenderer } = await import('rehype-expressive-code');
  const { codePlugins } = await import('../src/markdown/expressive-code.mjs');
  const { ec } = await createRenderer({ plugins: codePlugins({ wrapToggle: true }) });
  const { renderedGroupAst } = await ec.render({ code: '$ npm i\n$ npm test', language: 'sh' });
  const plugin = { name: 'ec', element: { filter: ['pre'], visit: () => /** @type {any} */ (structuredClone(renderedGroupAst)) } };
  const { html } = await markdownToHtml('```x\ny\n```', { hastPlugins: [plugin] });
  assert.match(html, /<span class="md-prompt"><span[^>]*>\$<\/span>/);
  assert.match(html, /data-code="npm i\u007fnpm test"/);
});
