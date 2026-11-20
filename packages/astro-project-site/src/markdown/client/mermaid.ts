// Renders ```mermaid figures (loaded by mermaid-loader.ts only on pages that have them).
//
// - Colours come from the site's tokens (--site-*, --sl-color-*), read from the page at render time, and every
//   diagram is drawn again when the theme switches (Starlight's <html data-theme>).
// - Responsive: a diagram scales down to the column, but never below MIN_SCALE of its natural size; past that its
//   box scrolls sideways (and becomes a focusable, labelled region so keyboards can scroll it).
// - Accessible: the SVG is an image named after the diagram's accTitle (or its type), and the source stays on the
//   page under "Diagram source". When a diagram cannot be parsed, the source is all that shows, with a note.
// - Quiet: invalid diagrams are detected with parse() first, Mermaid's logger is off, and its error SVG is never
//   inserted.
import mermaid from 'mermaid';

const MIN_SCALE = 0.6;

let queue: Promise<unknown> = Promise.resolve();
let configured = '';
let seq = 0;
const drawn = new Set<HTMLElement>();

/** Renders one figure (calls are serialised: Mermaid's render is not re-entrant). */
export function render(figure: HTMLElement) {
  drawn.add(figure);
  queue = queue.then(() => draw(figure)).catch((error) => fail(figure, error));
  return queue;
}

