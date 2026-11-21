// Public components: `import { Live, Hero, BaseLayout } from 'astro-project-site/components'`.
// These are always the built-in versions; the `components` option swaps what the injected pages render.

// Live examples
export { default as Live } from './live/Live.astro';

// Page frame and chrome
export { default as BaseLayout } from './layouts/BaseLayout.astro';
export { default as SiteHead } from './chrome/SiteHead.astro';
export { default as SiteHeader } from './chrome/SiteHeader.astro';
export { default as SiteFooter } from './chrome/SiteFooter.astro';
export { default as ThemeSelect } from './chrome/ThemeSelect.astro';

// Landing page sections
export { default as Landing } from './landing/Landing.astro';
export { default as Hero } from './landing/Hero.astro';
export { default as Section } from './landing/Section.astro';
export { default as Features } from './landing/Features.astro';
export { default as Steps } from './landing/Steps.astro';
export { default as GalleryStrip } from './landing/GalleryStrip.astro';
export { default as CallToAction } from './landing/CallToAction.astro';
export { default as InstallCommand } from './landing/InstallCommand.astro';

// Docs
export { default as ChildCards } from './docs/ChildCards.astro';

// Gallery
export { default as GalleryPage } from './gallery/GalleryPage.astro';
export { default as GalleryGrid } from './gallery/GalleryGrid.astro';
export { default as GalleryCard } from './gallery/GalleryCard.astro';
export { default as GalleryFilters } from './gallery/GalleryFilters.astro';

// Blog
export { default as BlogIndex } from './blog/BlogIndex.astro';
export { default as BlogPost } from './blog/BlogPost.astro';
export { default as BlogCard } from './blog/BlogCard.astro';
export { default as BlogTags } from './blog/BlogTags.astro';
export { default as PostMeta } from './blog/PostMeta.astro';
export { default as TagList } from './blog/TagList.astro';
export { default as LatestPosts } from './blog/LatestPosts.astro';

// Writing: side notes for posts and docs pages
export { default as MarginNote } from './blog/MarginNote.astro';

// Helpers
export { galleryItems, distinct } from '../lib/gallery';
export { blogPosts, postInfo } from '../blog/data';
export { readingTime, tagSlug, formatDate } from '../blog/posts.mjs';
export { activeHref, isActive, isExternal } from '../lib/nav';

export type * from './live/types';
export type {
  GalleryEntry,
  GalleryData,
  LinkAction,
  Feature,
  Step,
  BlogEntry,
  BlogPostData,
  BlogAuthor,
  BlogIndexProps,
  BlogPostProps,
  BlogPostInfo,
} from '../index';
