// Expressive Code configuration for Starlight's `expressiveCode` option. Starlight already brings frames (titles,
// terminal windows, copy button), text markers (line/word highlighting, ins/del, diff) and Shiki; this adds:
//
//   - line numbers (opt-in per block: `showLineNumbers`) and collapsible sections (`collapse={1-5}`)
//   - shell prompts: in terminal blocks, `$ `/`% `/`❯ `/`PS> ` prompts cannot be selected, and the copy button copies
//     the commands only (prompt removed, output lines left out)
//   - a "wrap lines" toggle on blocks whose lines do not fit (shown only when they overflow; useful on phones)
//   - aliases for language names GitHub accepts that Shiki does not (`shell-session`, `terminal`, `env`, …)
//
// Themes stay Starlight's defaults, which take their colours from the `--sl-*` tokens (themselves derived from
// `--site-*`), with Expressive Code raising syntax colours to a 5.5:1 contrast against the code background.
//
// Plugins are code, and Expressive Code's <Code> component (used by <Live>) only gets a JSON copy of the
// integration's options, refusing any that contain functions. So the plugins here show only their `name` to JSON
// (everything else is non-enumerable), and the component gets the real ones from `ecConfigModule()`, served as
// Expressive Code's `ec.config.mjs` when the project has none of its own.
import { fileURLToPath } from 'node:url';
import { definePlugin, ExpressiveCodeAnnotation } from '@expressive-code/core';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';

/** Languages written in GitHub READMEs that Shiki knows under another name. Unknown languages render as plain text. */
export const LANG_ALIAS = {
  'shell-session': 'shellsession',
  'sh-session': 'shellsession',
  terminal: 'shellsession',
  env: 'dotenv',
  gitignore: 'ini',
  npmrc: 'ini',
  editorconfig: 'ini',
  conf: 'ini',
  plain: 'txt',
  none: 'txt',
};

/** Shown in a terminal frame (Expressive Code's own list covers bash, sh, zsh, shell, console, shellsession, ps…). */
const EXTRA_TERMINAL = new Set(['shell-session', 'sh-session', 'terminal']);
const TERMINAL = new Set(['ansi', 'bash', 'bat', 'batch', 'cmd', 'console', 'powershell', 'ps', 'ps1', 'psd1', 'psm1', 'sh', 'shell', 'shellscript', 'shellsession', 'zsh', ...EXTRA_TERMINAL]);

/** A prompt at the start of a line: `$ `, `% `, `❯ `, `➜ `, or PowerShell's `PS C:\> `. */
export const PROMPT = /^(\s*)(?:[$%❯➜]|PS(?: [^>\n]*)?>)(?: |$)/;

/**
 * What the copy button copies from a terminal block. When some lines start with a prompt, those are the commands:
 * copy them without the prompt (plus continuation lines after a trailing `\`), and leave the output out. A block
 * without prompts is copied as it is.
 */
export function commandsToCopy(/** @type {string} */ code) {
  const lines = code.split('\n');
  if (!lines.some((l) => PROMPT.test(l))) return undefined;
  /** @type {string[]} */
  const out = [];
  let continued = false;
  for (const line of lines) {
    const m = PROMPT.exec(line);
    if (m) out.push(line.slice(m[0].length));
    else if (continued) out.push(line);
    else continue;
    continued = /\\\s*$/.test(line);
  }
  return out.join('\n').trim();
}

/** Wraps a prompt so it cannot be selected (copying by hand gets the command only, too). */
class PromptAnnotation extends ExpressiveCodeAnnotation {
  name = 'project-site-prompt';
  /** @param {import('@expressive-code/core').AnnotationRenderOptions} opts */
  render({ nodesToTransform }) {
    // A prompt spanning several highlighted tokens arrives as a `root`: wrap its children (a root nested in an
    // element is not valid hast, and Sätteri refuses it).
    return nodesToTransform.map((node) =>
      /** @type {import('hast').Element} */ ({
        type: 'element',
        tagName: 'span',
        properties: { className: ['md-prompt'] },
        children: /** @type {any} */ (node.type === 'root' ? node.children : [node]),
      }),
    );
  }
}

const WRAP_ICON =
  'M3 6h15a3 3 0 0 1 0 6h-4.6l1.3-1.3a1 1 0 0 0-1.4-1.4l-3 3a1 1 0 0 0 0 1.4l3 3a1 1 0 0 0 1.4-1.4L13.4 14H18a5 5 0 0 0 0-10H3a1 1 0 0 0 0 2Zm0 6h4a1 1 0 0 0 0-2H3a1 1 0 0 0 0 2Zm0 6h6a1 1 0 0 0 0-2H3a1 1 0 0 0 0 2Z';

