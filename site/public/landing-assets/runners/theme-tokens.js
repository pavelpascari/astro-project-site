// <Live runner> for the landing page's theme playground. The source is a customCss file: `:root { --site-…: … }`
// and `:root[data-theme='light'] { … }`. The runner restyles a small site preview with it, reports WCAG contrast for
// the current theme, and, when the page has opted in (the "Apply to this page" switch), restyles the whole page.
//
// Only custom properties in :root rules are used: the playground changes tokens, never arbitrary CSS.

let seq = 0;

/** [{ theme: 'any' | 'light' | 'dark', decls: [[name, value]] }] from the source; problems for anything ignored. */
function parse(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const problems = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  let consumed = '';
  while ((m = re.exec(css))) {
    consumed += m[0];
    const selector = m[1].trim().replace(/\s+/g, ' ');
    const sel = /^(?:html)?:root(?:\[data-theme=(['"]?)(light|dark)\1\])?$/.exec(selector);
    if (!sel) {
      problems.push(`"${selector}" ignored: the playground only reads :root rules`);
      continue;
    }
    const decls = [];
    for (const raw of m[2].split(';')) {
      const d = raw.trim();
      if (!d) continue;
      const kv = /^(--[\w-]+)\s*:\s*([^;{}<>]+)$/.exec(d);
      if (kv) decls.push([kv[1], kv[2].trim()]);
      else problems.push(`"${d}" ignored: only custom properties (--site-…) are tokens`);
    }
    rules.push({ theme: sel[2] ?? 'any', decls });
  }
  const leftover = css.replace(re, '').trim();
  if (leftover) throw new SyntaxError(`could not read "${leftover.slice(0, 40)}": expected selector { --token: value; }`);
  return { rules, problems };
}

const block = (selector, decls) => `${selector}{${decls.map(([k, v]) => `${k}:${v}`).join(';')}}`;

/** Resolves any CSS colour to [r, g, b] (0–255) through the browser itself. */
function rgbOf(probe, color) {
  probe.style.color = '';
  probe.style.color = color;
  if (!probe.style.color) return undefined;
  const c = getComputedStyle(probe).color;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const g = cv.getContext('2d', { willReadFrequently: true });
  if (!g) return undefined;
  g.fillStyle = '#000';
  g.fillStyle = c;
  g.fillRect(0, 0, 1, 1);
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
  return [r, gr, b];
}
const lum = ([r, g, b]) =>
  [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

export function run(source, mount, ctx) {
  const { rules, problems } = parse(source);
  const scope = `tp-${++seq}`;
  const sel = (theme) => (theme === 'any' ? `.${scope}` : `:root[data-theme='${theme}'] .${scope}`);
  const previewCss = rules.map((r) => block(sel(r.theme), r.decls)).join('\n');
  const pageCss = rules.map((r) => block(r.theme === 'any' ? 'html:root' : `html:root[data-theme='${r.theme}']`, r.decls)).join('\n');

  const style = document.createElement('style');
  style.textContent = previewCss;
  const box = document.createElement('div');
  box.className = `tp ${scope}`;
  box.innerHTML = `
    <div class="tp-bar"><span class="tp-brand">my-lib</span><span class="tp-pill">v1.2.0</span>
      <span class="tp-nav"><span class="tp-on">Docs</span><span>Gallery</span></span></div>
    <div class="tp-main">
      <div class="tp-side" aria-hidden="true"><p>Reference</p><span class="tp-on">Getting started</span><span>API</span><span>Deploying</span></div>
      <div class="tp-content">
        <p class="tp-h">Getting started</p>
        <p class="tp-p">Install the package, then read <span class="tp-link">the API</span>. Muted text sits here.</p>
        <p class="tp-actions"><span class="tp-btn tp-btn--primary">Get started</span><span class="tp-btn">Gallery</span></p>
        <p class="tp-code"><span>$</span> npm i my-lib</p>
        <div class="tp-card"><span class="tp-kind">demo</span><span class="tp-card-t">Hello app</span><span class="tp-p">Mirrored as it is.</span></div>
      </div>
    </div>`;
  mount.append(style, box);

  // The page-wide version: kept on window for the "Apply to this page" switch, and applied now if it is on.
  window.__themePlaygroundCss = pageCss;
  const applied = document.getElementById('theme-playground-page');
  if (applied) applied.textContent = pageCss;
  window.dispatchEvent(new CustomEvent('theme-playground:css', { detail: pageCss }));

  // Contrast in the theme being shown, read from the preview itself.
  const cs = getComputedStyle(box);
  const token = (n) => cs.getPropertyValue(n).trim();
  const probe = document.createElement('span');
  probe.hidden = true;
  box.append(probe);
  const bg = rgbOf(probe, token('--site-bg'));
  const pairs = [
    ['text', token('--site-text'), bg],
    ['muted', token('--site-muted'), bg],
    ['links', getComputedStyle(box.querySelector('.tp-link')).color, bg],
    ['button', token('--site-bg'), rgbOf(probe, token('--site-accent'))],
  ];
  const results = pairs
    .map(([label, fg, back]) => {
      const f = rgbOf(probe, fg);
      return f && back ? { label, r: ratio(f, back) } : undefined;
    })
    .filter(Boolean);
  probe.remove();
  const low = results.filter((x) => x.r < 4.5);
  const summary = results.map((x) => `${x.label} ${x.r.toFixed(1)}:1`).join(' · ');
  if (problems.length) ctx.status(problems[0], 'warn');
  else if (low.length) ctx.status(`${ctx.theme}: ${summary}. Below 4.5:1: ${low.map((x) => x.label).join(', ')}`, 'warn');
  else ctx.status(`${ctx.theme}, contrast: ${summary}`, 'ok');
}
