// Wide tables and code blocks scroll sideways in their own box instead of making the page scroll. A box that
// scrolls must be reachable by keyboard (WCAG 2.1.1), which Chromium and Firefox do on their own and Safari does
// not: give every box that currently overflows a tab stop, and take it away again when it no longer does.
const SELECTOR = 'main pre, main table, main .live-ex__preview';
const MARK = 'data-scroll-region';

function update() {
  for (const el of document.querySelectorAll<HTMLElement>(SELECTOR)) {
    const scrolls = el.scrollWidth > el.clientWidth + 1;
    if (scrolls && !el.hasAttribute('tabindex')) {
      el.tabIndex = 0;
      el.setAttribute(MARK, '');
    } else if (!scrolls && el.hasAttribute(MARK)) {
      el.removeAttribute('tabindex');
      el.removeAttribute(MARK);
    }
  }
}

let frame = 0;
const schedule = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(update);
};

/** A focused link or button inside a sideways-scrolling box is brought fully into the box's view. */
function revealFocus(e: FocusEvent) {
  const el = e.target as HTMLElement | null;
  const box = el?.closest?.<HTMLElement>(SELECTOR);
  if (!el || !box || box === el || box.scrollWidth <= box.clientWidth + 1) return;
  const r = el.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  if (r.left < b.left) box.scrollLeft -= b.left - r.left + 8;
  else if (r.right > b.right) box.scrollLeft += Math.min(r.right - b.right + 8, r.left - b.left);
}

export function enhanceScrollRegions() {
  schedule();
  addEventListener('focusin', revealFocus);
  addEventListener('resize', schedule);
  // Live examples and fonts change sizes after load.
  document.fonts?.ready.then(schedule);
  addEventListener('load', schedule);
}
