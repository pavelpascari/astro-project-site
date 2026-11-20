// Theme playground presets. `signal` is this site's own theme: keep it in step with src/styles/brand.css and the
// `theme` option in astro.config.mjs (the playground starts from it, so "Reset" means "this site").
export interface Palette {
  label: string;
  dark: Record<string, string>;
  light: Record<string, string>;
}

export const palettes: Record<string, Palette> = {
  signal: {
    label: 'Signal (this site)',
    dark: {
      '--site-accent': '#ff7a4d',
      '--site-bg': '#0f1013',
      '--site-surface': '#17181c',
      '--site-text': '#eeebe3',
      '--site-muted': '#a8a49a',
      '--site-border': '#2c2d33',
      '--site-radius': '0.5rem',
    },
    light: {
      '--site-accent': '#b93b0e',
      '--site-bg': '#f6f4ee',
      '--site-surface': '#ece9e0',
      '--site-text': '#17181b',
      '--site-muted': '#5b584f',
      '--site-border': '#d6d1c4',
    },
  },
  moss: {
    label: 'Moss',
    dark: {
      '--site-accent': '#a3d977',
      '--site-bg': '#0e130f',
      '--site-surface': '#151c16',
      '--site-text': '#e6efe3',
      '--site-muted': '#9db09a',
      '--site-border': '#253027',
      '--site-radius': '1rem',
    },
    light: {
      '--site-accent': '#3d6b1c',
      '--site-bg': '#f5f7f0',
      '--site-surface': '#e9eee0',
      '--site-text': '#18210f',
      '--site-muted': '#53604a',
      '--site-border': '#d3dbc6',
    },
  },
  ink: {
    label: 'Ink',
    dark: {
      '--site-accent': '#8fb1ff',
      '--site-bg': '#0a0c12',
      '--site-surface': '#121621',
      '--site-text': '#e6e9f2',
      '--site-muted': '#98a0b5',
      '--site-border': '#242a3a',
      '--site-radius': '2px',
    },
    light: {
      '--site-accent': '#1f43c9',
      '--site-bg': '#ffffff',
      '--site-surface': '#f2f4f9',
      '--site-text': '#0e1222',
      '--site-muted': '#4f5872',
      '--site-border': '#dce1ec',
    },
  },
  plum: {
    label: 'Plum',
    dark: {
      '--site-accent': '#e79bff',
      '--site-bg': '#140f18',
      '--site-surface': '#1d1623',
      '--site-text': '#f1e9f4',
      '--site-muted': '#b2a3b9',
      '--site-border': '#33283b',
      '--site-radius': '1.25rem',
    },
    light: {
      '--site-accent': '#8a2aa6',
      '--site-bg': '#fbf7fc',
      '--site-surface': '#f2eaf4',
      '--site-text': '#22152a',
      '--site-muted': '#65566c',
      '--site-border': '#e2d5e6',
    },
  },
};

/** The customCss text for a palette, in the shape the README documents. */
export function paletteCss(p: Palette): string {
  const decls = (tokens: Record<string, string>) =>
    Object.entries(tokens)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
  return `/* customCss: ['./src/styles/brand.css'] */\n:root {\n${decls(p.dark)}\n}\n:root[data-theme='light'] {\n${decls(p.light)}\n}`;
}
