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

export function enhanceScrollRegions() {
  schedule();
  addEventListener('resize', schedule);
  // Live examples and fonts change sizes after load.
  document.fonts?.ready.then(schedule);
  addEventListener('load', schedule);
}
