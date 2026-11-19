# astro-project-site

A site template for open-source libraries and frameworks: a landing page, Starlight docs that can mount the
project's own markdown folder, live examples, a gallery, static tool pages served as they are, and Cloudflare
deploys with a preview per pull request. Astro 7 + Starlight 0.43, MIT.

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # astro check + build into dist/
npm run docs:check   # generated blocks in markdown are up to date
npm run cf:dev       # the built site on Cloudflare's local runtime
```

## Make it yours

Edit `site.config.ts`: name, tagline, URL, repo, navigation, landing content, theme accent, and:

| field | what it does |
|---|---|
| `externalDocs` | mounts a markdown folder (e.g. your framework's `docs/`) under `/docs/<route>/`: titles from the first heading, `.md` links rewritten, files outside the mount linked on GitHub |
| `mirrors` | copies static apps (plain HTML/JS, e.g. a playground or demos) into the site with their folder layout kept |
| `versionFrom` | the `package.json` whose version the header shows |

Then set `name` in `wrangler.jsonc`. Every area documents itself in the site, under **Docs → Template**:

| area | files | docs page |
|---|---|---|
| docs pipeline | `integrations/docs.mjs`, `src/docs/`, `scripts/docs-gen.mjs`, `docs-gen.config.mjs` | `/docs/template/docs/` |
| live examples | `src/components/live/` | `/docs/template/live-examples/` |
| landing, gallery, theme | `src/pages/`, `src/components/{landing,gallery,chrome}/`, `src/styles/`, `src/lib/` | `/docs/template/landing-and-gallery/` |
| mirrors, deploys, CI | `integrations/mirror.mjs`, `wrangler.jsonc`, `public/_headers`, `.github/workflows/` | `/docs/template/deploy/` |

`example/` holds stand-ins for a real project's docs and apps; replace it.

## Licences

Every dependency is free software. All are MIT, ISC, BSD, Apache-2.0 or similar, except two build-time tools pulled
in by Astro and Vite, neither of which ends up in the built site: Lightning CSS (MPL-2.0) and libvips via sharp
(LGPL-3.0). No satori/resvg: social images are a hook (`ogImage`, `src/lib/og.ts`) so a project can render its own.
