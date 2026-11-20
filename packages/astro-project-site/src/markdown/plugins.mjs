// Markdown plugins for Astro's default processor (Sätteri), registered on Astro's global `markdown.processor`, so
// they run on every .md/.mdx file: Starlight docs, mounted `externalDocs` folders, blog posts, a project's own pages.
// Each one brings GitHub's rendering of something the parser leaves as plain markdown:
//
//   alerts     > [!NOTE] / [!TIP] / [!IMPORTANT] / [!WARNING] / [!CAUTION] blockquotes → callouts
//   emoji      :tada: shortcodes → 🎉 (GitHub's gemoji names)
//   math       $…$, $$…$$ and ```math blocks → KaTeX HTML+MathML at build time; the page links KaTeX's CSS
//   mermaid    ```mermaid blocks → a <figure> the client script renders (the source shows until it does)
//   tables     every table gets a class so it scrolls in its own box
//   footnotes  the "Footnotes" label is shown, as on GitHub
//   headings   anchor links on pages outside Starlight's folders (Starlight adds its own there), with
//              github-slugger ids, so `#fragment` links copied from GitHub keep working
//
// Sätteri plugins are objects with visitors (see node_modules/satteri/dist/plugin.d.ts). A plugin can also be a
// factory `(document) => plugin | plugin[] | null`, called once per document: used here for per-page state.
import katex from 'katex';
import { fromHtml } from 'hast-util-from-html';
import { nameToEmoji } from 'gemoji';
import Slugger from 'github-slugger';

/**
 * @typedef {{ type: string, tagName?: string, value?: string, properties?: Record<string, any>,
 *   children?: HastNode[], data?: Record<string, any> }} HastNode
 * @typedef {{ textContent(node: any): string, replaceNode(node: any, next: any): void, setProperty(node: any,
 *   key: string, value: unknown): void, prependChild(node: any, child: any): void, parent(node: any): any, indexOf(node: any): number | undefined,
 *   fileURL?: URL, sourceFormat?: string }} Ctx
 * @typedef {{ alerts: boolean, emoji: boolean, math: boolean, mermaid: boolean, headingLinks: boolean }} Features
 * @typedef {{ features: Features, katexCss: string, isStarlightFile: (url: URL | undefined) => boolean,
 *   mermaidInstalled?: boolean, onMissingMermaid?: (file: URL | undefined) => void }} PluginOptions
 */

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────

/** @returns {HastNode} */
const el = (/** @type {string} */ tagName, /** @type {Record<string, any>} */ properties = {}, /** @type {HastNode[]} */ children = []) => ({
  type: 'element',
  tagName,
  properties,
  children,
});
const text = (/** @type {string} */ value) => ({ type: 'text', value });

/** Class names of a hast element as an array (Sätteri gives `className` as an array or a string). */
export function classes(/** @type {HastNode | undefined} */ node) {
  const c = node?.properties?.className ?? node?.properties?.class;
  return Array.isArray(c) ? c.map(String) : typeof c === 'string' ? c.split(/\s+/).filter(Boolean) : [];
}

/** The `<code>` child of a `<pre>` and its language (`language-x` class), or undefined. */
function codeOf(/** @type {HastNode} */ pre) {
  const code = pre.children?.find((c) => c.type === 'element' && c.tagName === 'code');
  if (!code) return undefined;
  const lang = code.data?.lang ?? classes(code).find((c) => c.startsWith('language-'))?.slice('language-'.length);
  return { code, lang: typeof lang === 'string' ? lang.toLowerCase() : undefined };
}

// ── alerts ──────────────────────────────────────────────────────────────────────────────────────────

