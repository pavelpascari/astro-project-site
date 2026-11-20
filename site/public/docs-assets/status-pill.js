// <status-pill> — a tiny custom element used by the live examples in these docs.
// Served as-is from public/docs-assets/ (not bundled). Several examples load it; the browser's module map
// evaluates it once per page, so it can call customElements.define without a guard.
class StatusPill extends HTMLElement {
  static observedAttributes = ['label', 'tone'];

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
    const label = (this.getAttribute('label') ?? 'ready').replace(/[<&]/g, '');
    const tone = this.getAttribute('tone') ?? 'accent';
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; gap: .45em; padding: .2em .75em; border-radius: 999px;
          font: 600 .875rem/1.5 var(--sl-font, system-ui, sans-serif);
          color: var(--sl-color-${tone}-high, #312e81); background: var(--sl-color-${tone}-low, #e0e7ff);
          border: 1px solid var(--sl-color-${tone}, #6366f1); }
        i { width: .55em; height: .55em; border-radius: 50%; background: currentColor; }
      </style><i></i>${label}`;
  }
}

customElements.define('status-pill', StatusPill);
