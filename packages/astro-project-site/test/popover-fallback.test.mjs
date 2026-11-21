// The docs menu fallback for browsers without the Popover API (src/docs/popover-fallback.mjs), against a small
// stand-in for the DOM: just enough elements, attributes and events for the script. The real thing is checked in
// WebKit with the API removed (see the CHANGELOG entry); this keeps its logic from regressing.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { popoverFallback, POPOVER_FALLBACK } from '../src/docs/popover-fallback.mjs';
import { parseOptions } from '../src/options.mjs';
import { starlightOptions } from '../src/starlight.mjs';
import { fixture } from './helpers.mjs';

class El {
  constructor(/** @type {Record<string, string>} */ attrs = {}, /** @type {string[]} */ classes = []) {
    this.attrs = new Map(Object.entries(attrs));
    this.classes = new Set(classes);
    /** @type {El | null} */
    this.parent = null;
    this.classList = { add: (/** @type {string} */ c) => this.classes.add(c), contains: (/** @type {string} */ c) => this.classes.has(c) };
  }
  get id() { return this.attrs.get('id') ?? ''; }
  getAttribute(/** @type {string} */ n) { return this.attrs.get(n) ?? null; }
  setAttribute(/** @type {string} */ n, /** @type {string} */ v) { this.attrs.set(n, v); }
  hasAttribute(/** @type {string} */ n) { return this.attrs.has(n); }
  toggleAttribute(/** @type {string} */ n, /** @type {boolean} */ on) { if (on) this.attrs.set(n, ''); else this.attrs.delete(n); }
  contains(/** @type {any} */ other) { for (let e = other; e; e = e.parent) if (e === this) return true; return false; }
  closest(/** @type {string} */ sel) { for (let e = /** @type {El | null} */ (this); e; e = e.parent) if (e.matches(sel)) return e; return null; }
  matches(/** @type {string} */ sel) {
    return sel.split(',').some((part) => {
      const s = part.trim();
      if (s === '[popovertarget]') return this.attrs.has('popovertarget');
      if (s === '[popover][data-open]') return this.attrs.has('popover') && this.attrs.has('data-open');
      if (s.startsWith('.')) return this.classes.has(s.slice(1));
      return false;
    });
  }
}

/** A docs page: the menu button, the sidebar popover holding a link, the main frame. */
function page(/** @type {boolean} */ supported) {
  const root = new El();
  const button = new El({ popovertarget: 'starlight__sidebar' }, ['sl-menu-button']);
  const icon = new El();
  icon.parent = button;
  const sidebar = new El({ id: 'starlight__sidebar', popover: '' });
  const link = new El({ href: '/docs/x/' });
  link.parent = sidebar;
  const main = new El({}, ['main-frame']);
  const all = [button, icon, sidebar, link, main];
  /** @type {Record<string, ((e: any) => void)[]>} */
  const listeners = {};
  const document = {
    documentElement: root,
    getElementById: (/** @type {string} */ id) => all.find((e) => e.id === id) ?? null,
    querySelectorAll: (/** @type {string} */ sel) => all.filter((e) => e.matches(sel)),
    addEventListener: (/** @type {string} */ type, /** @type {(e: any) => void} */ fn) => (listeners[type] ??= []).push(fn),
  };
  function HTMLElement() {}
  if (supported) HTMLElement.prototype.popover = null;
  const win = /** @type {any} */ ({ document, HTMLElement, Element: El });
  const fire = (/** @type {string} */ type, /** @type {any} */ props = {}) => {
    const event = { prevented: false, preventDefault() { this.prevented = true; }, ...props };
    for (const fn of listeners[type] ?? []) fn(event);
    return event;
  };
  return { win, root, button, icon, sidebar, link, main, fire };
}

test('popover fallback: does nothing where the browser has the Popover API', () => {
  const p = page(true);
  assert.equal(popoverFallback(p.win), false);
  assert.equal(p.root.classList.contains('no-popover'), false);
  assert.equal(p.fire('click', { target: p.icon }).prevented, false);
});

test('popover fallback: without the API, the menu button opens and closes the sidebar', () => {
  const p = page(false);
  assert.equal(popoverFallback(p.win), true);
  assert.ok(p.root.classList.contains('no-popover'));
  p.fire('DOMContentLoaded');
  assert.equal(p.button.getAttribute('aria-expanded'), 'false');

  // A tap on the button's icon opens it; the page behind is inert, as with Starlight's own menu.
  assert.equal(p.fire('click', { target: p.icon }).prevented, true);
  assert.ok(p.sidebar.hasAttribute('data-open'));
  assert.equal(p.button.getAttribute('aria-expanded'), 'true');
  assert.ok(p.main.hasAttribute('inert'));

  // A click inside the menu (a link) leaves it open and is not prevented: the link navigates.
  assert.equal(p.fire('click', { target: p.link }).prevented, false);
  assert.ok(p.sidebar.hasAttribute('data-open'));

  // The button again closes it.
  p.fire('click', { target: p.button });
  assert.ok(!p.sidebar.hasAttribute('data-open'));
  assert.ok(!p.main.hasAttribute('inert'));

  // Escape, and a click outside, close it too.
  p.fire('click', { target: p.button });
  p.fire('keydown', { key: 'Escape' });
  assert.ok(!p.sidebar.hasAttribute('data-open'));
  p.fire('click', { target: p.button });
  p.fire('click', { target: p.main });
  assert.ok(!p.sidebar.hasAttribute('data-open'));
  assert.equal(p.button.getAttribute('aria-expanded'), 'false');
});

test('popover fallback: an inline script in the docs <head>, right after the layer order', () => {
  const root = fixture({ 'src/content/docs/docs/index.md': '---\ntitle: Hi\n---\n' });
  const options = parseOptions({ name: 'N', tagline: 't', url: 'https://n.dev', repo: 'https://github.com/o/n', head: [{ tag: 'meta', attrs: { name: 'x', content: 'y' } }] });
  const opts = /** @type {any} */ (starlightOptions(options, { customCss: [] }, root));
  assert.deepEqual(opts.head.slice(0, 3).map((/** @type {any} */ h) => h.tag), ['style', 'script', 'meta']);
  assert.equal(opts.head[1].content, POPOVER_FALLBACK);
  // It parses as a script on its own (it is serialized from the function).
  assert.doesNotThrow(() => new Function(POPOVER_FALLBACK));
});
