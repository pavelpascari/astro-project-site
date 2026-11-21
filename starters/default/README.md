# My Project — website

Built with [astro-project-site](https://github.com/pavelpascari/astro-project-site): a landing page, Starlight docs
that mount the project's markdown, live examples, a gallery, static apps served as they are, and Cloudflare deploys.

```bash
npm install
npm run dev            # http://localhost:4321
npm run build          # astro check + build into dist/ + docs:check
npm run cf:dev         # the built site on Cloudflare's local runtime
npm run deploy         # production (after `npx wrangler login`)
```

| file | what it is |
|---|---|
| `astro.config.mjs` | everything about the site: `projectSite({ ... })` |
| `src/content/docs/docs/` | docs pages (`.md`/`.mdx`), served under `/docs/` |
| `src/content/gallery/` | one file per gallery item |
| `example/` | stand-ins for your project's docs and apps: point `externalDocs` and `mirrors` at the real ones |
| `docs-gen.config.mjs` | generated blocks in markdown (`npm run docs:gen`) |
| `wrangler.jsonc`, `public/_headers` | Cloudflare Workers deploy; set `name` |
| `.github/workflows/site.yml` | Optional CI, copied by `init --ci`: checks, a preview per PR, production on `v*` tags |
