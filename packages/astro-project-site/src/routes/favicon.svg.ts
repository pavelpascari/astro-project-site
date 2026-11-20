// Fallback favicon when the project has none in public/: the first letter of the project name on the accent colour.
import type { APIRoute } from 'astro';
import site from 'virtual:astro-project-site/config';

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const GET: APIRoute = () => {
  const letter = escape(([...site.name.trim()][0] ?? '•').toUpperCase());
  const light = site.theme?.accent ?? '#3b4fd8';
  const dark = site.theme?.accentDark ?? site.theme?.accent ?? '#8b9cff';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<style>rect{fill:${escape(light)}}text{fill:#fff}@media (prefers-color-scheme:dark){rect{fill:${escape(dark)}}text{fill:#111318}}</style>
<rect width="32" height="32" rx="7"/>
<text x="16" y="22.5" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="19" font-weight="700">${letter}</text>
</svg>
`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
};