// Shows the toggle on blocks that overflow (or are wrapped), and flips Expressive Code's own `wrap` class.
const WRAP_SCRIPT = `
const sel = '.expressive-code .md-wrap-toggle';
const pre = (b) => b.closest('figure')?.querySelector('pre');
const sync = () => {
  for (const b of document.querySelectorAll(sel)) {
    const p = pre(b);
    if (p) b.hidden = !(p.classList.contains('wrap') || p.scrollWidth > p.clientWidth + 1);
  }
};
document.addEventListener('click', (e) => {
  const b = e.target instanceof Element && e.target.closest(sel);
  const p = b && pre(b);
  if (!p) return;
  const on = p.classList.toggle('wrap');
  b.setAttribute('aria-pressed', String(on));
  sync();
});
const ro = new ResizeObserver(() => { cancelAnimationFrame(ro.f); ro.f = requestAnimationFrame(sync); });
const watch = () => document.querySelectorAll(sel).forEach((b) => { const p = pre(b); if (p) ro.observe(p); });
watch();
document.addEventListener('astro:page-load', watch);
`;

/** @typedef {{ wrapToggle: boolean, wrapLabel?: string }} CodeOptions */

/** @param {CodeOptions} opts */
export function pluginProjectSiteCode({ wrapToggle, wrapLabel = 'Wrap lines' }) {
  return definePlugin({
    name: 'project-site-code',
    baseStyles: ({ cssVar }) => `
      .md-prompt { user-select: none; -webkit-user-select: none; }
      .md-wrap-toggle {
        position: absolute;
        inset-block-start: calc(${cssVar('borderWidth')} + var(--button-spacing));
        inset-inline-end: calc(${cssVar('borderWidth')} + ${cssVar('uiPaddingInline')} / 2 + 2.5rem + 0.25rem);
        z-index: 1;
        display: grid;
        place-items: center;
        width: 2.5rem;
        height: 2.5rem;
        padding: 0;
        border: ${cssVar('borderWidth')} solid ${cssVar('frames.inlineButtonBorder')};
        border-radius: 0.2rem;
        color: ${cssVar('frames.inlineButtonForeground')};
        background: var(--code-background);
        opacity: 0.75;
        cursor: pointer;
        &[hidden] { display: none; }
        &[aria-pressed='true'] { opacity: 1; background: color-mix(in srgb, ${cssVar('frames.inlineButtonForeground')} 18%, var(--code-background)); }
        &:hover, &:focus-visible { opacity: 1; }
        svg { width: 1.25rem; height: 1.25rem; }
        @media (scripting: none) { display: none; }
      }
      @media (pointer: coarse) {
        /* 44×44 on touch screens, beside the copy button (which theme.css makes 44 wide there too). */
        .md-wrap-toggle {
          width: 2.75rem;
          height: 2.75rem;
          inset-inline-end: calc(${cssVar('borderWidth')} + ${cssVar('uiPaddingInline')} / 2 + 2.75rem + 0.25rem);
        }
      }
      @media (hover: hover) {
        .md-wrap-toggle:not([aria-pressed='true']) { opacity: 0; }
        .frame:hover .md-wrap-toggle, .md-wrap-toggle:focus-visible { opacity: 0.75; }
      }
      pre.wrap .ec-line { --ecIndent: var(--md-indent, 0ch); }
    `,
    jsModules: wrapToggle ? [WRAP_SCRIPT] : [],
    hooks: {
      preprocessMetadata: ({ codeBlock }) => {
        if (EXTRA_TERMINAL.has(codeBlock.language) && codeBlock.props.frame === undefined) codeBlock.props.frame = 'terminal';
      },
      annotateCode: ({ codeBlock }) => {
        if (!TERMINAL.has(codeBlock.language)) return;
        for (const line of codeBlock.getLines()) {
          const m = PROMPT.exec(line.text);
          if (m) line.addAnnotation(new PromptAnnotation({ inlineRange: { columnStart: m[1].length, columnEnd: m[0].length } }));
        }
      },
      postprocessRenderedLine: ({ codeBlock, line, renderData }) => {
        // The indent wrapped lines keep when the toggle turns wrapping on (Expressive Code computes it only for
        // blocks wrapped at build time).
        if (!wrapToggle || codeBlock.props.wrap) return;
        const indent = line.text.match(/^\s*/)?.[0].length ?? 0;
        if (indent) appendStyle(renderData.lineAst, `--md-indent:${indent}ch`);
      },
      postprocessRenderedBlock: ({ codeBlock, renderData }) => {
        const figure = renderData.blockAst;
        // Expressive Code's copy button is named only by its `title` (a tooltip, which some screen readers skip and
        // touch screens never show): give it the same text as its accessible name, and an explicit type.
        const copy = find(figure, (n) => n.tagName === 'button' && n.properties?.dataCode !== undefined);
        if (copy) {
          copy.properties.type ??= 'button';
          if (copy.properties.title && !copy.properties.ariaLabel) copy.properties.ariaLabel = copy.properties.title;
        }
        if (TERMINAL.has(codeBlock.language)) {
          const commands = commandsToCopy(codeBlock.code);
          // hastscript stores `data-code` as the `dataCode` property.
          const button = commands === undefined ? undefined : find(figure, (n) => n.tagName === 'button' && n.properties?.dataCode !== undefined);
          if (button && commands !== undefined) button.properties.dataCode = commands.replace(/\n/g, '\u007f');
        }
        if (wrapToggle && !codeBlock.props.wrap) {
          const lines = codeBlock.getLines();
          const longest = lines.reduce((max, l) => Math.max(max, l.text.length), 0);
          // Short blocks never need it; the script still hides it on screens where the block fits.
          if (longest < 40) return;
          const pre = find(figure, (n) => n.tagName === 'pre');
          if (pre) appendStyle(pre, `--ecMaxLine:${longest}ch`);
          figure.children.push({
            type: 'element',
            tagName: 'button',
            properties: { type: 'button', className: ['md-wrap-toggle'], 'aria-pressed': 'false', title: wrapLabel, 'aria-label': wrapLabel, hidden: true },
            children: [
              {
                type: 'element',
                tagName: 'svg',
                properties: { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
                children: [{ type: 'element', tagName: 'path', properties: { d: WRAP_ICON, fill: 'currentColor' }, children: [] }],
              },
            ],
          });
        }
      },
    },
  });
}

/**
 * Depth-first search of a hast tree.
 * @param {any} node @param {(n: any) => boolean} test
 * @returns {any}
 */
function find(node, test) {
  if (node?.type === 'element' && test(node)) return node;
  for (const child of node?.children ?? []) {
    /** @type {any} */
    const hit = find(child, test);
    if (hit) return hit;
  }
  return undefined;
}

function appendStyle(/** @type {any} */ node, /** @type {string} */ decl) {
  node.properties ??= {};
  const prev = node.properties.style ? String(node.properties.style).replace(/;?\s*$/, ';') : '';
  node.properties.style = prev + decl;
}

/**
 * A plugin whose only enumerable key is `name`: JSON sees `{ name }`, Expressive Code reads the rest as usual.
 * @template {Record<string, any>} T
 * @param {T} plugin
 * @returns {T}
 */
export function jsonSafe(plugin) {
  const out = /** @type {Record<string, any>} */ ({ name: plugin.name });
  for (const [key, value] of Object.entries(plugin)) {
    if (key !== 'name') Object.defineProperty(out, key, { value, enumerable: false, writable: true, configurable: true });
  }
  return /** @type {T} */ (out);
}

/** The plugins this package adds, in order. */
export function codePlugins(/** @type {CodeOptions} */ opts) {
  return [pluginLineNumbers(), pluginCollapsibleSections(), pluginProjectSiteCode(opts)];
}

/**
 * Source of the module served as `virtual:astro-expressive-code/ec-config` (what an `ec.config.mjs` would export),
 * so <Code> renders with the same plugins as markdown code blocks.
 */
export function ecConfigModule(/** @type {CodeOptions} */ opts) {
  return `import { codePlugins } from ${JSON.stringify(fileURLToPath(import.meta.url))};\nexport default { plugins: codePlugins(${JSON.stringify(opts)}) };\n`;
}

/**
 * The `expressiveCode` option for Starlight: ours merged with what the project passed as `starlight.expressiveCode`
 * (its plugins after ours, its `defaultProps`, `shiki.langAlias` and other settings winning). `false` stays false.
 * @param {{ markdown?: { codeWrapToggle?: boolean }, labels?: { wrapLines?: unknown } }} options
 * @param {unknown} user
 */
export function expressiveCodeConfig(options, user) {
  if (user === false) return false;
  const u = /** @type {Record<string, any>} */ (user && typeof user === 'object' ? user : {});
  return {
    ...u,
    plugins: [
      ...codePlugins({
        wrapToggle: options.markdown?.codeWrapToggle !== false,
        wrapLabel: typeof options.labels?.wrapLines === 'string' ? options.labels.wrapLines : undefined,
      }).map(jsonSafe),
      ...(u.plugins ?? []),
    ],
    defaultProps: {
      // Line numbers are opt-in (`showLineNumbers`), as on GitHub; collapsed sections look like GitHub's.
      showLineNumbers: false,
      collapseStyle: 'github',
      ...u.defaultProps,
    },
    shiki: { ...u.shiki, langAlias: { ...LANG_ALIAS, ...u.shiki?.langAlias } },
  };
}
