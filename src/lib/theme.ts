// Turns `site.theme` into a tiny inline stylesheet that overrides the brand tokens in src/styles/tokens.css.
import site from '../../site.config';

/**
 * CSS overriding `--site-accent` from site.config, or an empty string when nothing is configured.
 * Selectors carry an extra type selector so they win over tokens.css regardless of stylesheet order.
 */
export function themeOverrideCss(): string {
  const { accent, accentDark } = site.theme ?? {};
  const rules: string[] = [];
  const dark = accentDark ?? accent;
  if (dark) rules.push(`html:root{--site-accent:${dark}}`);
  if (accent) rules.push(`html:root[data-theme='light']{--site-accent:${accent}}`);
  return rules.join('');
}
