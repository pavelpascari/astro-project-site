// A <Live runner> for these docs: JSON in, an SVG bar chart out.
//
//   { "title": "Downloads", "unit": "k", "bars": { "jan": 12, "feb": 19 } }
//
// Shows the whole runner contract: it throws on bad input (the error appears under the preview), reads
// ctx.options (`max`), ctx.theme and ctx.reducedMotion, reports with ctx.status, and returns a cleanup.

/** @type {import('astro-project-site').LiveRunner} */
export function run(source, mount, ctx) {
  let spec;
  try {
    spec = JSON.parse(source);
  } catch (e) {
    throw new SyntaxError(`JSON: ${e.message}`);
  }
  if (!spec || typeof spec.bars !== 'object' || Array.isArray(spec.bars)) {
    throw new TypeError('expected { "bars": { "label": number, … } }');
  }
  const entries = Object.entries(spec.bars);
  const bad = entries.filter(([, v]) => typeof v !== 'number' || !Number.isFinite(v) || v < 0);
  if (bad.length) throw new TypeError(`bars.${bad[0][0]}: expected a number ≥ 0, got ${JSON.stringify(bad[0][1])}`);
  const limit = Number(ctx.options.max ?? 12);
  if (entries.length > limit) ctx.status(`showing the first ${limit} of ${entries.length} bars`, 'warn');
  const shown = entries.slice(0, limit);
  const max = Math.max(1, ...shown.map(([, v]) => v));
  const unit = String(spec.unit ?? '');

  const w = 40;
  const gap = 12;
  const h = 140;
  const width = Math.max(1, shown.length) * (w + gap) + gap;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${h + 40}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${spec.title ?? 'Bar chart'}: ${shown.map(([k, v]) => `${k} ${v}${unit}`).join(', ')}`);
  svg.style.cssText = `display:block;width:100%;max-width:${width * 1.5}px;height:auto;margin:auto;font:12px var(--sl-font, system-ui)`;

  /** @type {SVGRectElement[]} */
  const rects = [];
  shown.forEach(([label, value], i) => {
    const x = gap + i * (w + gap);
    const bh = Math.round((value / max) * h);
    const rect = document.createElementNS(ns, 'rect');
    Object.entries({ x, y: h - bh + 10, width: w, height: bh, rx: 4 }).forEach(([k, v]) => rect.setAttribute(k, String(v)));
    rect.setAttribute('fill', ctx.theme === 'dark' ? 'var(--sl-color-accent-high, #a5b4fc)' : 'var(--sl-color-accent, #4f46e5)');
    rects.push(rect);
    const text = (/** @type {string} */ s, /** @type {number} */ y) => {
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', String(x + w / 2));
      t.setAttribute('y', String(y));
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', 'currentColor');
      t.textContent = s;
      return t;
    };
    svg.append(rect, text(`${value}${unit}`, h - bh + 4), text(label, h + 28));
  });

  if (spec.title) {
    const caption = document.createElement('p');
    caption.textContent = spec.title;
    caption.style.cssText = 'margin:0 0 .5rem;font-weight:600;text-align:center';
    mount.append(caption);
  }
  mount.append(svg);

  // Grow the bars in, unless the reader asked for reduced motion. Cancelled by the cleanup when the run is replaced.
  /** @type {Animation[]} */
  const animations = ctx.reducedMotion
    ? []
    : rects.map((r, i) =>
        r.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], {
          duration: 400,
          delay: i * 60,
          easing: 'ease-out',
          fill: 'backwards',
        }),
      );
  rects.forEach((r) => (r.style.transformOrigin = 'center bottom'));
  rects.forEach((r) => (r.style.transformBox = 'fill-box'));

  if (entries.length <= limit) ctx.status(`${shown.length} bars, max ${max}${unit} · theme ${ctx.theme}`, 'ok');
  return () => animations.forEach((a) => a.cancel());
}
