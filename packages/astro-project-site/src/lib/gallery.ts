// Reading the gallery collection (defined by projectSiteCollections()) in display order.
import { getCollection } from 'astro:content';
import type { GalleryEntry } from '../index';

/** Published gallery items sorted by `order`, then title. */
export async function galleryItems(): Promise<GalleryEntry[]> {
  // The collection belongs to the project's content config, so its name is not in this package's types.
  const items = (await (getCollection as (name: string) => Promise<GalleryEntry[]>)('gallery')).filter((i) => !i.data.draft);
  return items.sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
}

/** Distinct values of `pick` across items, in first-seen order. */
export function distinct(items: GalleryEntry[], pick: (item: GalleryEntry) => string[]): string[] {
  return [...new Set(items.flatMap(pick))];
}
