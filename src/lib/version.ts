// Reads the version the site shows in its header, from `site.versionFrom` (a package.json path relative to
// the site root). Runs at build time only.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import site from '../../site.config';

let cached: string | undefined | null = null;

/** The `version` field of `site.versionFrom`, or `undefined` if unset or unreadable. */
export function projectVersion(): string | undefined {
  if (cached !== null) return cached;
  cached = undefined;
  if (!site.versionFrom) return cached;
  const file = resolve(process.cwd(), site.versionFrom);
  try {
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown };
    if (typeof pkg.version === 'string') cached = pkg.version;
    else console.warn(`[site] ${site.versionFrom} has no "version" field; the header shows no version.`);
  } catch (error) {
    console.warn(`[site] Could not read versionFrom (${file}): ${(error as Error).message}`);
  }
  return cached;
}
