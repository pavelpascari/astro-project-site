// Turns the `theme` option into a tiny inline stylesheet that overrides the brand tokens in styles/theme.css.
import config from 'virtual:astro-project-site/config';

/**
 * CSS overriding `--site-accent` from the `theme` option, or an empty string when nothing is configured.
 * Selectors carry an extra type selector so they win over theme.css regardless of stylesheet order.
 */
export function themeOverrideCss(): string {
  const { accent, accentDark } = config.theme ?? {};
  const rules: string[] = [];
  const dark = accentDark ?? accent;
  if (dark) rules.push(`html:root{--site-accent:${dark}}`);
  if (accent) rules.push(`html:root[data-theme='light']{--site-accent:${accent}}`);
  return rules.join('');
}
