// Starlight route middleware:
// - gives every docs page the same social image as the rest of the site, from the `ogImage` option or the
//   `ogImageFor` hook, and upgrades the Twitter card to a large image when there is one;
// - renders the built-in 404 entry (docs/loader.ts) without a draft notice: it is a draft only so that Starlight
//   does not also build it at /404/.
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import config from 'virtual:astro-project-site/config';
import ogImageFor from 'virtual:astro-project-site/og';

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  if (route.entry.id === '404' && !route.entry.filePath && route.entry.data.draft) {
    route.entry = { ...route.entry, data: { ...route.entry.data, draft: false } };
  }
  const { title, description } = route.entry.data;
  const image = ogImageFor({ path: context.url.pathname, title, description: description ?? config.tagline });
  if (!image) return;
  const href = new URL(image, context.site ?? config.url).href;
  const head = route.head.filter((h) => !(h.tag === 'meta' && (h.attrs?.property === 'og:image' || h.attrs?.name === 'twitter:card')));
  head.push(
    { tag: 'meta', attrs: { property: 'og:image', content: href }, content: '' },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, content: '' },
  );
  route.head = head;
});
