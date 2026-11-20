// In-page audit, evaluated by ux-check.mjs in every page/viewport/theme combination. Plain browser JS (no imports,
// no build step) so it runs unchanged in Chromium, Firefox and WebKit. It returns findings; it never changes the page
// unless `opts.stress` asks for the header stress test.
//
// Finding: { check, severity: 'error' | 'warn', message, selector, detail? }
(opts) => {
  const out = [];
  const add = (check, severity, message, el, detail) =>
    out.push({ check, severity, message, selector: el ? pathOf(el) : '', ...(detail ? { detail } : {}) });

  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;

  function pathOf(el) {
    if (!el || el.nodeType !== 1) return '';
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 5; e = e.parentElement) {
      let s = e.localName;
      if (e.id) {
        s += `#${e.id}`;
        parts.unshift(s);
        break;
      }
      const cls = [...e.classList].filter((c) => !c.startsWith('astro-') && !/^sl-|^print:|^md:/.test(c)).slice(0, 2);
      if (cls.length) s += `.${cls.join('.')}`;
      parts.unshift(s);
    }
    return parts.join(' > ');
  }

  function visible(el) {
    if (!el.isConnected) return false;
    if (el.closest('[hidden], [inert], details:not([open]) > :not(summary)')) return false;
    const pop = el.closest('[popover]');
    if (pop && !pop.matches(':popover-open') && getComputedStyle(pop).display === 'none') return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    return true;
  }
  const srOnly = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      if (r.width <= 2 && r.height <= 2) return true;
      if (cs.clipPath && cs.clipPath.startsWith('inset(50%')) return true;
      if (cs.clip && cs.clip !== 'auto') return true;
    }
    return false;
  };

  // ── Colour maths ──────────────────────────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map();
  function rgba(css) {
    if (colorCache.has(css)) return colorCache.get(css);
    let v;
    const m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(css);
    if (m) {
      let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      v = [+m[1], +m[2], +m[3], a];
    } else {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      v = [d[0], d[1], d[2], d[3] / 255];
    }
    colorCache.set(css, v);
    return v;
  }
  const over = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a);
  };
  const lum = ([r, g, b]) => {
    const f = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const hex = (c) => '#' + c.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  // The colour behind an element: composite every ancestor's background-color; null when an image/gradient is in
  // the way (the result would be a guess).
  function backgroundOf(el) {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 1) break;
    }
    let bg = [255, 255, 255, 1];
    const root = rgba(getComputedStyle(document.documentElement).backgroundColor);
    if (root[3] > 0) bg = over(root, bg);
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    return bg;
  }
  function effectiveOpacity(el) {
    let o = 1;
    for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
    return o;
  }

  // ── Horizontal overflow (WCAG 1.4.10 reflow) ─────────────────────────────────────────────────
  if (opts.overflow) {
    const sw = document.documentElement.scrollWidth;
    if (sw > vw + 1) {
      // Name the widest offenders: elements that stick out of the viewport and are not inside a scroll box.
      const offenders = [];
      for (const el of document.body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.right <= vw + 1 || r.width === 0) continue;
        let clipped = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox !== 'visible' && ox !== 'clip' ? p.getBoundingClientRect().right <= vw + 1 : ox === 'clip') {
            clipped = true;
            break;
          }
        }
        if (!clipped) offenders.push(el);
      }
      // Keep the outermost offenders only.
      const top = offenders.filter((el) => !offenders.includes(el.parentElement)).slice(0, 5);
      add('overflow', 'error', `page scrolls horizontally: ${sw}px content in a ${vw}px viewport`, top[0], {
        offenders: top.map((el) => `${pathOf(el)} (right ${Math.round(el.getBoundingClientRect().right)})`),
      });
    }
    // Tables and code blocks wider than their column must scroll in their own box, not be clipped.
    for (const el of document.querySelectorAll('main table, main pre')) {
      if (!visible(el)) continue;
      let box = el;
      while (box && box !== document.body) {
        const ox = getComputedStyle(box).overflowX;
        if (ox === 'auto' || ox === 'scroll') break;
        box = box.parentElement;
      }
      if (box === document.body || !box) continue;
      if (box.scrollWidth > box.clientWidth + 1) {
        const focusable = box.tabIndex >= 0 || box.querySelector('a, button, [tabindex]:not([tabindex="-1"])');
        if (!focusable)
          add('scroll-region', 'warn', 'scrollable region is not keyboard-focusable (tabindex="0")', box);
      }
    }
  }

  // ── Interactive elements ─────────────────────────────────────────────────────────────────────
  const interactiveSel =
    'a[href], button, select, input:not([type=hidden]), textarea, summary, [role=button], [role=tab], [tabindex]:not([tabindex="-1"])';
  const targets = [...document.querySelectorAll(interactiveSel)].filter(
    (el) => visible(el) && !srOnly(el) && !el.closest('[aria-hidden="true"]'),
  );

  // Inline links inside running text are exempt from target size (WCAG 2.5.8 "inline" exception).
  function inlineInText(el) {
    if (el.localName !== 'a') return false;
    if (getComputedStyle(el).display !== 'inline') return false;
    const block = el.parentElement?.closest('p, li, td, th, dd, figcaption, blockquote, .live-ex__status');
    if (!block) return false;
    const text = block.textContent.replace(/\s+/g, ' ').trim();
    const own = el.textContent.replace(/\s+/g, ' ').trim();
    return text.length > own.length + 3;
  }
  // A link whose ::after stretches over a positioned ancestor (card pattern): the ancestor is the hit area.
  function hitRect(el) {
    let r = el.getBoundingClientRect();
    for (const pseudo of ['::before', '::after']) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content === 'none' || ps.content === 'normal' || ps.position !== 'absolute') continue;
      let cb = getComputedStyle(el).position !== 'static' ? el : null;
      for (let p = el.parentElement; !cb && p; p = p.parentElement) if (getComputedStyle(p).position !== 'static') cb = p;
      if (!cb) continue;
      const c = cb.getBoundingClientRect();
      const px = (v) => (v === 'auto' ? null : parseFloat(v));
      const [t, rt, b, l] = [px(ps.top), px(ps.right), px(ps.bottom), px(ps.left)];
      if (t === null || rt === null || b === null || l === null) continue;
      const box = { left: c.left + l, top: c.top + t, right: c.right - rt, bottom: c.bottom - b };
      const u = {
        left: Math.min(r.left, box.left), top: Math.min(r.top, box.top),
        right: Math.max(r.right, box.right), bottom: Math.max(r.bottom, box.bottom),
      };
      r = { ...u, width: u.right - u.left, height: u.bottom - u.top };
    }
    // A label wrapping/for a control enlarges its hit area.
    if (el.matches('select, input, textarea') && el.labels?.length) {
      for (const l of el.labels) {
        const lr = l.getBoundingClientRect();
        if (lr.width && lr.height) {
          const left = Math.min(r.left, lr.left), top = Math.min(r.top, lr.top);
          const right = Math.max(r.right, lr.right), bottom = Math.max(r.bottom, lr.bottom);
          // Only when they touch: a label far away does not help.
          if (right - left < r.width + lr.width + 4 && bottom - top < r.height + lr.height + 4)
            r = { left, top, right, bottom, width: right - left, height: bottom - top };
        }
      }
    }
    return r;
  }

  if (opts.targets) {
    const rects = targets.map((el) => ({ el, r: hitRect(el), inline: inlineInText(el) }));
    for (const t of rects) {
      if (t.inline) continue;
      const { width: w, height: h } = t.r;
      if (w >= 44 && h >= 44) continue;
      // Skip things scrolled out of a scroll box or off the page horizontally (e.g. the parked skip link).
      if (t.r.bottom < -50 || t.r.right < 0) continue;
      const small = w < 24 || h < 24;
      if (small) {
        // Spacing exception: a 24px circle centred on the target must not touch any other target.
        const cx = (t.r.left + t.r.right) / 2, cy = (t.r.top + t.r.bottom) / 2;
        const clash = rects.some((o) => {
          if (o === t || o.el.contains(t.el) || t.el.contains(o.el)) return false;
          const dx = Math.max(o.r.left - cx, 0, cx - o.r.right);
          const dy = Math.max(o.r.top - cy, 0, cy - o.r.bottom);
          return Math.hypot(dx, dy) < 12;
        });
        if (clash) {
          add('target-size', 'error', `target ${Math.round(w)}×${Math.round(h)} < 24×24 and too close to another`, t.el, {
            text: (t.el.textContent || t.el.getAttribute('aria-label') || '').trim().slice(0, 40),
          });
          continue;
        }
      }
      if (opts.touch)
        add('target-size-touch', 'warn', `touch target ${Math.round(w)}×${Math.round(h)} < 44×44`, t.el, {
          text: (t.el.textContent || t.el.getAttribute('aria-label') || '').trim().slice(0, 40),
        });
    }
  }

  // ── Header: nothing overlaps, nothing leaves the viewport, the bar keeps its height ───────────
  function headerItems() {
    const sel = [
      '.site-header .brand',
      '.site-header .version',
      '.site-header .nav a',
      '.site-header .search > *',
      '.site-header .actions > *',
      '.site-header .menu > summary',
      '.sl-menu-button',
    ];
    return [...document.querySelectorAll(sel.join(','))].filter((el) => visible(el) && !srOnly(el));
  }
  function checkHeader(label) {
    const items = headerItems();
    const bar = document.querySelector('.site-bar, body > .page > header.header, header.header');
    for (const el of items) {
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.right > vw + 1)
        add('header', 'error', `${label}header item outside the viewport (${Math.round(r.left)}–${Math.round(r.right)})`, el);
    }
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        if (items[i].contains(items[j]) || items[j].contains(items[i])) continue;
        const a = items[i].getBoundingClientRect(), b = items[j].getBoundingClientRect();
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 1 && iy > 1)
          add('header', 'error', `${label}header items overlap: ${pathOf(items[j])}`, items[i]);
      }
    if (bar) {
      const r = bar.getBoundingClientRect();
      for (const el of items) {
        const e = el.getBoundingClientRect();
        if (e.top < r.top - 1 || e.bottom > r.bottom + 1)
          add('header', 'error', `${label}header item does not fit the bar's height`, el);
      }
    }
    const brand = document.querySelector('.site-header .brand');
    if (brand && visible(brand) && brand.getBoundingClientRect().width < 48)
      add('header', 'error', `${label}project name squeezed to ${Math.round(brand.getBoundingClientRect().width)}px`, brand);
  }
  if (opts.header) checkHeader(opts.headerLabel ?? '');

  // ── Contrast (WCAG 1.4.3) ────────────────────────────────────────────────────────────────────
  if (opts.contrast) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      if (el.closest('svg, iframe, noscript, script, style, template, [aria-hidden="true"]')) continue;
      if (!visible(el) || srOnly(el)) continue;
      if (el.closest(':disabled, [aria-disabled="true"]')) continue;
      const cs = getComputedStyle(el);
      const bg = backgroundOf(el);
      if (!bg) continue;
      const fg0 = rgba(cs.color);
      const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * effectiveOpacity(el)], bg);
      const r = ratio(fg, bg);
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      if (r + 0.005 < need) {
        const inCode = !!el.closest('pre, .expressive-code, .astro-code');
        add('contrast', inCode ? 'warn' : 'error', `contrast ${r.toFixed(2)} < ${need} (${hex(fg)} on ${hex(bg)})`, el, {
          text: n.textContent.trim().slice(0, 40),
          ...(inCode ? { note: 'syntax-highlighting theme' } : {}),
        });
      }
    }
  }

  // ── Semantics ────────────────────────────────────────────────────────────────────────────────
  if (opts.semantics) {
    const html = document.documentElement;
    if (!html.lang) add('semantics', 'error', '<html> has no lang', html);
    const mains = document.querySelectorAll('main');
    if (mains.length !== 1) add('semantics', 'error', `${mains.length} <main> elements`, null);
    if (!document.querySelector('header, [role=banner]')) add('semantics', 'warn', 'no banner landmark', null);
    if (!document.querySelector('footer, [role=contentinfo]')) add('semantics', 'warn', 'no contentinfo landmark', null);
    const h1s = [...document.querySelectorAll('h1')].filter((h) => visible(h) || srOnly(h));
    if (h1s.length !== 1) add('semantics', 'error', `${h1s.length} <h1> elements`, h1s[1] || null);
    let last = 0;
    for (const h of document.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
      if (!visible(h) && !srOnly(h)) continue;
      const lvl = +h.localName[1];
      if (last && lvl > last + 1) add('semantics', 'error', `heading level skips h${last} → h${lvl}`, h);
      last = lvl;
    }
    const ids = new Map();
    for (const el of document.querySelectorAll('[id]')) ids.set(el.id, (ids.get(el.id) || 0) + 1);
    for (const [id, n] of ids) if (n > 1) add('semantics', 'error', `duplicate id "${id}" ×${n}`, document.getElementById(id));
    for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt')) add('semantics', 'error', 'img without alt', img);
    for (const el of document.querySelectorAll(interactiveSel)) {
      if (el.closest('[aria-hidden="true"], [hidden]')) continue;
      if (!accName(el)) add('semantics', 'error', `${el.localName} without an accessible name`, el);
    }
    const navLabels = new Map();
    for (const nav of document.querySelectorAll('nav')) {
      if (!visible(nav)) continue;
      const lb = nav.getAttribute('aria-labelledby');
      const l = nav.getAttribute('aria-label') || (lb && document.getElementById(lb)?.textContent.trim()) || '(unlabelled)';
      navLabels.set(l, (navLabels.get(l) || 0) + 1);
    }
    for (const [l, n] of navLabels) if (n > 1) add('semantics', 'warn', `${n} <nav> landmarks share the label "${l}"`, null);
    for (const el of document.querySelectorAll('summary, [aria-haspopup], [popovertarget]')) {
      if (el.localName === 'summary' && !el.hasAttribute('aria-expanded') && el.closest('.site-header'))
        add('semantics', 'warn', 'menu button without aria-expanded', el);
    }
  }
  function accName(el) {
    if (el.getAttribute('aria-label')?.trim()) return true;
    const lb = el.getAttribute('aria-labelledby');
    if (lb && lb.split(/\s+/).some((id) => document.getElementById(id)?.textContent.trim())) return true;
    if (el.labels?.length && [...el.labels].some((l) => l.textContent.trim())) return true;
    if (el.textContent.trim()) return true;
    if (el.querySelector('img[alt]:not([alt=""])')) return true;
    if (el.getAttribute('title')?.trim()) return true;
    if (el.localName === 'textarea' || el.localName === 'input') return !!el.getAttribute('placeholder');
    return false;
  }

  // ── Line length and images ───────────────────────────────────────────────────────────────────
  if (opts.measure) {
    const m = document.createElement('canvas').getContext('2d');
    for (const p of document.querySelectorAll('main p, main li')) {
      if (!visible(p) || p.closest('pre, nav, .live-ex__preview, table')) continue;
      if (p.textContent.trim().length < 160) continue;
      const cs = getComputedStyle(p);
      m.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const sample = 'the quick brown fox jumps over a lazy dog, then naps.';
      const chw = m.measureText(sample).width / sample.length;
      const chars = p.getBoundingClientRect().width / chw;
      if (chars > 90) add('measure', 'warn', `~${Math.round(chars)} characters per line`, p);
    }
    for (const img of document.querySelectorAll('img')) {
      if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
        if (getComputedStyle(img).aspectRatio === 'auto')
          add('images', 'warn', 'img without width/height (layout shift)', img);
      }
      const r = img.getBoundingClientRect();
      if (r.top > vh * 1.2 && img.loading !== 'lazy') add('images', 'warn', 'below-the-fold img is not lazy', img);
    }
  }

  // ── Header stress: long name, many nav items, then re-check ─────────────────────────────────
  if (opts.stress) {
    const brand = document.querySelector('.site-header .brand');
    if (brand) brand.textContent = 'Extraordinarily Long Project Name Framework';
    const ul = document.querySelector('.site-header .nav ul');
    if (ul && ul.firstElementChild) {
      for (const label of ['Guides', 'Reference API', 'Examples', 'Community', 'Changelog']) {
        const li = ul.firstElementChild.cloneNode(true);
        li.querySelector('a').textContent = label;
        li.querySelector('a').removeAttribute('aria-current');
        ul.append(li);
      }
    }
  }

  return out;
}
