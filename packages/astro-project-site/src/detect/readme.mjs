// What a README says about a project: its title, intro, a features list and install/usage code.
// Pure: parseReadme() takes markdown text. Only reads what is there; never invents copy.
import { plain, scanLines } from '../docs/mount.mjs';

/**
 * @typedef {{ type: 'heading', level: number, text: string }
 *   | { type: 'code', lang: string, code: string }
 *   | { type: 'para', text: string, quote?: boolean, html?: boolean }
 *   | { type: 'item', indent: number, text: string }
 *   | { type: 'other' }} Block
 * @typedef {{ title: string, body: string }} Feature
 * @typedef {{ title: string, body: string, code: string, lang: string }} Step
 * @typedef {{ title?: string, intro?: string, tagline?: string, features: Feature[], featuresHeading?: string,
 *   steps: Step[], stepsHeading?: string, install?: string }} ReadmeFacts
 */

/** Markdown → a flat list of blocks (headings, code, paragraphs, list items). Good enough for READMEs. */
export function blocks(/** @type {string} */ md) {
  const lines = scanLines(md.replace(/^\uFEFF/, '').replace(/^---\n[\s\S]*?\n---\n/, '').replace(/\r\n?/g, '\n').replace(/[\u2028\u2029\u0085]/g, ' '));
  /** @type {Block[]} */
  const out = [];
  /** @type {string[]} */
  let para = [];
  let quote = false;
  let html = false;
  const flush = () => {
    if (para.length) out.push({ type: 'para', text: para.join('\n'), quote, html });
    para = [];
    quote = false;
    html = false;
  };
  for (let i = 0; i < lines.length; i++) {
    const { text, code } = lines[i];
    if (code) {
      flush();
      const fence = /^\s*(`{3,}|~{3,})\s*([^\s`{]*)/.exec(text);
      // scanLines flags the opening fence, the content and the closing fence as code.
      let j = i + 1;
      while (j < lines.length && lines[j].code) j++;
      const run = lines.slice(i + 1, j).map((l) => l.text);
      if (run.length && /^\s*(`{3,}|~{3,})\s*$/.test(run.at(-1) ?? '')) run.pop();
      out.push({ type: 'code', lang: (fence?.[2] ?? '').toLowerCase(), code: dedent(run).join('\n') });
      i = j - 1;
      continue;
    }
    const t = text.trim();
    if (!t) {
      flush();
      continue;
    }
    const atx = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(text);
    if (atx) {
      flush();
      out.push({ type: 'heading', level: atx[1].length, text: atx[2] });
      continue;
    }
    const htmlHeading = /^\s*<h([1-6])\b[^>]*>(.*?)<\/h\1>\s*$/i.exec(text);
    if (htmlHeading) {
      flush();
      out.push({ type: 'heading', level: Number(htmlHeading[1]), text: htmlHeading[2] });
      continue;
    }
    if (para.length === 1 && !quote && !html && /^ {0,3}(=+|-+)\s*$/.test(text)) {
      out.push({ type: 'heading', level: text.trim()[0] === '=' ? 1 : 2, text: para[0] });
      para = [];
      continue;
    }
    const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(text);
    if (item && !/^\s*([-*_])(\s*\1){2,}\s*$/.test(text)) {
      flush();
      out.push({ type: 'item', indent: item[1].length, text: item[3] });
      continue;
    }
    const last = out.at(-1);
    if (!para.length && last?.type === 'item' && (/^\s/.test(text) || lines[i - 1]?.text.trim())) {
      last.text += ` ${t}`; // continuation of a list item
      continue;
    }
    if (t.startsWith('|') || /^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(text)) {
      flush();
      out.push({ type: 'other' });
      continue;
    }
    if (!para.length) {
      quote = t.startsWith('>');
      html = t.startsWith('<');
    }
    para.push(quote ? t.replace(/^>\s?/, '') : t);
  }
  flush();
  return out;
}

function dedent(/** @type {string[]} */ lines) {
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)?.[0].length ?? 0));
  return Number.isFinite(indent) && indent > 0 ? lines.map((l) => l.slice(indent)) : lines;
}

/** Inline markdown/HTML → plain text, minus images and badges. */
export function clean(/** @type {string} */ md) {
  return plain(
    md
      .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '') // linked image (badge)
      .replace(/\[!\[[^\]]*\]\[[^\]]*\]\]\[[^\]]*\]/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/!\[[^\]]*\]\[[^\]]*\]/g, '')
      .replace(/<img\b[^>]*>/gi, '')
      .replace(/<(picture|svg|video|audio)\b[\s\S]*?<\/\1>/gi, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

/** The first sentence of a text, at most `max` characters (cut at a word, with an ellipsis). */
export function firstSentence(/** @type {string} */ text, max = 160) {
  const s = /^(.{20,}?[.!?])(?=\s|$)/.exec(text)?.[1] ?? text;
  return s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : s;
}

const FEATURES = /^(key )?(features|highlights|why\b.*|what it does|what you get|benefits)\b/i;
const STEPS = /^(install(ation|ing)?|getting started|get started|quick ?start|usage|basic usage|setup|set up|how to use)\b/i;
const INSTALL = /^(npm (i|install|add)|pnpm (add|i|install)|yarn add|bun add|deno add|cargo (add|install)|pip3? install|uv (add|pip install)|poetry add|go (get|install)|composer require|gem install|brew install)\s+(?!-)\S/;
const SHELL = new Set(['', 'sh', 'bash', 'shell', 'zsh', 'console', 'shell-session', 'terminal', 'cmd', 'powershell', 'ps1']);

/** A heading's text without emoji, markup or a trailing colon. */
const headingText = (/** @type {string} */ h) => clean(h).replace(/^[^\p{L}\p{N}]+/u, '').replace(/[:\s]+$/, '');

/** Splits a feature bullet: "**Bold** — text", "**Bold**: text", "Title: text", "Title — text". */
export function splitFeature(/** @type {string} */ raw) {
  const text = raw.replace(/^\[[ xX]\]\s+/, '').replace(/^[^\p{L}\p{N}*_`[]+/u, '');
  const bold = /^(\*\*|__)(.+?)\1\s*(.*)$/.exec(text);
  if (bold) {
    const title = clean(bold[2]).replace(/[.:]\s*$/, '');
    const rest = bold[3].replace(/^([—–:]|-(?=\s)|\.(?=\s))\s*/, '');
    return { title, body: capital(clean(rest), rest) };
  }
  const plainText = clean(text);
  const sep = /^(.{2,60}?)(?::\s+|\s+[—–-]\s+)(.+)$/.exec(plainText);
  if (sep && !/[.!?]/.test(sep[1])) return { title: sep[1].trim(), body: capital(sep[2], /(?::\s+|\s+[—–-]\s+)(.*)$/.exec(text)?.[1] ?? '') };
  return { title: plainText, body: '' };
}

/** Sentence case for a card body, unless it starts with code (`add()` stays as written). */
const capital = (/** @type {string} */ s, /** @type {string} */ raw) => (raw.trimStart().startsWith('`') ? s : s.charAt(0).toUpperCase() + s.slice(1));

/** Normalises a fence language for Shiki: `shell` → `sh`, unknown → `txt`. */
export function codeLang(/** @type {string} */ lang) {
  const l = lang.toLowerCase();
  if (SHELL.has(l)) return 'sh';
  const known = ['js', 'javascript', 'mjs', 'cjs', 'ts', 'typescript', 'jsx', 'tsx', 'json', 'jsonc', 'json5', 'html', 'css', 'scss',
    'py', 'python', 'rust', 'rs', 'go', 'toml', 'yaml', 'yml', 'ruby', 'rb', 'php', 'md', 'markdown', 'mdx', 'astro', 'svelte',
    'vue', 'diff', 'sql', 'c', 'cpp', 'java', 'kotlin', 'swift', 'xml', 'ini', 'dockerfile', 'graphql', 'txt', 'text', 'lua', 'zig'];
  return known.includes(l) ? l : 'txt';
}

/**
 * A step title for a code block with no sentence before it, from the code itself: shell commands become
 * "Run `npx tool a`, `b` and `c`"; other languages get a short phrase. `undefined` when nothing fits.
 */
export function titleFromCode(/** @type {string} */ code, /** @type {string} */ lang) {
  const l = codeLang(lang);
  if (l === 'sh') {
    const cmds = code
      .split('\n')
      .map((line) => line.replace(/^\s*(?:\$|%|>|❯)\s+/, '').replace(/\s+#.*$/, '').trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split(/\s+/).filter((w) => !w.startsWith('-')).slice(0, 3));
    if (!cmds.length) return undefined;
    const tick = (/** @type {string} */ s) => `\`${s}\``;
    const join = (/** @type {string[]} */ xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0]);
    const prefix = cmds[0].slice(0, 2).join(' ');
    if (cmds.length > 1 && cmds.every((c) => c.length === 3 && c.slice(0, 2).join(' ') === prefix)) {
      const subs = [...new Set(cmds.map((c) => c[2]))];
      return `Run ${join([tick(`${prefix} ${subs[0]}`), ...subs.slice(1).map(tick)])}`;
    }
    return `Run ${tick(cmds[0].join(' '))}`;
  }
  const byLang = /** @type {Record<string, string>} */ ({
    html: 'Add it to your page', astro: 'Add it to your page', vue: 'Add it to your page', svelte: 'Add it to your page',
    css: 'Style it', scss: 'Style it',
    json: 'Configure it', jsonc: 'Configure it', json5: 'Configure it', yaml: 'Configure it', yml: 'Configure it', toml: 'Configure it', ini: 'Configure it',
  });
  return byLang[l] ?? (['js', 'javascript', 'mjs', 'cjs', 'ts', 'typescript', 'jsx', 'tsx', 'py', 'python', 'rust', 'rs', 'go', 'ruby', 'rb', 'php'].includes(l) ? 'Use it in code' : undefined);
}

/** The first package-install command in a shell code block, without prompt or trailing comment. */
export function findInstall(/** @type {Block[]} */ list) {
  for (const b of list) {
    if (b.type !== 'code' || !SHELL.has(b.lang)) continue;
    for (const line of b.code.split('\n')) {
      const cmd = line.trim().replace(/^[$>]\s*/, '').replace(/\s+#.*$/, '').trim();
      if (INSTALL.test(cmd)) return cmd;
    }
  }
  return undefined;
}

/** Blocks of the section a heading opens: up to the next heading of the same or a higher level. */
function section(/** @type {Block[]} */ list, /** @type {number} */ at) {
  const head = /** @type {{ level: number }} */ (list[at]);
  const end = list.findIndex((b, i) => i > at && b.type === 'heading' && b.level <= head.level);
  return list.slice(at + 1, end === -1 ? undefined : end);
}

/** @returns {ReadmeFacts} */
export function parseReadme(/** @type {string} */ md) {
  const list = blocks(md);
  const h1 = list.findIndex((b) => b.type === 'heading' && b.level === 1);
  const title = h1 === -1 ? undefined : headingText(/** @type {any} */ (list[h1]).text) || undefined;

  // Intro: the first paragraph with words in it, before the first section heading.
  let intro;
  for (const b of list.slice(h1 + 1)) {
    if (b.type === 'heading') break;
    if (b.type !== 'para') continue;
    const text = clean(b.text);
    if ((text.match(/\p{L}/gu)?.length ?? 0) >= 12) {
      intro = text.length > 400 ? `${text.slice(0, 399).replace(/\s+\S*$/, '')}…` : text;
      break;
    }
  }

  // Features: top-level bullets under a Features/Highlights/Why heading.
  /** @type {Feature[]} */
  let features = [];
  let featuresHeading;
  const fi = list.findIndex((b) => b.type === 'heading' && b.level > 1 && FEATURES.test(headingText(b.text)));
  if (fi !== -1) {
    const items = section(list, fi).filter((b) => b.type === 'item');
    const top = Math.min(...items.map((b) => /** @type {any} */ (b).indent));
    features = items
      .filter((b) => /** @type {any} */ (b).indent === top)
      .map((b) => splitFeature(/** @type {any} */ (b).text))
      .filter((f) => f.title)
      .slice(0, 6);
    if (features.length) featuresHeading = headingText(/** @type {any} */ (list[fi]).text);
  }

  // Steps: code blocks (with the paragraph before each) under Install/Usage/Getting started headings; else the
  // section holding the first install command.
  const install = findInstall(list);
  let starts = list.flatMap((b, i) => (b.type === 'heading' && b.level > 1 && STEPS.test(headingText(b.text)) ? [i] : []));
  if (!starts.length && install) {
    const at = list.findIndex((b) => b.type === 'code' && b.code.includes(install));
    for (let i = at; i >= 0; i--) {
      const b = list[i];
      if (b.type === 'heading' && b.level > 1) {
        starts = [i];
        break;
      }
    }
  }
  /** @type {Step[]} */
  const steps = [];
  const seen = new Set();
  for (const at of starts) {
    const heading = headingText(/** @type {any} */ (list[at]).text);
    let lastPara = '';
    let first = true;
    for (const b of section(list, at)) {
      if (b.type === 'heading') lastPara = headingText(b.text);
      else if (b.type === 'para') lastPara = clean(b.text);
      else if (b.type === 'code' && b.code.trim() && !seen.has(b.code)) {
        seen.add(b.code);
        const lead = lastPara.replace(/:\s*$/, '');
        steps.push(first
          ? { title: !lead && install && b.code.includes(install) && !/^install/i.test(heading) ? 'Install' : heading, body: lead ? firstSentence(lead, 200) : '', code: b.code, lang: codeLang(b.lang) }
          : { title: lead ? firstSentence(lead, 80) : (titleFromCode(b.code, b.lang) ?? `Step ${steps.length + 1}`), body: '', code: b.code, lang: codeLang(b.lang) });
        first = false;
        lastPara = '';
      }
      if (steps.length >= 3) break;
    }
    if (steps.length >= 3) break;
  }
  const stepsHeading = starts.length ? headingText(/** @type {any} */ (list[starts[0]]).text) : undefined;

  return { title, intro, tagline: intro ? firstSentence(intro) : undefined, features, featuresHeading, steps, stepsHeading, install };
}
