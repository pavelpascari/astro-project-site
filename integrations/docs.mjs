// OWNER: docs agent. Returns the Starlight options (sidebar, plugins, remark plugins, component overrides).
import { fileURLToPath } from 'node:url';
import starlightLinksValidator from 'starlight-links-validator';
import { buildSidebar, editBaseUrl, resolveProject } from '../src/docs/mount.mjs';

/** Site root: the folder holding site.config.ts and this integrations/ folder. */
const root = fileURLToPath(new URL('../', import.meta.url));

export function docsStarlight(site) {
  const project = resolveProject(site, root);
  const editBase = editBaseUrl(project);
  return {
    title: site.name,
    description: site.tagline,
    social: [{ icon: 'github', label: 'GitHub', href: site.repo }],
    components: { Header: './src/components/chrome/StarlightHeader.astro' },
    customCss: ['./src/styles/tokens.css'],
    sidebar: buildSidebar(project),
    // Starlight's markdown features (heading anchors, asides, ...) only run on folders it knows about.
    markdown: { processedDirs: project.mounts.map((m) => m.dir) },
    // Local pages: <repo>/edit/<branch>/<site folder>/src/content/docs/...; external pages carry their own editUrl.
    ...(editBase ? { editLink: { baseUrl: editBase } } : {}),
    // Fails `astro build` on a broken internal link or #anchor in any docs page (local or external).
    plugins: [starlightLinksValidator()],
  };
}
