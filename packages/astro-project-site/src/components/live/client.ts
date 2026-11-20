// Browser side of <Live>: reads the source back from the rendered code block, runs it
// (HTML or a custom runner, in the page or in an iframe), and wires up editing. No dependencies.
import type { LiveContext, LiveMode, LiveRunner, LiveStatusLevel } from './types';

interface Config {
  mode: LiveMode;
  editable: boolean;
  runner?: string;
  options: Record<string, unknown>;
  modules: string[];
  head: string;
  base?: string;
  sandbox: string;
  lazy: boolean;
  debounce: number;
}

type FrameMessage =
  | { type: 'height'; height: number }
  | { type: 'ready' }
  | { type: 'done' }
  | { type: 'status'; message: string; level: LiveStatusLevel }
  | { type: 'error'; message: string; detail?: string; load?: boolean };

const MARK = '__liveExample';
const reducedMotionQuery = () => matchMedia('(prefers-reduced-motion: reduce)');

// Starlight tokens copied into iframes so isolated examples still look like the page around them.
const THEME_VARS = [
  '--sl-color-white', '--sl-color-gray-1', '--sl-color-gray-2', '--sl-color-gray-3', '--sl-color-gray-4',
  '--sl-color-gray-5', '--sl-color-gray-6', '--sl-color-gray-7', '--sl-color-black',
  '--sl-color-accent-low', '--sl-color-accent', '--sl-color-accent-high',
  ...['blue', 'green', 'orange', 'red', 'purple'].flatMap((h) => [`--sl-color-${h}-low`, `--sl-color-${h}`, `--sl-color-${h}-high`]),
  '--sl-color-text', '--sl-color-text-accent', '--sl-color-text-invert',
  '--sl-color-bg', '--sl-color-bg-nav', '--sl-color-bg-sidebar', '--sl-color-bg-inline-code',
  '--sl-color-hairline', '--sl-color-hairline-light', '--sl-color-hairline-shade',
  '--sl-font', '--sl-font-mono', '--sl-text-sm', '--sl-text-base',
];

