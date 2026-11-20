// A <Live runner> for the theming docs: CSS custom property declarations in, a preview of the site's look out.
//
// The source is a list of `--site-*: value;` declarations (comments allowed). The runner renders a miniature page
// (header, card, button, link, code) with those tokens applied, recomputing the derived tokens the way
// astro-project-site/theme.css does. With `options.apply: true` it shows a button that applies the tokens to the
// whole page you are reading; the run's cleanup takes them off again.

const DERIVED = {
  '--site-accent-soft': 'color-mix(in oklab, var(--site-accent) 16%, var(--site-bg))',
  '--site-accent-strong': 'color-mix(in oklab, var(--site-accent) 70%, var(--site-text))',
  '--site-on-accent': 'var(--site-bg)',
  '--site-link': 'var(--site-accent-strong)',
  '--site-radius-sm': 'calc(var(--site-radius) / 2)',
};

/** @param {string} source */
function parseDeclarations(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  /** @type {[string, string][]} */
  const out = [];
  for (const raw of css.split(';')) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(line);
    if (!m) throw new SyntaxError(`expected "--name: value;", got "${line.slice(0, 40)}"`);
    if (!CSS.supports('--x', m[2])) throw new SyntaxError(`${m[1]}: invalid value "${m[2]}"`);
    out.push([m[1], m[2].trim()]);
  }
  return out;
}

/** @type {import('astro-project-site').LiveRunner} */
export function run(source, mount, ctx) {
  const decls = parseDeclarations(source);
  const unknown = decls.filter(([k]) => !k.startsWith('--site-'));
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = [...decls, ...Object.entries(DERIVED)].map(([k, v]) => `${k}:${v};`).join('');
  shadow.innerHTML = `
    <style>
      .page { ${style} background: var(--site-bg); color: var(--site-text); border: 1px solid var(--site-border);
        border-radius: var(--site-radius); overflow: hidden; font-family: var(--site-font-body, system-ui); }
      header { display: flex; gap: 1rem; align-items: center; padding: .6rem 1rem; background: var(--site-surface);
        border-bottom: 1px solid var(--site-border); }
      header b { font-family: var(--site-font-heading, inherit); }
      header span { color: var(--site-muted); font-size: .875rem; }
      main { padding: 1rem; display: grid; gap: .75rem; }
      .card { padding: .75rem 1rem; background: var(--site-surface); border: 1px solid var(--site-border);
        border-radius: var(--site-radius); }
      .card h3 { margin: 0 0 .25rem; font: 600 1rem/1.3 var(--site-font-heading, inherit); }
      .card p { margin: 0; color: var(--site-muted); }
      .row { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
      .btn { padding: .4rem .9rem; border-radius: var(--site-radius-sm); background: var(--site-accent);
        color: var(--site-on-accent); font-weight: 600; }
      .soft { padding: .4rem .9rem; border-radius: var(--site-radius-sm); background: var(--site-accent-soft);
        color: var(--site-accent-strong); }
      a { color: var(--site-link); }
      code { padding: .1rem .4rem; border-radius: var(--site-radius-sm); background: var(--site-code-bg);
        color: var(--site-code-text); font-family: var(--site-font-mono, monospace); font-size: .85em; }
    </style>
    <div class="page">
      <header><b>My Lib</b><span>Docs</span><span>Gallery</span></header>
      <main>
        <div class="card"><h3>A feature card</h3><p>Muted body text on the surface colour.</p></div>
        <div class="row"><span class="btn">Get started</span><span class="soft">Secondary</span>
          <a href="#theme-preview">A link</a> <code>npm i my-lib</code></div>
      </main>
    </div>`;
  mount.append(host);

  /** Tokens applied to <html> by the button, removed by the cleanup. */
  const applied = [];
  const root = document.documentElement;
  const undo = () => {
    for (const k of applied.splice(0)) root.style.removeProperty(k);
  };
  if (ctx.options.apply) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Apply to this page';
    button.style.cssText = 'margin-top:.75rem;font:inherit;padding:.3rem .9rem;border-radius:999px;cursor:pointer;' +
      'border:1px solid var(--sl-color-accent);background:transparent;color:var(--sl-color-white)';
    button.addEventListener('click', () => {
      if (applied.length) {
        undo();
        button.textContent = 'Apply to this page';
        ctx.status('page tokens restored', 'info');
        return;
      }
      for (const [k, v] of decls) {
        root.style.setProperty(k, v);
        applied.push(k);
      }
      button.textContent = 'Restore this page';
      ctx.status(`applied ${applied.length} tokens to <html>; edit, Reset or Restore to undo`, 'ok');
    });
    mount.append(button);
  }
  if (unknown.length) ctx.status(`not a --site-* token: ${unknown.map(([k]) => k).join(', ')}`, 'warn');
  else if (!ctx.options.apply) ctx.status(`${decls.length} tokens`, 'ok');
  return undo;
}
