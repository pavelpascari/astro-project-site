// Injected at /<blog.route>/rss.xml when the `blog` option is on and `blog.rss` is not false: an RSS 2.0 feed of
// every published post. Items carry the title, the absolute link, the date, the description as a summary (not the
// full text: MDX posts can hold live examples and components that a feed reader cannot run), the tags as
// categories and the authors as <dc:creator>.
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import site from 'virtual:astro-project-site/config';
import { blogOptions, blogPosts } from '../../blog/data';
import { rssItems } from '../../blog/posts.mjs';

export const GET: APIRoute = async (context) => {
  const blog = blogOptions();
  const siteUrl = (context.site?.href ?? site.url).replace(/\/+$/, '');
  const posts = await blogPosts({ drafts: false });
  return rss({
    title: `${site.name}: ${blog.title}`,
    description: blog.description,
    site: `${siteUrl}/${blog.route}/`,
    items: rssItems(posts, { route: blog.route, siteUrl, authors: blog.authors }),
    xmlns: { dc: 'http://purl.org/dc/elements/1.1/', atom: 'http://www.w3.org/2005/Atom' },
    customData: [
      `<language>${site.lang}</language>`,
      `<atom:link href="${siteUrl}/${blog.route}/rss.xml" rel="self" type="application/rss+xml"/>`,
    ].join(''),
    trailingSlash: true,
  });
};
