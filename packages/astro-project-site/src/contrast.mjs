// WCAG 2.2 contrast for the theme's colour pairs: text on the page and on panels, links, buttons, focus rings and
// code. Used by the tests (the shipped theme, both modes) and at build time, to warn when a `theme.accent` makes a
// pair too faint. Parses hex, rgb() and hsl(); anything else (a named colour, oklch(), a var()) is not checked.

/** @typedef {[number, number, number]} RGB channels 0..1, sRGB */

/** @returns {RGB | undefined} */
export function parseColor(/** @type {string} */ input) {
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) hex = [...hex.slice(0, 3)].map((c) => c + c).join('');
    if (hex.length !== 6 && hex.length !== 8) return undefined;
    return /** @type {RGB} */ ([0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));
  }
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/.exec(s);
  if (m) return /** @type {RGB} */ (m.slice(1, 4).map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / 255)));
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(s);
  if (m) {
    const [h, sat, l] = [parseFloat(m[1]) / 360, parseFloat(m[2]) / 100, parseFloat(m[3]) / 100];
    const f = (/** @type {number} */ n) => {
      const k = (n + h * 12) % 12;
      return l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)];
  }
  return undefined;
}

const toLinear = (/** @type {number} */ c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (/** @type {number} */ c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** Relative luminance (WCAG). */
export function luminance(/** @type {RGB} */ [r, g, b]) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Contrast ratio, 1..21. */
export function contrast(/** @type {RGB} */ a, /** @type {RGB} */ b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB → OKLab. */
function toOklab(/** @type {RGB} */ rgb) {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → sRGB (clamped). */
function fromOklab(/** @type {number[]} */ [L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return /** @type {RGB} */ (rgb.map((c) => Math.min(1, Math.max(0, toGamma(c)))));
}

/** `color-mix(in oklab, a p, b)`, p in 0..1. */
export function mixOklab(/** @type {RGB} */ a, /** @type {number} */ p, /** @type {RGB} */ b) {
  const [x, y] = [toOklab(a), toOklab(b)];
  return fromOklab(x.map((v, i) => v * p + y[i] * (1 - p)));
}

/** WCAG 2.2 minimums: 4.5 for body text (1.4.3), 3 for focus rings and other UI parts (1.4.11). */
export const TEXT = 4.5;
export const UI = 3;

/**
 * The pairs that matter in one theme mode, with their ratios. `tokens` are the brand tokens of theme.css
 * (`accent`, `bg`, `surface`, `text`, `muted`, `codeBg`, `codeText`); derived ones are computed as theme.css does.
 * Pairs with a colour that cannot be parsed are left out.
 * @param {Record<'accent' | 'bg' | 'surface' | 'text' | 'muted' | 'codeBg' | 'codeText', string>} tokens
 */
export function themePairs(tokens) {
  /** @type {Record<string, RGB | undefined>} */
  const c = Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, parseColor(v)]));
  const { accent, bg, surface, text } = c;
  // Derived tokens, as in theme.css.
  const link = accent && text ? mixOklab(accent, 0.7, text) : undefined; // --site-accent-strong
  const soft = accent && bg ? mixOklab(accent, 0.16, bg) : undefined; // --site-accent-soft
  /** @type {[string, RGB | undefined, RGB | undefined, number][]} */
  const pairs = [
    ['text on the page', c.text, bg, TEXT],
    ['text on panels', c.text, surface, TEXT],
    ['secondary text on the page', c.muted, bg, TEXT],
    ['secondary text on panels', c.muted, surface, TEXT],
    ['links on the page', link, bg, TEXT],
    ['links on panels', link, surface, TEXT],
    ['text on the current nav item', c.text, soft, TEXT],
    ['primary button text', bg, accent, TEXT],
    ['focus ring against the page', accent, bg, UI],
    ['focus ring against panels', accent, surface, UI],
    ['code', c.codeText, c.codeBg, TEXT],
  ];
  return pairs
    .filter(([, fg, back]) => fg && back)
    .map(([name, fg, back, min]) => ({ name, ratio: contrast(/** @type {RGB} */ (fg), /** @type {RGB} */ (back)), min }));
}

/** The shipped theme's brand tokens, both modes (keep in sync with styles/theme.css; a test checks). */
export const THEME = Object.freeze({
  dark: { accent: '#8b9cff', bg: '#111318', surface: '#1a1d24', text: '#e8e9ee', muted: '#a0a4b0', codeBg: '#0b0d11', codeText: '#e8e9ee' },
  light: { accent: '#3b4fd8', bg: '#ffffff', surface: '#f6f7f9', text: '#1b1d23', muted: '#5b6070', codeBg: '#1b1d23', codeText: '#e8e9ee' },
});

/**
 * Warnings for a `theme` option: the pairs its accents make too faint against the shipped theme.
 * @param {{ accent?: string, accentDark?: string }} theme
 * @returns {string[]}
 */
export function accentWarnings(theme) {
  /** @type {string[]} */
  const out = [];
  const modes = /** @type {const} */ ([
    ['dark', theme.accentDark ?? theme.accent, theme.accentDark ? 'theme.accentDark' : 'theme.accent'],
    ['light', theme.accent, 'theme.accent'],
  ]);
  for (const [mode, accent, option] of modes) {
    if (!accent) continue;
    if (!parseColor(accent)) continue;
    for (const p of themePairs({ ...THEME[mode], accent })) {
      if (p.ratio < p.min && /link|button|focus|nav item/.test(p.name)) {
        out.push(`${option} ${accent} in the ${mode} theme: ${p.name} ${p.ratio.toFixed(2)}:1, below ${p.min}:1 (WCAG 2.2 AA).`);
      }
    }
  }
  return out;
}
