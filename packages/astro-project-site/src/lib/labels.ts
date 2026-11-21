// The site's labels for components: `t('copy')`, `t('pagesMatch', { n: 3 })`. See src/labels.mjs.
import site from 'virtual:astro-project-site/config';
import { format, resolveLabels } from '../labels.mjs';
import type { Labels } from '../index';

type Translate = (name: keyof Labels, vars?: Record<string, string | number>) => string;

const translators = new Map<string, Translate>();

/**
 * The labels for one language. The site's own language (`site.lang`) gets the resolved labels, `labels` overrides
 * included; another locale of a multilingual docs site gets its built-in translation (or English).
 */
export function labelsFor(lang: string = site.lang): Labels {
  return lang.toLowerCase() === site.lang.toLowerCase() ? site.labels : resolveLabels(lang);
}

/** `t()` for one language (see labelsFor). */
export function translator(lang: string = site.lang): Translate {
  const key = lang.toLowerCase();
  let fn = translators.get(key);
  if (!fn) {
    const labels = labelsFor(lang);
    fn = (name, vars = {}) => format(labels[name], vars, lang);
    translators.set(key, fn);
  }
  return fn;
}

/** A label in the site's language, placeholders filled (`n` also picks the plural form). */
export const t: Translate = (name, vars) => translator()(name, vars);

/** The gallery page's path (`/gallery/`), or undefined without a gallery. */
export function galleryHref(): string | undefined {
  return site.gallery ? `/${site.gallery.route}/` : undefined;
}
