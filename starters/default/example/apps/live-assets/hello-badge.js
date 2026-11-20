// A tiny custom element for the live-examples showcase. It defines <hello-badge> without any guard:
// several examples on one page load this module, and the browser's module map makes sure it runs once.
globalThis.helloBadgeEvaluations = (globalThis.helloBadgeEvaluations ?? 0) + 1;

class HelloBadge extends HTMLElement {
  static observedAttributes = ['name', 'tone'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const name = this.getAttribute('name') ?? 'world';
    const tone = this.getAttribute('tone') ?? 'accent';
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; gap: .4em; padding: .25em .75em; border-radius: 999px;
          font: 600 .9rem/1.4 var(--sl-font, system-ui, sans-serif);
          background: var(--sl-color-${tone}-low, #e0e7ff); color: var(--sl-color-${tone}-high, #312e81);
          border: 1px solid var(--sl-color-${tone}, #6366f1); }
        span { font-weight: 400; opacity: .8; }
      </style>
      Hello, ${name.replace(/[<&]/g, '')}! <span>(module evaluated ${globalThis.helloBadgeEvaluations}×)</span>`;
  }
}

customElements.define('hello-badge', HelloBadge);
