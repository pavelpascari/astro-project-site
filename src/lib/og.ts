// The social-preview image hook. Landing and gallery pages ask this function which image to advertise.
//
// By default every page uses `site.ogImage` (a static file in public/). A project that renders its own
// images (for example with an endpoint at src/pages/og/[...slug].png.ts, or images made at release time)
// edits this function to return a per-page URL instead; nothing else needs to change.
import site from '../../site.config';

export interface OgImageRequest {
  /** Path of the page being rendered, e.g. `/gallery/`. */
  path: string;
  title: string;
  description: string;
}

/** Absolute or root-relative URL of the image for this page, or `undefined` for none. */
export function ogImageFor(_page: OgImageRequest): string | undefined {
  return site.ogImage;
}
