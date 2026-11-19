// Public types for <Live> and for custom runner modules.
//
// A runner is a plain ES module served as a static file (not bundled by Astro), for example
// example/apps/live-assets/engine.js. It exports one function:
//
//   /** @param {string} source @param {HTMLElement} mount @param {import('…/types').LiveContext} ctx */
//   export function run(source, mount, ctx) { … ; return () => cleanup(); }

export type LiveMode = 'inline' | 'iframe';
export type LivePreviewPosition = 'above' | 'below' | 'side';
export type LiveStatusLevel = 'ok' | 'info' | 'warn' | 'error';

/** What a runner's `run(source, mount, ctx)` receives as `ctx`. */
export interface LiveContext {
  /** The example's id (also its anchor on the page). */
  id: string;
  /** Where the example renders: in the page, or inside its own iframe. */
  mode: LiveMode;
  /** The `options` prop, as given (JSON-serialisable). */
  options: Record<string, unknown>;
  /** `prefers-reduced-motion: reduce` at the time of this run. The example re-runs when it changes. */
  reducedMotion: boolean;
  /** The page theme, from Starlight's `data-theme` (or the OS preference outside Starlight). */
  theme: 'light' | 'dark';
  /** Base URL relative paths should resolve against (the `base` prop, else the page URL). */
  base: string;
  /** Aborted when this run is replaced (edit, reset, theme or motion change) or the example is removed. */
  signal: AbortSignal;
  /** Show a one-line status under the preview (`error` is styled as an error but does not throw). */
  status(message: string, level?: LiveStatusLevel): void;
}

/** A runner may return a cleanup function (or a promise of one); it is called before the next run. */
export type LiveRunResult = void | (() => void) | Promise<void | (() => void)>;

export type LiveRunner = (source: string, mount: HTMLElement, ctx: LiveContext) => LiveRunResult;

/** Props of the <Live> component. */
export interface LiveProps {
  /** The example's source. Omit it to use the fenced code block written as the component's child (MDX). */
  code?: string;
  /** Language of `code` for highlighting. Default: `html`, or `json` when a `runner` is set. */
  lang?: string;
  /** Title shown in the code frame (with `code`; for a fenced child use ```html title="…"). */
  title?: string;
  /** Caption under the example. */
  caption?: string;
  /** Stable id and anchor (#id). Default: derived from caption or title, else from the source. */
  id?: string;
  /** `inline` renders into the page; `iframe` renders in an isolated, auto-sized iframe. Default `inline`. */
  mode?: LiveMode;
  /** Where the preview sits relative to the code. `side` falls back to stacked on narrow widths. Default `above`. */
  preview?: LivePreviewPosition;
  /** Make the code editable; edits re-run the example (debounced) and a Reset button restores it. */
  editable?: boolean;
  /** URL of a module exporting `run(source, mount, ctx)`. Without it the source is HTML and is rendered as-is. */
  runner?: string;
  /** Passed to the runner as `ctx.options`. Must be JSON-serialisable. */
  options?: Record<string, unknown>;
  /** Module URLs to load before the example runs (inline: once per page; iframe: in the iframe's head). */
  modules?: string[];
  /** Extra HTML for the iframe's <head> (styles, scripts, import maps). iframe mode only. */
  head?: string;
  /** Base URL for relative paths inside the iframe (<base href>). iframe mode only; passed to runners as ctx.base. */
  base?: string;
  /** iframe sandbox tokens. Default `allow-scripts allow-same-origin allow-popups allow-forms allow-modals`. */
  sandbox?: string;
  /** Minimum preview height (number = px, or any CSS length). Also the iframe's height before it measures itself. */
  height?: number | string;
  /** Start only when scrolled near the viewport. */
  lazy?: boolean;
  /** Debounce for re-running edits, in ms. Default 300. */
  debounce?: number;
  /** Extra class on the root element. */
  class?: string;
}
