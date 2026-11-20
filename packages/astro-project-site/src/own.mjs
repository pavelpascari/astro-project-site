import { fileURLToPath } from 'node:url';

/** Absolute path of a file in this package's src/ folder. */
export const own = (/** @type {string} */ rel) => fileURLToPath(new URL(rel, import.meta.url));
