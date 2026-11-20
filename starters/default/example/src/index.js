// Stand-in for a framework's source: scripts/docs-gen.mjs documents these exports into example/docs/api.md.

/** Returns a greeting for `name`. */
export function greet(name) {
  return `Hello, ${name}!`;
}

/** The library version. */
export const version = '0.1.0';

/** Formats a list of names as one greeting. */
export function greetAll(names) {
  return names.map(greet).join(' ');
}
