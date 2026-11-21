// Starlight's mobile menu (the docs sidebar) is a popover: `<button popovertarget>` opens `<sl-sidebar-pane popover>`,
// with no script of its own. Browsers without the Popover API (Safari and every iOS browser before 17, Firefox
// before 125, older Android browsers) ignore both attributes, so the menu button does nothing and the sidebar,
// which Starlight positions over the whole page, is never hidden.
//
// POPOVER_FALLBACK runs first thing in the docs <head> (an inline script, before the body is painted). Where the
// API exists it does nothing. Elsewhere it marks <html> with `no-popover` and drives every `[popovertarget]` button
// itself: a click toggles `data-open` on the target, clicking outside or pressing Escape closes it, and the button
// gets aria-expanded. The `html.no-popover` rules in styles/docs.css hide closed popovers and swap the icons.

/**
 * The fallback itself; `win` is the window (a parameter so tests can run it against a stub). Returns whether it
 * took over (false where the browser has the Popover API).
 * @param {Window & typeof globalThis} win
 */
export function popoverFallback(win) {
  const doc = win.document;
  if ('popover' in win.HTMLElement.prototype) return false;
  doc.documentElement.classList.add('no-popover');

  const openOnes = () => doc.querySelectorAll('[popover][data-open]');
  const set = (/** @type {Element} */ target, /** @type {boolean} */ open) => {
    target.toggleAttribute('data-open', open);
    for (const button of doc.querySelectorAll('[popovertarget]')) {
      if (button.getAttribute('popovertarget') === target.id) button.setAttribute('aria-expanded', String(open));
    }
    // As Starlight's own menu does when open: the page behind it is inert, so focus stays in the menu.
    if (target.id === 'starlight__sidebar') {
      for (const el of doc.querySelectorAll('.main-frame, .sl-skip-link')) el.toggleAttribute('inert', open);
    }
  };

  doc.addEventListener('click', (event) => {
    const button = event.target instanceof win.Element ? event.target.closest('[popovertarget]') : null;
    if (button) {
      const target = doc.getElementById(button.getAttribute('popovertarget') ?? '');
      if (target) {
        event.preventDefault();
        set(target, !target.hasAttribute('data-open'));
        return;
      }
    }
    // Light dismiss, as popover="auto" does: a click outside an open popover closes it.
    for (const target of openOnes()) if (!target.contains(/** @type {Node | null} */ (event.target))) set(target, false);
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') for (const target of openOnes()) set(target, false);
  });
  // Screen readers learn the menu starts closed (the buttons exist once the body is parsed).
  doc.addEventListener('DOMContentLoaded', () => {
    for (const button of doc.querySelectorAll('[popovertarget]')) button.setAttribute('aria-expanded', 'false');
  });
  return true;
}

/** The inline script for Starlight's `head`. */
export const POPOVER_FALLBACK = `(${popoverFallback.toString()})(window);`;
