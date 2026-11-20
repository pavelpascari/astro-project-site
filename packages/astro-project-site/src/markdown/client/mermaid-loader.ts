// Injected into every page (a few hundred bytes). On pages with ```mermaid diagrams it loads Mermaid, as a separate
// chunk, once a diagram comes near the viewport; pages without diagrams never fetch it.
const SELECTOR = 'figure[data-mermaid]:not([data-mermaid-state])';

function init() {
  const figures = document.querySelectorAll<HTMLElement>(SELECTOR);
  if (!figures.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        import('./mermaid').then((m) => m.render(entry.target as HTMLElement));
      }
    },
    { rootMargin: '600px 0px' },
  );
  for (const figure of figures) {
    figure.dataset.mermaidState = 'pending';
    observer.observe(figure);
  }
}

init();
document.addEventListener('astro:page-load', init);
