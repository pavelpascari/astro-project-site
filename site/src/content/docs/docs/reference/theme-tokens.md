---
title: Theme tokens
description: The --site-* CSS custom properties every page (docs included) is styled from, with their default values.
sidebar:
  order: 6
---

From `astro-project-site/theme.css`, which every page loads. Override brand tokens in a
[`customCss`](/docs/guides/theming/) file; Starlight's `--sl-color-*` palette, fonts and nav height are mapped
from them, so the docs follow.

<!-- gen:tokens -->
**Brand tokens** (override these):

| Token | Dark (default) | Light |
|---|---|---|

**Derived tokens** (computed from the brand tokens; usually leave alone):

| Token | Value | Light |
|---|---|---|
| `--site-accent` | `#8b9cff` | `#3b4fd8` |
| `--site-bg` | `#111318` | `#ffffff` |
| `--site-surface` | `#1a1d24` | `#f6f7f9` |
| `--site-text` | `#e8e9ee` | `#1b1d23` |
| `--site-muted` | `#a0a4b0` | `#5b6070` |
| `--site-border` | `#2b2f3a` | `#dfe2e8` |
| `--site-code-bg` | `#0b0d11` | `#1b1d23` |
| `--site-code-text` | `#e8e9ee` | `#e8e9ee` |
| `--site-font-body` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif` | same |
| `--site-font-heading` | `var(--site-font-body)` | same |
| `--site-font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace` | same |
| `--site-radius` | `0.75rem` | same |
| `--site-space` | `1rem` | same |
| `--site-max-width` | `72rem` | same |
| `--site-header-height` | `3.5rem` | same |
| `--site-accent-soft` | `color-mix(in oklab, var(--site-accent) 16%, var(--site-bg))` | same |
| `--site-accent-strong` | `color-mix(in oklab, var(--site-accent) 70%, var(--site-text))` | same |
| `--site-on-accent` | `var(--site-bg)` | same |
| `--site-link` | `var(--site-accent-strong)` | same |
| `--site-focus` | `var(--site-accent)` | same |
| `--site-radius-sm` | `calc(var(--site-radius) / 2)` | same |
| `--site-shadow` | `0 1px 2px rgb(0 0 0 / 0.12), 0 4px 12px rgb(0 0 0 / 0.08)` | same |
<!-- /gen -->

The `theme` option's `accent` / `accentDark` set `--site-accent` for the light / dark theme with a more specific
selector (`html:root…`), so they win over a `customCss` value for that one token.
