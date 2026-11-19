// OWNER: docs agent. Returns the Starlight options (sidebar, plugins, remark plugins, component overrides).
export function docsStarlight(site) {
  return {
    title: site.name,
    social: [{ icon: 'github', label: 'GitHub', href: site.repo }],
    components: { Header: './src/components/chrome/StarlightHeader.astro' },
    customCss: ['./src/styles/tokens.css'],
  };
}