function pageTheme(): 'light' | 'dark' {
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function themeSnapshot() {
  const cs = getComputedStyle(document.documentElement);
  const vars: Record<string, string> = {};
  for (const v of THEME_VARS) {
    const value = cs.getPropertyValue(v).trim();
    if (value) vars[v] = value;
  }
  const scheme = cs.colorScheme && cs.colorScheme !== 'normal' ? cs.colorScheme : pageTheme();
  return { theme: pageTheme(), scheme, vars };
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const absolute = (url: string) => new URL(url, document.baseURI).href;

function describeError(err: unknown): string {
  if (err instanceof Error) return err.name && err.name !== 'Error' ? `${err.name}: ${err.message}` : err.message;
  return String(err);
}

// ---------- running HTML in the page ----------

const JS_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript']);
// Classic external scripts run once per page, like modules do (the browser's module map already de-duplicates
// <script type="module" src>, import() and runner modules, so custom elements are never defined twice).
const classicLoaded = new Set<string>();

function renderHtml(mount: HTMLElement, html: string, onError: (message: string) => void) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  mount.replaceChildren(tpl.content);
  // Scripts parsed by innerHTML never run; recreate them so they do.
  const syncErrors = (e: ErrorEvent) => onError(e.message);
  window.addEventListener('error', syncErrors);
  try {
    for (const old of [...mount.querySelectorAll('script')]) {
      const type = (old.getAttribute('type') ?? '').trim().toLowerCase();
      if (!JS_TYPES.has(type)) continue; // JSON, import maps, templates: leave them as data
      const src = old.getAttribute('src');
      if (src && type !== 'module') {
        const url = absolute(src);
        if (classicLoaded.has(url) || [...document.scripts].some((s) => s !== old && s.src === url && !mount.contains(s))) {
          old.remove();
          continue;
        }
        classicLoaded.add(url);
      }
      const s = document.createElement('script');
      for (const a of old.attributes) s.setAttribute(a.name, a.value);
      if (src && type !== 'module') s.async = false; // keep external classic scripts in document order
      s.textContent = old.textContent;
      old.replaceWith(s);
    }
  } finally {
    window.removeEventListener('error', syncErrors);
  }
}

// A module that could not be fetched (network error, 404, server gone): shown as a plain sentence, with the
// browser's own message kept as the detail.
const loadFailureText = (kind: 'runner' | 'module', url: string) =>
  `Couldn't load the ${kind} ${url} (network error or 404). Check the path, or that the site is still being served.`;

class ModuleLoadError extends Error {
  constructor(
    readonly url: string,
    readonly kind: 'runner' | 'module',
    readonly detail: string,
  ) {
    super(loadFailureText(kind, url));
  }
}

// Browsers cache a failed dynamic import per URL for the life of the page: a retry needs a different URL.
function bust(url: string, attempt: number): string {
  if (!attempt) return url;
  const u = new URL(url);
  u.searchParams.set('live-retry', String(attempt));
  return u.href;
}

async function loadModule(url: string, kind: 'runner' | 'module' = 'module', attempt = 0) {
  try {
    return await import(/* @vite-ignore */ bust(absolute(url), attempt));
  } catch (err) {
    // Fetch failures are TypeErrors in every engine; errors thrown while the module runs are passed on as they are.
    if (err instanceof TypeError && /fetch|import|load|module script/i.test(err.message))
      throw new ModuleLoadError(url, kind, describeError(err));
    throw err;
  }
}

async function loadRunner(url: string, attempt = 0): Promise<LiveRunner> {
  const mod = await loadModule(url, 'runner', attempt);
  if (typeof mod.run !== 'function') throw new Error(`${url} does not export run(source, mount, ctx)`);
  return mod.run as LiveRunner;
}

// ---------- the iframe document ----------

// Runs first inside every iframe: reports its height and errors, applies theme updates, hosts a runner.
// Kept as a string so the bundler never rewrites it.
const BOOT = `(function (cfg) {
  var post = function (m) { m.${MARK} = 1; parent.postMessage(m, '*'); };
  var last = -1;
  var measure = function () {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (h !== last) { last = h; post({ type: 'height', height: h }); }
  };
  new ResizeObserver(measure).observe(document.documentElement);
  addEventListener('load', measure);
  var fmt = function (e) { return e && e.message ? (e.name && e.name !== 'Error' ? e.name + ': ' : '') + e.message : String(e); };
  addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && t.tagName) {
      post({ type: 'error', message: 'Could not load ' + (t.src || t.href || t.tagName.toLowerCase()) });
    } else {
      post({ type: 'error', message: e.error ? fmt(e.error) : e.message || 'Script error' });
    }
  }, true);
  addEventListener('unhandledrejection', function (e) { post({ type: 'error', message: fmt(e.reason) }); });
  var applyTheme = function (t) {
    var r = document.documentElement;
    r.dataset.theme = t.theme;
    r.style.colorScheme = t.scheme;
    for (var k in t.vars) r.style.setProperty(k, t.vars[k]);
  };
  var mod, ac, cleanup, good, seq = 0;
  addEventListener('message', function (e) {
    var d = e.data;
    if (e.source !== parent || !d || d.${MARK} !== 1) return;
    if (d.type === 'theme') applyTheme(d.theme);
    if (d.type === 'run' && mod) {
      var n = ++seq;
      if (ac) ac.abort();
      if (cleanup) { try { cleanup(); } catch (err) { console.error(err); } cleanup = null; }
      ac = new AbortController();
      var root = document.getElementById('live-root');
      var prev = good && good.isConnected ? good : null, box = document.createElement('div');
      if (prev) prev.hidden = true;
      root.replaceChildren.apply(root, prev ? [prev, box] : [box]);
      var ctx = {
        id: cfg.id, mode: 'iframe', options: cfg.options, base: cfg.base, theme: document.documentElement.dataset.theme,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, signal: ac.signal,
        status: function (message, level) { if (n === seq) post({ type: 'status', message: String(message), level: level || 'info' }); }
      };
      Promise.resolve().then(function () { return mod.run(d.source, box, ctx); }).then(function (r) {
        if (n === seq) { if (prev) prev.remove(); good = box; }
        if (typeof r === 'function') { if (n === seq) cleanup = r; else r(); }
        if (n === seq) post({ type: 'done' });
      }, function (err) {
        if (n !== seq) return;
        box.remove();
        if (prev) prev.hidden = false;
        post({ type: 'error', message: fmt(err) });
      });
    }
  });
  if (cfg.runner) {
    import(cfg.runner).then(function (m) {
      if (typeof m.run !== 'function') throw new Error(cfg.runner + ' does not export run(source, mount, ctx)');
      mod = m;
      post({ type: 'ready' });
    }).catch(function (err) {
      var fetchFailed = err instanceof TypeError && /fetch|import|load|module script/i.test(err.message);
      post(fetchFailed
        ? { type: 'error', load: true, detail: fmt(err), message: "Couldn't load the runner " + cfg.runnerLabel + ' (network error or 404). Check the path, or that the site is still being served.' }
        : { type: 'error', message: 'Could not load the runner: ' + fmt(err) });
    });
  } else {
    post({ type: 'ready' });
  }
})`;

// Firefox's preloader resolves <script src> and <link href> in a srcdoc document against the page's URL, ignoring
// the <base> (each example then logs a failed load and a 404 before the right request). Resolve those URLs up front
// when there is a base; what runs is the same code.
function resolveAgainst(html: string, base: string): string {
  return html.replace(/(<(?:script|link)\b[^>]*?\s(?:src|href)\s*=\s*)(["'])([^"']*)\2/gi, (match, pre, q, url) =>
    !url || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(url) ? match : `${pre}${q}${new URL(url, base).href}${q}`,
  );
}

function frameDocument(cfg: Config, id: string, source: string, attempt = 0): string {
  const t = themeSnapshot();
  const vars = Object.entries(t.vars).map(([k, v]) => `${k}:${v};`).join('');
  const boot = {
    id,
    runner: cfg.runner ? bust(absolute(cfg.runner), attempt) : undefined,
    runnerLabel: cfg.runner,
    options: cfg.options,
    base: cfg.base ? absolute(cfg.base) : document.baseURI,
  };
  return [
    `<!doctype html><html lang="${escAttr(document.documentElement.lang || 'en')}" data-theme="${t.theme}"><head>`,
    cfg.base ? `<base href="${escAttr(absolute(cfg.base))}">` : '',
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<style>:root{color-scheme:${t.scheme};${vars}}html,body{margin:0}body{padding:1rem;font-family:var(--sl-font,system-ui,sans-serif);`,
    `line-height:1.5;color:var(--sl-color-text,CanvasText);background:transparent}</style>`,
    // </script> cannot appear inside a JSON literal in a script; escape "<".
    `<script>${BOOT}(${JSON.stringify(boot).replace(/</g, '\\u003c')})</script>`,
    ...cfg.modules.map((u) => `<script type="module" src="${escAttr(absolute(u))}"></script>`),
    cfg.base ? resolveAgainst(cfg.head, absolute(cfg.base)) : cfg.head,
    `</head><body>`,
    cfg.runner ? '<div id="live-root"></div>' : cfg.base ? resolveAgainst(source, absolute(cfg.base)) : source,
    `</body></html>`,
  ].join('');
}

// ---------- the element ----------

const frames = new Map<Window, LiveExample>();
let globalsWired = false;

function wireGlobals() {
  if (globalsWired) return;
  globalsWired = true;
  window.addEventListener('message', (e) => {
    const d = e.data as (FrameMessage & { [MARK]?: number }) | null;
    if (!d || d[MARK] !== 1 || !e.source) return;
    frames.get(e.source as Window)?.onFrameMessage(d);
  });
  new MutationObserver(() => {
    for (const el of document.querySelectorAll<LiveExample>('live-example')) el.onThemeChange?.();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  // Late errors (timers, animation frames) thrown from an inline runner's module land on its example.
  window.addEventListener('error', (e) => {
    if (!e.filename) return;
    for (const el of document.querySelectorAll<LiveExample>('live-example')) el.onPageError?.(e);
  });
  reducedMotionQuery().addEventListener('change', () => {
    for (const el of document.querySelectorAll<LiveExample>('live-example')) el.onMotionChange?.();
  });
}

class LiveExample extends HTMLElement {
  private cfg!: Config;
  private mount!: HTMLElement;
  private bar!: HTMLElement;
  private statusEl!: HTMLElement;
  private resetBtn: HTMLButtonElement | null = null;
  private copyBtn: HTMLButtonElement | null = null;
  private editor: HTMLTextAreaElement | null = null;
  private original = '';
  private source = '';
  private started = false;
  private seq = 0;
  private ac: AbortController | null = null;
  private cleanup: (() => void) | null = null;
  private frame: HTMLIFrameElement | null = null;
  private frameReady = false;
  private frameTheme = '';
  private goodBox: HTMLElement | null = null;
  private io: IntersectionObserver | null = null;
  private timer = 0;
  private lastTheme = '';
  /** A runner or module failed to load: the next run retries with a fresh URL. */
  private loadFailed = false;
  private attempt = 0;
  private retryBtn: HTMLButtonElement | null = null;

  /** The code the example runs now: what is in the editor for an editable example. Public API. */
  getSource(): string {
    return this.editor?.value ?? this.source;
  }

  /**
   * Replaces the example's code and runs it (if it has started; a lazy example runs it when it scrolls into view).
   * An editable example shows it in the editor and Reset brings back the original; otherwise the code block keeps
   * showing the original while the copy button copies the new code. Public API: call it after
   * `customElements.whenDefined('live-example')`.
   */
  setSource(code: string): void {
    if (!this.mount) throw new Error('<live-example> is not connected yet');
    if (this.editor) {
      this.editor.value = code;
      this.onEdit(true);
      return;
    }
    this.source = code;
    if (this.copyBtn) this.copyBtn.dataset.code = code.replace(/\n/g, '\u007f');
    if (this.started) void this.run();
  }

  connectedCallback() {
    if (this.mount) {
      if (this.started) this.start(); // moved in the DOM: run again
      return;
    }
    wireGlobals();
    this.cfg = JSON.parse(this.dataset.config ?? '{}') as Config;
    this.mount = this.querySelector('.live-ex__mount')!;
    this.bar = this.querySelector('.live-ex__bar')!;
    this.statusEl = this.querySelector('.live-ex__status')!;
    this.resetBtn = this.querySelector('.live-ex__reset');
    this.copyBtn = this.querySelector('.live-ex__code .copy button[data-code]');
    this.original = this.source = this.readSource();
    this.lastTheme = pageTheme();
    if (this.cfg.editable) this.makeEditable();
    if (this.cfg.lazy && 'IntersectionObserver' in window) {
      this.dataset.state = 'idle';
      this.io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          this.io?.disconnect();
          this.io = null;
          this.start();
        },
        { rootMargin: '200px 0px' },
      );
      this.io.observe(this);
    } else {
      this.start();
    }
  }

  disconnectedCallback() {
    // Elements can be moved (disconnect + connect in one task); tear down only if really gone.
    queueMicrotask(() => {
      if (this.isConnected) return;
      this.io?.disconnect();
      this.stop();
      if (this.frame?.contentWindow) frames.delete(this.frame.contentWindow);
    });
  }

  /** The source is whatever the code block shows: Expressive Code's copy text, else its lines. */
  private readSource(): string {
    if (this.copyBtn?.dataset.code !== undefined) return this.copyBtn.dataset.code.replace(/\u007f/g, '\n');
    const lines = this.querySelectorAll('.live-ex__code .ec-line');
    if (lines.length) return [...lines].map((l) => l.textContent ?? '').join('\n');
    return this.querySelector('.live-ex__code pre')?.textContent ?? '';
  }

  private start() {
    this.started = true;
    void this.run();
  }

  private stop() {
    this.seq++;
    this.ac?.abort();
    this.ac = null;
    const c = this.cleanup;
    this.cleanup = null;
    if (c) {
      try {
        c();
      } catch (err) {
        console.error(err);
      }
    }
  }

  private setStatus(message: string, level: LiveStatusLevel = 'info', detail?: string) {
    this.statusEl.replaceChildren(message);
    if (detail) {
      // The browser's own message, one click away (and in the tooltip).
      const more = document.createElement('details');
      more.className = 'live-ex__detail';
      const summary = document.createElement('summary');
      summary.textContent = 'Details';
      const code = document.createElement('code');
      code.textContent = detail;
      more.append(summary, code);
      this.statusEl.append(' ', more);
    }
    this.statusEl.title = detail ?? '';
    this.statusEl.dataset.level = level;
    if (level === 'error') this.dataset.state = 'error';
    this.bar.hidden = !this.cfg.editable && !message;
  }

  private showError(message: string, detail?: string) {
    this.setStatus(message, 'error', detail);
  }

  /** A module could not be fetched: say so plainly and offer to try again (Retry, or Reset when editable). */
  private showLoadError(message: string, detail: string) {
    this.loadFailed = true;
    this.showError(message, detail);
    if (!this.retryBtn) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'live-ex__reset live-ex__retry';
      b.textContent = 'Retry';
      b.addEventListener('click', () => void this.run());
      if (this.resetBtn) this.resetBtn.before(b);
      else this.bar.append(b);
      this.retryBtn = b;
    }
    this.retryBtn.hidden = false;
    if (this.resetBtn) this.resetBtn.disabled = false;
  }

  private clearStatus() {
    this.setStatus('', 'info');
  }

  async run() {
    this.stop();
    const seq = this.seq;
    const retry = this.loadFailed;
    if (retry) {
      this.loadFailed = false;
      this.attempt++;
    }
    if (this.retryBtn) this.retryBtn.hidden = true;
    if (this.resetBtn && this.editor) this.resetBtn.disabled = this.editor.value === this.original;
    this.dataset.state = 'running';
    this.clearStatus();
    try {
      if (this.cfg.mode === 'iframe') this.runInFrame(retry);
      else if (this.cfg.runner) await this.runInlineRunner(seq);
      else {
        await Promise.all(this.cfg.modules.map((u) => loadModule(u, 'module', this.attempt)));
        if (seq !== this.seq) return;
        renderHtml(this.mount, this.source, (m) => this.showError(m));
      }
      if (seq === this.seq && this.dataset.state === 'running') this.dataset.state = 'ok';
    } catch (err) {
      if (seq !== this.seq) return;
      if (err instanceof ModuleLoadError) this.showLoadError(err.message, err.detail);
      else this.showError(describeError(err));
    }
  }

  private async runInlineRunner(seq: number) {
    await Promise.all(this.cfg.modules.map((u) => loadModule(u, 'module', this.attempt)));
    const run = await loadRunner(this.cfg.runner!, this.attempt);
    if (seq !== this.seq) return;
    this.ac = new AbortController();
    // Render into a fresh box; if the run fails, the last good render stays on screen (stopped).
    const previous = this.goodBox?.isConnected ? this.goodBox : null;
    const box = document.createElement('div');
    box.className = 'live-ex__run';
    previous?.setAttribute('hidden', '');
    this.mount.replaceChildren(...(previous ? [previous] : []), box);
    const ctx: LiveContext = {
      id: this.id,
      mode: 'inline',
      options: this.cfg.options,
      reducedMotion: reducedMotionQuery().matches,
      theme: pageTheme(),
      base: this.cfg.base ? absolute(this.cfg.base) : document.baseURI,
      signal: this.ac.signal,
      status: (message, level) => {
        if (seq === this.seq) this.setStatus(String(message), level ?? 'info');
      },
    };
    let result;
    try {
      result = await run(this.source, box, ctx);
    } catch (err) {
      if (seq === this.seq) {
        box.remove();
        previous?.removeAttribute('hidden');
      }
      throw err;
    }
    if (seq === this.seq) {
      previous?.remove();
      this.goodBox = box;
    }
    if (typeof result === 'function') {
      if (seq === this.seq) this.cleanup = result;
      else result();
    }
  }

  private runInFrame(retry = false) {
    if (retry && this.frame) {
      // The runner never loaded in this frame: start over with a fresh document.
      frames.delete(this.frame.contentWindow!);
      this.frame = null;
    }
    if (this.cfg.runner && this.frame) {
      // The runner stays loaded in its iframe; just hand it the new source.
      this.postToFrame({ type: 'run', source: this.source });
      return;
    }
    if (!this.frame) {
      const f = document.createElement('iframe');
      f.className = 'live-ex__frame';
      f.title = this.querySelector('.live-ex__preview')?.getAttribute('aria-label') ?? 'Live example';
      f.setAttribute('sandbox', this.cfg.sandbox);
      f.setAttribute('allow', 'clipboard-write');
      this.mount.replaceChildren(f);
      this.frame = f;
      frames.set(f.contentWindow!, this);
    }
    this.frameReady = false;
    this.frameTheme = pageTheme();
    this.frame.srcdoc = frameDocument(this.cfg, this.id, this.source, this.attempt);
  }

  private postToFrame(message: Record<string, unknown>) {
    if (!this.frameReady) return; // sent on 'ready'
    this.frame?.contentWindow?.postMessage({ ...message, [MARK]: 1 }, '*');
  }

  onFrameMessage(m: FrameMessage) {
    switch (m.type) {
      case 'height':
        if (this.frame) this.frame.style.height = `${m.height}px`;
        break;
      case 'ready':
        this.frameReady = true;
        if (this.cfg.runner) this.postToFrame({ type: 'run', source: this.source });
        if (themeSnapshot().theme !== this.frameTheme) this.postToFrame({ type: 'theme', theme: themeSnapshot() });
        break;
      case 'status':
        this.setStatus(m.message, m.level);
        break;
      case 'error':
        if (m.load) this.showLoadError(m.message, m.detail ?? '');
        else this.showError(m.message, m.detail);
        break;
      case 'done':
        if (this.dataset.state === 'running') this.dataset.state = 'ok';
        break;
    }
  }

  onThemeChange() {
    const theme = pageTheme();
    if (theme === this.lastTheme) return;
    this.lastTheme = theme;
    if (!this.started) return;
    // Not ready yet: the 'ready' handler compares themes and catches up.
    if (this.frame) this.postToFrame({ type: 'theme', theme: themeSnapshot() });
    if (this.cfg.runner) void this.run(); // ctx.theme changed
  }

  onPageError(e: ErrorEvent) {
    if (this.cfg.mode !== 'inline' || !this.cfg.runner || !this.started) return;
    if (e.filename.split('?')[0] !== absolute(this.cfg.runner).split('?')[0]) return;
    this.showError(e.error ? describeError(e.error) : e.message);
  }

  onMotionChange() {
    if (this.started && this.cfg.runner) void this.run(); // ctx.reducedMotion changed
  }

  // ---------- editing ----------

  private makeEditable() {
    const pre = this.querySelector<HTMLElement>('.live-ex__code pre');
    if (!pre) return;
    const title = this.querySelector('.live-ex__code .title')?.textContent?.trim();
    const hintId = `${this.id}-edit-hint`;
    const hint = document.createElement('span');
    hint.id = hintId;
    hint.className = 'live-ex__sr';
    hint.textContent = 'Edits re-run the example. Tab inserts spaces; press Escape, then Tab, to leave the editor.';

    const ta = document.createElement('textarea');
    ta.className = 'live-ex__editor';
    ta.value = this.source;
    ta.spellcheck = false;
    ta.wrap = 'off';
    ta.rows = Math.min(30, Math.max(3, this.source.split('\n').length + 1));
    ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('autocomplete', 'off');
    ta.setAttribute('autocorrect', 'off');
    ta.setAttribute('aria-label', `Edit the example code${title ? `: ${title}` : ''}`);
    ta.setAttribute('aria-describedby', hintId);
    pre.after(ta, hint);
    this.editor = ta;
    this.bar.hidden = false;

    let escaped = false;
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        escaped = true;
        return;
      }
      if (e.key === 'Tab' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && !escaped) {
        e.preventDefault();
        // execCommand keeps the native undo stack; fall back where it is gone.
        if (!document.execCommand?.('insertText', false, '  ')) ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      escaped = false;
    });
    ta.addEventListener('input', () => this.onEdit());
    this.resetBtn?.addEventListener('click', () => {
      ta.value = this.original;
      this.onEdit(true);
    });
  }

  private onEdit(now = false) {
    const value = this.editor!.value;
    const dirty = value !== this.original;
    if (this.resetBtn) this.resetBtn.disabled = !dirty;
    this.dataset.dirty = String(dirty);
    if (this.copyBtn) this.copyBtn.dataset.code = value.replace(/\n/g, '\u007f');
    clearTimeout(this.timer);
    const go = () => {
      if (value === this.source && this.dataset.state !== 'error') return;
      this.source = value;
      if (this.started) void this.run();
    };
    if (now) go();
    else this.timer = window.setTimeout(go, this.cfg.debounce);
  }
}

export function defineLiveExample() {
  if (!customElements.get('live-example')) customElements.define('live-example', LiveExample);
}