// Theme switch: draw everything again with the new colours.
new MutationObserver(() => {
  for (const figure of drawn) if (figure.isConnected) render(figure);
  for (const figure of [...drawn]) if (!figure.isConnected) drawn.delete(figure);
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

async function draw(figure: HTMLElement) {
  const source = sourceOf(figure);
  const vars = themeVariables(figure);
  const key = JSON.stringify(vars);
  if (figure.dataset.mermaidKey === key && figure.dataset.mermaidState === 'done') return;
  // Gantt charts size themselves to a width rather than a viewBox: give them the column's.
  const width = Math.round(figure.clientWidth) || 800;
  if (configured !== key + width) {
    mermaid.initialize({
      gantt: { useWidth: Math.max(width - 24, 480) },
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      // Mermaid 12 defaults to ELK, which is EPL-2.0 and left out of the bundle (elk-stub.ts); dagre is MIT.
      layout: 'dagre',
      themeVariables: vars,
      fontFamily: String(vars.fontFamily),
      logLevel: 'fatal',
      suppressErrorRendering: true,
    });
    configured = key + width;
  }
  if (!(await mermaid.parse(source, { suppressErrors: true }))) return fail(figure, 'Invalid diagram source');

  const id = `md-mermaid-${++seq}`;
  let result: Awaited<ReturnType<typeof mermaid.render>>;
  try {
    result = await mermaid.render(id, source);
  } catch (error) {
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
    return fail(figure, error);
  }

  const box = part(figure, 'div', 'md-mermaid__diagram', true);
  box.innerHTML = result.svg;
  result.bindFunctions?.(box);
  const svg = box.querySelector('svg');
  if (!svg) return fail(figure);

  // Scale to the column, but not below MIN_SCALE: wider than that and the box scrolls.
  const natural = svg.viewBox?.baseVal?.width || parseFloat(svg.style.maxWidth) || 0;
  svg.removeAttribute('height');
  svg.style.width = '100%';
  if (natural) {
    svg.style.maxWidth = `${natural}px`;
    svg.style.minWidth = `${Math.round(natural * MIN_SCALE)}px`;
  }

  const kind = (svg.getAttribute('aria-roledescription') ?? '').replace(/-v\d+$/, '').replace(/[-_]/g, ' ');
  const title = svg.querySelector(':scope > title')?.textContent?.trim();
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', title || (kind ? `${kind} diagram` : 'Diagram'));

  // The source moves under the diagram, collapsed, and describes it.
  const pre = figure.querySelector<HTMLElement>('.md-mermaid__source');
  if (pre && !pre.closest('details')) {
    const details = part(figure, 'details', 'md-mermaid__details');
    const summary = document.createElement('summary');
    summary.textContent = 'Diagram source';
    details.append(summary, pre);
  }
  if (pre) {
    pre.id ||= `${id}-source`;
    svg.setAttribute('aria-describedby', pre.id);
  }
  figure.querySelector('.md-mermaid__error')?.remove();
  figure.dataset.mermaidState = 'done';
  figure.dataset.mermaidKey = key;
  scrollRegion(box, svg.getAttribute('aria-label') ?? 'Diagram');
}

function sourceOf(figure: HTMLElement) {
  figure.dataset.mermaidSource ??= figure.querySelector('.md-mermaid__source')?.textContent ?? '';
  return figure.dataset.mermaidSource;
}

/** Shows the source (it never left) and says why there is no diagram. */
function fail(figure: HTMLElement, error?: unknown) {
  figure.dataset.mermaidState = 'error';
  // For debugging, without console noise: the reason is on the figure.
  if (error) figure.dataset.mermaidError = error instanceof Error ? error.message : String(error);
  figure.querySelector('.md-mermaid__diagram')?.remove();
  const details = figure.querySelector('details.md-mermaid__details');
  const pre = figure.querySelector('.md-mermaid__source');
  if (details && pre) details.replaceWith(pre);
  if (!figure.querySelector('.md-mermaid__error')) {
    const note = document.createElement('figcaption');
    note.className = 'md-mermaid__error';
    note.textContent = 'This diagram could not be rendered; its source is shown instead.';
    figure.append(note);
  }
}

/** The figure's child with `className`, created (first or last) when missing. */
function part<K extends keyof HTMLElementTagNameMap>(figure: HTMLElement, tag: K, className: string, prepend = false) {
  let node = figure.querySelector<HTMLElementTagNameMap[K]>(`:scope > .${className}`);
  if (!node) {
    node = document.createElement(tag);
    node.className = className;
    if (prepend) figure.prepend(node);
    else figure.append(node);
  }
  return node;
}

/** A box that scrolls gets a tab stop and a name, only while it actually scrolls. */
function scrollRegion(box: HTMLElement, label: string) {
  const update = () => {
    const scrolls = box.scrollWidth > box.clientWidth + 1;
    if (scrolls) {
      box.tabIndex = 0;
      box.setAttribute('role', 'region');
      box.setAttribute('aria-label', `${label} (scrolls sideways)`);
    } else {
      box.removeAttribute('tabindex');
      box.removeAttribute('role');
      box.removeAttribute('aria-label');
    }
  };
  update();
  new ResizeObserver(update).observe(box);
}

// ── colours ─────────────────────────────────────────────────────────────────────────────────────────

let canvas: CanvasRenderingContext2D | null | undefined;

/** Any CSS colour (color-mix(), oklab(), var()) as #rrggbb, which Mermaid's colour maths understands. */
function resolve(el: HTMLElement, value: string) {
  const probe = document.createElement('span');
  probe.style.color = value;
  probe.style.display = 'none';
  el.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  canvas ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  if (!canvas) return computed;
  canvas.clearRect(0, 0, 1, 1);
  canvas.fillStyle = '#000';
  canvas.fillStyle = computed;
  canvas.fillRect(0, 0, 1, 1);
  const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function themeVariables(el: HTMLElement) {
  const c = (v: string) => resolve(el, v);
  const bg = c('var(--site-bg)');
  const surface = c('var(--site-surface)');
  const text = c('var(--site-text)');
  const muted = c('var(--site-muted)');
  const border = c('var(--site-border)');
  const accent = c('var(--site-accent)');
  const soft = c('var(--site-accent-soft)');
  const dark = (document.documentElement.dataset.theme ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')) === 'dark';
  // Categorical colours (pie, git branches): Starlight's "high" shades, light in dark mode and dark in light mode,
  // with the page background as the label colour on top.
  const palette = ['accent', 'blue', 'green', 'orange', 'purple', 'red'].map((n) =>
    c(n === 'accent' ? 'var(--sl-color-accent-high)' : `var(--sl-color-${n}-high)`),
  );
  const vars: Record<string, string | boolean> = {
    darkMode: dark,
    fontFamily: getComputedStyle(el).fontFamily,
    fontSize: '15px',
    background: bg,
    textColor: text,
    lineColor: muted,
    primaryColor: soft,
    primaryTextColor: text,
    primaryBorderColor: accent,
    secondaryColor: surface,
    secondaryTextColor: text,
    secondaryBorderColor: border,
    tertiaryColor: surface,
    tertiaryTextColor: text,
    tertiaryBorderColor: border,
    mainBkg: soft,
    nodeBorder: accent,
    nodeTextColor: text,
    clusterBkg: surface,
    clusterBorder: border,
    titleColor: text,
    edgeLabelBackground: bg,
    noteBkgColor: surface,
    noteTextColor: text,
    noteBorderColor: border,
    actorBkg: soft,
    actorBorder: accent,
    actorTextColor: text,
    actorLineColor: muted,
    signalColor: text,
    signalTextColor: text,
    labelBoxBkgColor: surface,
    labelBoxBorderColor: border,
    labelTextColor: text,
    loopTextColor: text,
    activationBkgColor: surface,
    activationBorderColor: accent,
    sequenceNumberColor: bg,
    sectionBkgColor: soft,
    altSectionBkgColor: bg,
    sectionBkgColor2: surface,
    taskBkgColor: soft,
    taskBorderColor: accent,
    taskTextColor: text,
    taskTextLightColor: text,
    taskTextOutsideColor: text,
    taskTextDarkColor: text,
    activeTaskBkgColor: surface,
    activeTaskBorderColor: accent,
    doneTaskBkgColor: border,
    doneTaskBorderColor: muted,
    critBkgColor: c('var(--sl-color-red-low)'),
    critBorderColor: c('var(--sl-color-red)'),
    todayLineColor: accent,
    gridColor: border,
    pieStrokeColor: bg,
    pieOuterStrokeColor: border,
    pieSectionTextColor: bg,
    pieTitleTextColor: text,
    pieLegendTextColor: text,
    attributeBackgroundColorOdd: bg,
    attributeBackgroundColorEven: surface,
  };
  palette.forEach((color, i) => {
    vars[`pie${i + 1}`] = color;
    vars[`pie${i + 7}`] = color;
    vars[`git${i}`] = color;
    vars[`gitBranchLabel${i}`] = bg;
  });
  // Mindmap and timeline sections.
  for (let i = 0; i < 12; i++) {
    vars[`cScale${i}`] = palette[i % palette.length];
    vars[`cScaleLabel${i}`] = bg;
    vars[`cScaleInv${i}`] = text;
  }
  vars.git6 = palette[0];
  vars.git7 = palette[1];
  vars.gitBranchLabel6 = bg;
  vars.gitBranchLabel7 = bg;
  vars.commitLabelColor = text;
  vars.commitLabelBackground = surface;
  return vars;
}