/** GitHub's five alert types: label, and the Octicon GitHub shows (Octicons: MIT, © GitHub Inc.). */
export const ALERTS = /** @type {const} */ ({
  note: {
    label: 'Note',
    icon: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  },
  tip: {
    label: 'Tip',
    icon: 'M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z',
  },
  important: {
    label: 'Important',
    icon: 'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  },
  warning: {
    label: 'Warning',
    icon: 'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  },
  caution: {
    label: 'Caution',
    icon: 'M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  },
});

// GitHub's rule: the marker is the whole first line of the blockquote (case-insensitive).
const ALERT_MARKER = /^\[!(note|tip|important|warning|caution)\][ \t]*(?:\r?\n|$)/i;

/** `> [!NOTE]` blockquotes → `<aside class="md-alert md-alert--note">` with a title row, like Starlight's asides. */
export function alertsPlugin() {
  return {
    name: 'project-site-alerts',
    element: {
      filter: ['blockquote'],
      visit(/** @type {HastNode} */ node, /** @type {Ctx} */ ctx) {
        const kids = node.children ?? [];
        const firstIndex = kids.findIndex((c) => !(c.type === 'text' && !c.value?.trim()));
        const first = kids[firstIndex];
        if (first?.type !== 'element' || first.tagName !== 'p') return;
        const lead = first.children?.[0];
        const match = lead?.type === 'text' ? ALERT_MARKER.exec(lead.value ?? '') : null;
        if (!match) return;
        const kind = /** @type {keyof typeof ALERTS} */ (match[1].toLowerCase());
        const { label, icon } = ALERTS[kind];

        // The first paragraph without the marker (and without a hard break right after it).
        let rest = /** @type {HastNode[]} */ ([...(first.children ?? []).slice(1)]);
        const remainder = (lead?.value ?? '').slice(match[0].length);
        if (remainder.trim()) rest.unshift(text(remainder));
        else while (rest[0] && ((rest[0].type === 'element' && rest[0].tagName === 'br') || (rest[0].type === 'text' && !rest[0].value?.trim()))) rest.shift();
        const body = [...(rest.length ? [el('p', {}, rest)] : []), ...kids.slice(firstIndex + 1)];

        const svg = el('svg', { viewBox: '0 0 16 16', width: '16', height: '16', 'aria-hidden': 'true', className: ['md-alert__icon'] }, [
          el('path', { d: icon, fill: 'currentColor' }),
        ]);
        return el('aside', { className: ['md-alert', `md-alert--${kind}`], 'aria-label': label }, [
          el('p', { className: ['md-alert__title'], 'aria-hidden': 'true' }, [svg, text(label)]),
          el('div', { className: ['md-alert__content'] }, body),
        ]);
      },
    },
  };
}

// ── emoji ───────────────────────────────────────────────────────────────────────────────────────────

const SHORTCODE = /:([a-z0-9_+-]+):/gi;

/** Replaces GitHub emoji shortcodes in a string; unknown names are left as they are. */
export function replaceShortcodes(/** @type {string} */ value) {
  if (!value.includes(':')) return value;
  return value.replace(SHORTCODE, (all, name) => /** @type {Record<string, string>} */ (nameToEmoji)[name.toLowerCase()] ?? all);
}

/** `:tada:` → 🎉 in text (never in code, which is not a text node). */
export function emojiPlugin() {
  return {
    name: 'project-site-emoji',
    text(/** @type {HastNode} */ node, /** @type {Ctx} */ ctx) {
      const value = node.value ?? '';
      const next = replaceShortcodes(value);
      if (next === value) return;
      // Text inside <pre>/<code>/<kbd>/<script>/<style> (raw HTML in the document) stays literal.
      for (let p = ctx.parent(node); p; p = ctx.parent(p)) {
        if (p.type === 'element' && ['pre', 'code', 'kbd', 'samp', 'script', 'style'].includes(p.tagName)) return;
      }
      return text(next);
    },
  };
}

// ── math ────────────────────────────────────────────────────────────────────────────────────────────

/** KaTeX HTML (with MathML for assistive tech). Errors render as KaTeX's red source text, never fail the build. */
export function renderMath(/** @type {string} */ tex, /** @type {boolean} */ display) {
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore' });
}

/**
 * KaTeX output as hast. Markdown takes it as a raw HTML node; MDX compiles to JSX, which has no raw HTML, so there
 * it is parsed into elements.
 * @returns {HastNode[]}
 */
function mathHast(/** @type {string} */ tex, /** @type {boolean} */ display, /** @type {string | undefined} */ format) {
  const html = renderMath(tex, display);
  if (format !== 'mdx') return [{ type: 'raw', value: html }];
  return /** @type {HastNode[]} */ (strip(/** @type {any} */ (fromHtml(html, { fragment: true }))).children ?? []);
}

/** Drops parse positions, and the `xmlns` on <math> (implied in HTML; JSX would print it as a stray attribute). */
function strip(/** @type {HastNode & { position?: unknown }} */ node) {
  delete node.position;
  if (node.tagName === 'math' && node.properties) delete node.properties.xmlns;
  node.children?.forEach(strip);
  return node;
}

// ── mermaid ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * The server-side form of a diagram: its source in a <pre> (no <code> child, so Expressive Code leaves it alone),
 * inside a <figure> that the client script turns into the rendered SVG.
 */
export function mermaidFigure(/** @type {string} */ source) {
  return el('figure', { className: ['md-mermaid'], 'data-mermaid': '' }, [
    el('pre', { className: ['md-mermaid__source'] }, [text(source)]),
  ]);
}

/**
 * A diagram when the optional `mermaid` package is not installed: the source, with a note saying how to get the
 * drawing. No `data-mermaid`, so no script touches it.
 */
export function mermaidSourceOnly(/** @type {string} */ source) {
  return el('figure', { className: ['md-mermaid', 'md-mermaid--source-only'] }, [
    el('pre', { className: ['md-mermaid__source'] }, [text(source)]),
    el('figcaption', { className: ['md-mermaid__note'] }, [
      text('Mermaid diagram (source). Install '),
      el('code', {}, [text('mermaid')]),
      text(' in this site to draw it: '),
      el('code', {}, [text('npm i mermaid')]),
      text('.'),
    ]),
  ]);
}

/**
 * Code-like blocks that are not code: ```mermaid, ```math, $$…$$ and $…$. Runs before Expressive Code (it is put
 * first in the plugin list), which would otherwise highlight them as code.
 */
export function blocksPlugin(/** @type {PluginOptions} */ opts) {
  const { math, mermaid } = opts.features;
  return () => {
    let usedMath = false;
    /** @param {string} tex @param {boolean} display @param {Ctx} ctx */
    const mathNode = (tex, display, ctx) => {
      usedMath = true;
      const html = mathHast(tex, display, ctx.sourceFormat);
      // Display math scrolls sideways in its own box when wider than the column.
      return display ? el('div', { className: ['md-math', 'md-math--display'] }, html) : el('span', { className: ['md-math'] }, html);
    };
    return {
      name: 'project-site-blocks',
      element: [
        {
          filter: ['pre'],
          visit(/** @type {HastNode} */ node, /** @type {Ctx} */ ctx) {
            const info = codeOf(node);
            if (!info) return;
            const source = ctx.textContent(info.code).replace(/\r?\n$/, '');
            if (mermaid && info.lang === 'mermaid') {
              if (opts.mermaidInstalled === false) {
                opts.onMissingMermaid?.(ctx.fileURL);
                return mermaidSourceOnly(source);
              }
              return mermaidFigure(source);
            }
            if (math && info.lang === 'math') return mathNode(source, true, ctx);
          },
        },
        {
          filter: ['code'],
          visit(/** @type {HastNode} */ node, /** @type {Ctx} */ ctx) {
            if (!math) return;
            const c = classes(node);
            // $…$ (and $$…$$ written inline) → inline math. Block math is a <pre>, handled above.
            if (!c.includes('math-inline')) return;
            const tex = ctx.textContent(node);
            // Pandoc's rule, which GitHub follows: no space just inside the dollars and no digit right after the
            // closing one, so "$5 and $6" stays text. (The digit check reads the next sibling text node.)
            const parent = ctx.parent(node);
            const index = ctx.indexOf(node);
            const next = index === undefined ? undefined : parent?.children?.[index + 1];
            const nextDigit = next?.type === 'text' && /^\d/.test(next.value ?? '');
            if (tex !== tex.trim() || !tex || nextDigit) return text(`$${tex}$`);
            return mathNode(tex, false, ctx);
          },
        },
      ],
      after(/** @type {HastNode} */ root, /** @type {Ctx} */ ctx) {
        // KaTeX's stylesheet (and its fonts) only on pages with math. Before the content, so math never shows unstyled.
        if (usedMath) ctx.prependChild(root, el('link', { rel: 'stylesheet', href: opts.katexCss }));
      },
    };
  };
}

// ── tables and footnotes ────────────────────────────────────────────────────────────────────────────

export function tablesAndFootnotesPlugin() {
  return {
    name: 'project-site-tables-footnotes',
    element: [
      {
        // A class instead of a wrapper, so table styles written for `table` still apply.
        filter: ['table'],
        visit(/** @type {HastNode} */ node, /** @type {Ctx} */ ctx) {
          ctx.setProperty(node, 'className', [...classes(node), 'md-table']);
        },
      },
      {
        // Task-list checkboxes are named after their item, so screen readers say what is (not) done.
        filter: ['input'],
        visit(/** @type {HastNode} */ node, /** @type {Ctx} */ ctx) {
          if (node.properties?.type !== 'checkbox' || node.properties?.ariaLabel || node.properties?.['aria-label']) return;
          const li = ctx.parent(node);
          if (li?.tagName !== 'li' || !classes(li).includes('task-list-item')) return;
          const label = (li.children ?? [])
            .filter((/** @type {HastNode} */ c) => !(c.type === 'element' && ['ul', 'ol', 'input'].includes(c.tagName ?? '')))
            .map((/** @type {HastNode} */ c) => ctx.textContent(c))
            .join('')
            .replace(/\s+/g, ' ')
            .trim();
          if (label) ctx.setProperty(node, 'aria-label', label.length > 120 ? `${label.slice(0, 119)}…` : label);
        },
      },
      {
        // GitHub shows the "Footnotes" heading; Sätteri renders it for screen readers only.
        filter: ['h2'],
        visit(/** @type {HastNode} */ node, /** @type {Ctx} */ ctx) {
          if (node.properties?.id !== 'footnote-label') return;
          ctx.setProperty(node, 'className', ['md-footnotes__label']);
        },
      },
    ],
  };
}

// ── heading anchors (outside Starlight) ─────────────────────────────────────────────────────────────

const ANCHOR_ICON =
  'm12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z';

/**
 * Ids (github-slugger, the same algorithm and order as Astro's own pass, which keeps ids already set) and a link
 * after each h2–h6. Same structure as Starlight's: the heading and the link side by side in a wrapper, so the
 * heading's text (and the table of contents built from it) stays clean.
 */
export function headingLinksPlugin() {
  const slugger = new Slugger();
  return {
    name: 'project-site-heading-links',
    element: {
      filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      visit(/** @type {HastNode} */ node, /** @type {Ctx} */ ctx) {
        const existing = node.properties?.id;
        const id = typeof existing === 'string' && existing ? existing : slugger.slug(ctx.textContent(node));
        if (id !== existing) ctx.setProperty(node, 'id', id);
        if (node.tagName === 'h1' || id === 'footnote-label') return;
        const label = ctx.textContent(node).trim();
        return el('div', { className: ['md-heading', `md-heading--${node.tagName}`] }, [
          node,
          el('a', { className: ['md-heading__anchor'], href: `#${id}` }, [
            el('svg', { viewBox: '0 0 24 24', width: '16', height: '16', 'aria-hidden': 'true' }, [el('path', { d: ANCHOR_ICON, fill: 'currentColor' })]),
            el('span', { className: ['sr-only', 'md-sr-only'], 'data-pagefind-ignore': '' }, [text(`Section titled “${label}”`)]),
          ]),
        ]);
      },
    },
  };
}

// ── the set ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * The hast plugins, split by where they must run: `first` before every other plugin (Expressive Code would
 * otherwise turn mermaid/math blocks into code), `rest` anywhere.
 * @param {PluginOptions} opts
 */
export function markdownPlugins(opts) {
  const { features } = opts;
  /** @type {any[]} */
  const first = features.math || features.mermaid ? [blocksPlugin(opts)] : [];
  /** @type {any[]} */
  const rest = [tablesAndFootnotesPlugin()];
  if (features.alerts) rest.push(alertsPlugin());
  if (features.emoji) rest.push(emojiPlugin());
  if (features.headingLinks) {
    rest.push((/** @type {{ fileURL?: URL }} */ doc) => (opts.isStarlightFile(doc.fileURL) ? null : headingLinksPlugin()));
  }
  return { first, rest };
}
