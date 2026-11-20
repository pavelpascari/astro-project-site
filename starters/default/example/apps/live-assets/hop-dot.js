// <hop-dot targets="selector"> hops along the top edges of page elements matching `targets`, anywhere on the
// page. It exists to show that inline live examples can reach the page around them.
// With prefers-reduced-motion it moves without animating, and less often.
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

class HopDot extends HTMLElement {
  connectedCallback() {
    // Fixed positioning: not clipped by the example's box, placed in viewport coordinates.
    this.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;border-radius:50%;z-index:5;' +
      'background:var(--sl-color-accent,#6366f1);box-shadow:0 2px 0 rgb(0 0 0/.25);pointer-events:none;';
    this.i = -1;
    this.follow = () => this.place(false);
    addEventListener('scroll', this.follow, { passive: true, capture: true });
    addEventListener('resize', this.follow);
    this.hop();
  }

  disconnectedCallback() {
    clearTimeout(this.timer);
    removeEventListener('scroll', this.follow, { capture: true });
    removeEventListener('resize', this.follow);
  }

  targets() {
    return [...document.querySelectorAll(this.getAttribute('targets') ?? '[data-hop]')];
  }

  /** Where the dot sits on target i, in viewport coordinates. */
  spot(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - 9, y: r.top - 18 };
  }

  place(animate) {
    const el = this.targets()[this.i];
    if (!el) return;
    const { x, y } = this.spot(el);
    const to = `translate(${x}px, ${y}px)`;
    if (animate && !reduce() && this.at) {
      const mid = `translate(${(x + this.at.x) / 2}px, ${Math.min(y, this.at.y) - 40}px)`;
      this.animate([{ transform: `translate(${this.at.x}px, ${this.at.y}px)` }, { transform: mid }, { transform: to }],
        { duration: 600, easing: 'ease-in-out' });
    }
    this.style.transform = to;
    this.at = { x, y };
  }

  hop() {
    const targets = this.targets();
    if (targets.length) {
      this.i = (this.i + 1) % targets.length;
      this.place(true);
      for (const el of targets) el.toggleAttribute('data-hop-here', el === targets[this.i]);
    }
    this.timer = setTimeout(() => this.hop(), reduce() ? 3000 : 1200);
  }
}

customElements.define('hop-dot', HopDot);
