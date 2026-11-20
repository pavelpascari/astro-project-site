---
title: Live and runners
description: The <Live> component's props and the contract for custom runner modules (LiveRunner, LiveContext).
sidebar:
  order: 3
---

How-to with running examples: [Live examples](/docs/guides/live-examples/).

## Live props

Defaults come from `Live.astro`.

<!-- gen:interface name=LiveProps defaults=components/live/Live.astro -->
| Field | Type | Default | Required | Description |
|---|---|---|---|---|
| `code` | `string` |  |  | The example's source. Omit it to use the fenced code block written as the component's child (MDX). |
| `lang` | `string` | `runner ? 'json' : 'html'` |  | Language of `code` for highlighting. Default: `html`, or `json` when a `runner` is set. |
| `title` | `string` |  |  | Title shown in the code frame (with `code`; for a fenced child use ```html title="…"). |
| `caption` | `string` |  |  | Caption under the example. |
| `id` | `string` | (computed) |  | Stable id and anchor (#id). Default: derived from caption or title, else from the source. |
| `mode` | `LiveMode` | `'inline'` |  | `inline` renders into the page; `iframe` renders in an isolated, auto-sized iframe. Default `inline`. |
| `preview` | `LivePreviewPosition` | `'above'` |  | Where the preview sits relative to the code. `side` falls back to stacked on narrow widths. Default `above`. |
| `editable` | `boolean` | `false` |  | Make the code editable; edits re-run the example (debounced) and a Reset button restores it. |
| `runner` | `string` |  |  | URL of a module exporting `run(source, mount, ctx)`. Without it the source is HTML and is rendered as-is. |
| `options` | `Record<string, unknown>` |  |  | Passed to the runner as `ctx.options`. Must be JSON-serialisable. |
| `modules` | `string[]` |  |  | Module URLs to load before the example runs (inline: once per page; iframe: in the iframe's head). |
| `head` | `string` |  |  | Extra HTML for the iframe's &lt;head> (styles, scripts, import maps). iframe mode only. |
| `base` | `string` |  |  | Base URL for relative paths inside the iframe (&lt;base href>). iframe mode only; passed to runners as ctx.base. |
| `sandbox` | `string` | (computed) |  | iframe sandbox tokens. Default `allow-scripts allow-same-origin allow-popups allow-forms allow-modals`. |
| `height` | `number \| string` |  |  | Minimum preview height (number = px, or any CSS length). Also the iframe's height before it measures itself. |
| `lazy` | `boolean` | `false` |  | Start only when scrolled near the viewport. |
| `debounce` | `number` | `300` |  | Debounce for re-running edits, in ms. Default 300. |
| `class` | `string` |  |  | Extra class on the root element. |
<!-- /gen -->

Either `code` or a fenced code block as the only child (MDX, with blank lines around it) is required; without
either the build fails with "`<Live>` needs its code".

## Runner modules

A runner is a plain ES module served as a static file (from `public/` or a [mirror](/docs/guides/mirrors/)), not
bundled by Astro. It exports one function:

```ts
export type LiveRunner = (source: string, mount: HTMLElement, ctx: LiveContext) => LiveRunResult;
export type LiveRunResult = void | (() => void) | Promise<void | (() => void)>;
```

- `source` is the code as shown, or as the reader edited it.
- `mount` is an empty element. In inline mode it is a fresh `div` in the page; in iframe mode a `div` in the
  iframe's `#live-root`.
- Throw (or reject) to show the error under the preview. The previous good render stays on screen.
- Return a cleanup function (or a promise of one). It runs before the next run and when the example is removed.
- The module must export `run`; otherwise the example shows "… does not export run(source, mount, ctx)".
- It is loaded once per page (inline) or once per iframe. In iframe mode later runs reuse the loaded module.

### When a runner re-runs

- after an edit (debounced by `debounce`) or Reset;
- when the page theme changes (`ctx.theme`);
- when `prefers-reduced-motion` changes (`ctx.reducedMotion`);
- when the element is moved in the DOM.

The previous run's `ctx.signal` is aborted and its cleanup called first.

## LiveContext

<!-- gen:interface name=LiveContext -->
| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | The example's id (also its anchor on the page). |
| `mode` | `LiveMode` | yes | Where the example renders: in the page, or inside its own iframe. |
| `options` | `Record<string, unknown>` | yes | The `options` prop, as given (JSON-serialisable). |
| `reducedMotion` | `boolean` | yes | `prefers-reduced-motion: reduce` at the time of this run. The example re-runs when it changes. |
| `theme` | `'light' \| 'dark'` | yes | The page theme, from Starlight's `data-theme` (or the OS preference outside Starlight). |
| `base` | `string` | yes | Base URL relative paths should resolve against (the `base` prop, else the page URL). |
| `signal` | `AbortSignal` | yes | Aborted when this run is replaced (edit, reset, theme or motion change) or the example is removed. |
| `status()` | `(message: string, level?: LiveStatusLevel) => void` | yes | Show a one-line status under the preview (`error` is styled as an error but does not throw). |
<!-- /gen -->

`LiveStatusLevel` is `'ok' | 'info' | 'warn' | 'error'`. A status set from an outdated run is ignored.

Types: `import type { LiveRunner, LiveContext } from 'astro-project-site'` (also exported from
`astro-project-site/components`). In a plain `.js` runner use JSDoc:

```js
/** @type {import('astro-project-site').LiveRunner} */
export const run = (source, mount, ctx) => { /* … */ };
```
