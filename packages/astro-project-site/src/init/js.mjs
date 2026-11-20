// Writes JavaScript source for generated config files: values as readable literals (single quotes, bare keys,
// short objects on one line, multi-line strings as template literals) and objects with a comment per property.

const IDENT = /^[A-Za-z_$][\w$]*$/;

/**
 * Text that is safe inside a `//` line comment (or a block comment): every line terminator JavaScript knows
 * (\n, \r, U+2028, U+2029) becomes a space, so repository-derived text can never end the comment and become
 * code; `*\/` is broken up for block comments. Every comment the generator writes goes through this.
 */
export function comment(/** @type {string} */ s) {
  return String(s).replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\*\//g, '* /');
}

/** A string literal: single-quoted, or a template literal when it spans lines. */
export function str(/** @type {string} */ s) {
  if (s.includes('\n')) {
    return `\`${s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${').replace(/\r/g, '\\r').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}\``;
  }
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}'`;
}

const key = (/** @type {string} */ k) => (IDENT.test(k) ? k : str(k));

/**
 * A property whose value is written with a comment above it, or commented out (`off`).
 * @typedef {{ comment?: string | string[], off?: boolean }} Note
 */
const NOTE = Symbol('note');

/** Attaches a comment (and optionally comments the property out) to a value inside an object passed to lit(). */
export function note(/** @type {unknown} */ value, /** @type {Note} */ n) {
  return { [NOTE]: n, value };
}

const isNoted = (/** @type {any} */ v) => v && typeof v === 'object' && NOTE in v;

/**
 * A JS literal for `value` at indentation `depth` (two spaces each). Undefined properties are left out.
 * @returns {string}
 */
export function lit(/** @type {unknown} */ value, depth = 0, width = 112) {
  const pad = '  '.repeat(depth);
  if (typeof value === 'string') return str(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
  if (Array.isArray(value)) {
    const items = value.filter((v) => v !== undefined);
    const inline = /** @type {string} */ (`[${items.map((v) => lit(v, depth, Infinity)).join(', ')}]`);
    if (!items.some(isNoted) && !inline.includes('\n') && pad.length + inline.length <= width) return inline;
    return `[\n${items.map((v) => `${pad}  ${lit(v, depth + 1, width)},`).join('\n')}\n${pad}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(/** @type {Record<string, unknown>} */ (value)).filter(([, v]) => v !== undefined);
    const anyNote = entries.some(([, v]) => isNoted(v));
    if (!anyNote) {
      /** @type {string} */
      const inline = entries.length ? `{ ${entries.map(([k, v]) => `${key(k)}: ${lit(v, depth, Infinity)}`).join(', ')} }` : '{}';
      if (!inline.includes('\n') && pad.length + inline.length <= width) return inline;
    }
    const lines = [];
    for (const [k, raw] of entries) {
      const n = isNoted(raw) ? /** @type {any} */ (raw)[NOTE] : {};
      const v = isNoted(raw) ? /** @type {any} */ (raw).value : raw;
      for (const c of [n.comment ?? []].flat()) lines.push(`${pad}  // ${comment(c)}`);
      if (v === undefined) continue;
      /** @type {string} */
      const line = `${key(k)}: ${lit(v, depth + 1, width)},`;
      lines.push(n.off ? line.split('\n').map((l, i) => `${pad}  // ${i ? l.slice(pad.length + 2) : l}`).join('\n') : `${pad}  ${line}`);
    }
    return `{\n${lines.join('\n')}\n${pad}}`;
  }
  throw new TypeError(`lit(): cannot write ${typeof value}`);
}
