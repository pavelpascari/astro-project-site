// Reading the gallery collection in display order.
import { getCollection, type CollectionEntry } from 'astro:content';

export type GalleryItem = CollectionEntry<'gallery'>;

/** Published gallery items sorted by `order`, then title. */
export async function galleryItems(): Promise<GalleryItem[]> {
  const items = await getCollection('gallery', ({ data }) => !data.draft);
  return items.sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
}

/** Distinct values of `pick` across items, in first-seen order. */
export function distinct(items: GalleryItem[], pick: (item: GalleryItem) => string[]): string[] {
  return [...new Set(items.flatMap(pick))];
}
