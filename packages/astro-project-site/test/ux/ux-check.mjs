#!/usr/bin/env node
// Responsive-design and UX check for a built astro-project-site site, run against a server (e.g. `astro preview`).
//
//   node packages/astro-project-site/test/ux/ux-check.mjs --url http://localhost:4321 [options]
//
// Playwright is not a dependency of this repo. Install it anywhere and point at it:
//   mkdir /tmp/pw && cd /tmp/pw && npm i playwright && npx playwright install chromium firefox webkit
//   PLAYWRIGHT_DIR=/tmp/pw node …/ux-check.mjs --url …        (or --playwright /tmp/pw)
//
// Options:
//   --url <base>          site to check (required)
//   --out <dir>           report + screenshots (default ./ux-report)
//   --engines <list>      chromium,firefox,webkit (default: all three; missing browsers are skipped with a warning)
//   --pages <list>        comma-separated paths instead of discovering them from the sitemap and links
//   --max-pages <n>       cap on discovered pages (default 40)
//   --quick               chromium only, four viewports, no screenshots of every combination
//   --no-shots            no screenshots
//
// Writes <out>/report.json, <out>/report.md and <out>/shots/*.png. Exit code 1 when any error-level finding is
// reported (horizontal overflow, targets under 24×24 without spacing, contrast below AA, console errors, failed
// requests, overlapping header items, broken keyboard/menu behaviour, …), 0 otherwise. Warnings never fail.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const auditSource = readFileSync(join(here, 'audit.js'), 'utf8');

// ── Arguments ──────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const base = opt('url');
if (!base || flag('help')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 20).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(base ? 0 : 2);
}
const origin = new URL(base).origin;
const outDir = resolve(opt('out', 'ux-report'));
const shotsDir = join(outDir, 'shots');
mkdirSync(shotsDir, { recursive: true });
const quick = flag('quick');
const shots = !flag('no-shots');
const engines = opt('engines', quick ? 'chromium' : 'chromium,firefox,webkit').split(',');
const maxPages = Number(opt('max-pages', 40));

async function loadPlaywright() {
  const dir = opt('playwright', process.env.PLAYWRIGHT_DIR);
  if (dir) {
    const require = createRequire(pathToFileURL(join(resolve(dir), 'package.json')));
    return import(pathToFileURL(require.resolve('playwright')).href);
  }
  try {
    return await import('playwright');
  } catch {
    console.error('Playwright not found. Install it in a folder and pass --playwright <folder> or PLAYWRIGHT_DIR.');
    process.exit(2);
  }
}
const pwModule = await loadPlaywright();
const pw = pwModule.chromium ? pwModule : pwModule.default;

// ── Matrix ─────────────────────────────────────────────────────────────────────────────────────
const VIEWPORTS = {
  '320x568': { width: 320, height: 568, mobile: true },
  '360x740': { width: 360, height: 740, mobile: true },
  '375x667': { width: 375, height: 667, mobile: true },
  '390x844': { width: 390, height: 844, mobile: true },
  '414x896': { width: 414, height: 896, mobile: true },
  '667x375': { width: 667, height: 375, mobile: true },
  '844x390': { width: 844, height: 390, mobile: true },
  '768x1024': { width: 768, height: 1024, mobile: true },
  '1024x768': { width: 1024, height: 768, mobile: true },
  '1280x800': { width: 1280, height: 800 },
  '1440x900': { width: 1440, height: 900 },
  '1920x1080': { width: 1920, height: 1080 },
  '2560x1440': { width: 2560, height: 1440 },
  // 1280×800 at 200% and 400% browser zoom: the CSS viewport WCAG 1.4.10 reflow is about.
  'zoom200': { width: 640, height: 400 },
  'zoom400': { width: 320, height: 200 },
  // Large default font size (browser setting 32px instead of 16px), Chromium only.
  'font32-1280': { width: 1280, height: 800, font: 32 },
  'font32-375': { width: 375, height: 667, mobile: true, font: 32 },
};
const MAIN = ['375x667', '768x1024', '1280x800'];
const plan = {
  chromium: quick ? ['320x568', '375x667', '768x1024', '1280x800'] : Object.keys(VIEWPORTS),
  firefox: MAIN.concat('667x375', '1024x768'),
  webkit: MAIN.concat('390x844', '844x390', '1024x768'),
};
// Contrast and focus are colour-dependent: both themes on these viewports.
const BOTH_THEMES = new Set(['375x667', '1280x800']);

// ── Findings ───────────────────────────────────────────────────────────────────────────────────
const findings = [];
const info = { pages: [], tokens: {}, perf: {}, focusOrder: {}, notes: [] };
let mirrorPages = new Set();
function record(list, ctx) {
  for (const f of list) {
    const scope = mirrorPages.has(ctx.page) ? 'mirror' : 'site';
    findings.push({ ...f, severity: scope === 'mirror' && f.severity === 'error' ? 'warn' : f.severity, scope, ...ctx });
  }
}
const fail = (check, message, ctx, extra = {}) => record([{ check, severity: 'error', message, selector: '', ...extra }], ctx);
const warn = (check, message, ctx, extra = {}) => record([{ check, severity: 'warn', message, selector: '', ...extra }], ctx);

// ── Pages ──────────────────────────────────────────────────────────────────────────────────────
async function discover() {
  if (opt('pages')) return opt('pages').split(',');
  const paths = new Set(['/']);
  try {
    const index = await (await fetch(new URL('/sitemap-index.xml', origin))).text();
    for (const [, loc] of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const xml = await (await fetch(new URL(new URL(loc).pathname, origin))).text();
      for (const [, u] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) paths.add(new URL(u).pathname);
    }
  } catch {
    info.notes.push('no sitemap; pages found by following links only');
  }
  // Follow links one level from what we have, to find mirrored apps and anything outside the sitemap.
  for (const p of [...paths]) {
    const html = await (await fetch(new URL(p, origin))).text();
    for (const [, href] of html.matchAll(/<a\s[^>]*href="([^"#?]+)/g)) {
      const u = new URL(href, new URL(p, origin));
      if (u.origin !== origin || /\.(\w+)$/.test(u.pathname) && !u.pathname.endsWith('.html')) continue;
      paths.add(u.pathname);
    }
  }
  const list = [...paths].slice(0, maxPages);
  list.push('/__ux-check-missing-page__/');
  return list;
}

async function checkLinks(pages) {
  const hrefs = new Map();
  for (const p of pages) {
    const res = await fetch(new URL(p, origin));
    const html = await res.text();
    if (!/<meta name="generator" content="Astro/.test(html)) mirrorPages.add(p);
    for (const [, href] of html.matchAll(/<(?:a|link)\s[^>]*href="([^"#]+)/g)) {
      const u = new URL(href.replaceAll('&amp;', '&'), new URL(p, origin));
      if (u.origin === origin && !hrefs.has(u.pathname)) hrefs.set(u.pathname, p);
    }
  }
  await Promise.all(
    [...hrefs].map(async ([path, from]) => {
      const res = await fetch(new URL(path, origin), { method: 'GET' });
      if (res.status >= 400) fail('links', `link to ${path} → HTTP ${res.status}`, { page: from, engine: '-', viewport: '-', theme: '-' });
    }),
  );
  info.linksChecked = hrefs.size;
}

// ── Browser helpers ────────────────────────────────────────────────────────────────────────────
const slug = (p) => (p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/[^\w-]+/g, '_')) || 'home';
async function newContext(browser, engine, vpName, extra = {}) {
  const vp = VIEWPORTS[vpName];
  const options = { viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, ...extra };
  if (vp.mobile) {
    options.hasTouch = true;
    if (engine !== 'firefox') options.isMobile = true;
  }
  return browser.newContext(options);
}
async function openPage(context, path, { theme, engine, viewport, collect = true } = {}) {
  const page = await context.newPage();
  const ctx = { page: path, engine, viewport, theme: theme ?? 'auto' };
  const errors = [];
  if (collect) {
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // The deliberate 404 probe logs its own 404.
      if (path.startsWith('/__ux-check') && /status of 404/.test(m.text())) return;
      errors.push(`console: ${m.text().slice(0, 200)}`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${String(e.message).slice(0, 200)}`));
    page.on('response', (r) => {
      const u = new URL(r.url());
      if (u.origin !== origin || r.status() < 400) return;
      if (path.startsWith('/__ux-check') && u.pathname === path) return;
      errors.push(`HTTP ${r.status()} ${u.pathname}`);
    });
  }
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('starlight-theme', t === 'auto' ? '' : t);
    } catch {}
  }, theme ?? 'auto');
  if (VIEWPORTS[viewport]?.font && engine === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: VIEWPORTS[viewport].font, fixed: VIEWPORTS[viewport].font - 3 } });
  }
  await page.goto(new URL(path, origin).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(150);
  return { page, ctx, errors };
}
const audit = (page, opts) => page.evaluate(`(${auditSource})(${JSON.stringify(opts)})`);
function flushErrors(errors, ctx) {
  for (const e of new Set(errors)) fail('console', e, ctx);
  errors.length = 0;
}
async function shot(page, name, fullPage = false) {
  if (!shots) return;
  await page.screenshot({ path: join(shotsDir, `${name}.png`), fullPage, timeout: 15000 }).catch(() => {});
}
async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}
async function scenario(name, ctx, fn) {
  try {
    await fn();
  } catch (e) {
    fail(`scenario:${name}`, `scenario crashed: ${String(e.message).split('\n')[0]}`, ctx);
  }
}

// ── Matrix run: layout, targets, header, contrast, semantics on every page/viewport ─────────────
async function runMatrix(browser, engine, pages) {
  for (const vpName of plan[engine]) {
    const vp = VIEWPORTS[vpName];
    if (vp.font && engine !== 'chromium') continue;
    const themes = engine === 'chromium' && BOTH_THEMES.has(vpName) ? ['dark', 'light'] : ['dark'];
    const context = await newContext(browser, engine, vpName);
    for (const theme of themes) {
      await pool(pages, 4, async (path) => {
        const { page, ctx, errors } = await openPage(context, path, { theme, engine, viewport: vpName });
        const first = engine === 'chromium' && vpName === '1280x800' && theme === 'dark';
        const colour = engine === 'chromium' ? BOTH_THEMES.has(vpName) : vpName === '1280x800';
        record(
          await audit(page, {
            overflow: true,
            targets: !vp.font && !vpName.startsWith('zoom'),
            touch: !!vp.mobile,
            header: true,
            contrast: colour,
            semantics: first,
            measure: first || (engine === 'chromium' && vpName === '1920x1080'),
          }),
          ctx,
        );
        if ((vpName === '1024x768' || vpName === '1280x800' || vpName === '375x667' || vpName === '768x1024') && theme === 'dark') {
          // Header stress test: a long project name and eight nav items; give the page a moment to adapt.
          await audit(page, { stress: true });
          await page.waitForTimeout(150);
          record(await audit(page, { header: true, headerLabel: '[stress] ' }), ctx);
        }
        flushErrors(errors, ctx);
        if (!info.pages.includes(path)) info.pages.push(path);
        const full = engine === 'chromium' && BOTH_THEMES.has(vpName);
        const always = path === '/' || path === pages.find((p) => p.startsWith('/docs/')) || full || engine !== 'chromium';
        if (always) await shot(page, `${engine}-${vpName}-${theme}-${slug(path)}`, full);
        await page.close();
      });
    }
    await context.close();
  }
}

// ── Scenarios ──────────────────────────────────────────────────────────────────────────────────
async function themeFlash(browser, engine, pages) {
  for (const path of pages.filter((p) => !mirrorPages.has(p)).slice(0, 6)) {
    for (const [stored, os] of [['light', 'dark'], ['dark', 'light'], ['', 'light'], ['', 'dark']]) {
      const context = await browser.newContext({ colorScheme: os, viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      await page.addInitScript((s) => {
        localStorage.setItem('starlight-theme', s);
        new MutationObserver((_, obs) => {
          if (document.body) {
            window.__uxFirstTheme = document.documentElement.dataset.theme ?? '(none)';
            obs.disconnect();
          }
        }).observe(document, { childList: true, subtree: true });
      }, stored);
      await page.goto(new URL(path, origin).href);
      const first = await page.evaluate(() => window.__uxFirstTheme);
      const expected = stored || os;
      const ctx = { page: path, engine, viewport: '1280x800', theme: `${stored || 'auto'}/os-${os}` };
      if (first !== expected) fail('theme-flash', `first paint has data-theme="${first}", expected "${expected}"`, ctx);
      await context.close();
    }
  }
}

async function keyboard(browser, engine, pages) {
  for (const vpName of ['1280x800', '375x667']) {
    for (const theme of engine === 'chromium' ? ['dark', 'light'] : ['dark']) {
      const context = await newContext(browser, engine, vpName);
      for (const path of pages) {
        if (mirrorPages.has(path)) continue;
        const { page, ctx } = await openPage(context, path, { theme, engine, viewport: vpName, collect: false });
        await scenario('keyboard', ctx, async () => {
          // Skip link first.
          await page.keyboard.press(engine === 'webkit' ? 'Alt+Tab' : 'Tab');
          const skip = await page.evaluate(() => {
            const a = document.activeElement;
            const r = a.getBoundingClientRect();
            return { text: a.textContent.trim(), href: a.getAttribute('href'), top: r.top, h: r.height };
          });
          if (!/skip/i.test(skip.text) || !skip.href?.startsWith('#')) fail('skip-link', `first Tab stop is "${skip.text.slice(0, 30)}", not a skip link`, ctx);
          else if (skip.top < 0 || skip.h < 1) fail('skip-link', 'skip link focused but not visible', ctx);
          else {
            await page.keyboard.press('Enter');
            await page.keyboard.press(engine === 'webkit' ? 'Alt+Tab' : 'Tab');
            const inMain = await page.evaluate(() => !!document.activeElement.closest('main, .main-frame'));
            if (!inMain) fail('skip-link', 'after the skip link, Tab does not land in the main content', ctx);
          }
          // Walk the tab order.
          await page.evaluate(() => {
            document.activeElement?.blur();
            window.scrollTo(0, 0);
          });
          const order = [];
          let previous = null;
          for (let i = 0; i < 90; i++) {
            await page.keyboard.press(engine === 'webkit' ? 'Alt+Tab' : 'Tab');
            const s = await page.evaluate(async () => {
              const el = document.activeElement;
              if (!el || el === document.body) return null;
              // Smooth scrolling brings the element into view over a few frames: wait until it stops moving.
              for (let i = 0, last = NaN; i < 60; i++) {
                await new Promise((r) => requestAnimationFrame(r));
                const top = el.getBoundingClientRect().top;
                if (top === last) break;
                last = top;
              }
              const label = (el.getAttribute('aria-label') || el.textContent || el.localName).trim().replace(/\s+/g, ' ').slice(0, 30);
              const path = [];
              for (let e = el; e && path.length < 3; e = e.parentElement) path.unshift(e.localName + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').filter((c) => !c.startsWith('astro-'))[0] : ''));
              const sel = path.join(' > ');
              if (el.localName === 'iframe') return { sel, label, iframe: true };
              let ring = false;
              for (let e = el, n = 0; e && n < 5; e = e.parentElement, n++) {
                const cs = getComputedStyle(e);
                if ((cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow !== 'none' && n === 0)) {
                  ring = true;
                  break;
                }
              }
              const r = el.getBoundingClientRect();
              // WCAG 2.4.11: the focused element must not be entirely hidden by author content (sticky header…).
              // Sample points across it and ask what is on top there.
              const pts = [[0.5, 0.5], [0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8]]
                .map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy])
                .filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
              const mine = (x, y) => {
                const t = document.elementFromPoint(x, y);
                return !!t && (el === t || el.contains(t) || (t.contains(el) && getComputedStyle(t).pointerEvents !== 'none'));
              };
              const seen = pts.map(([x, y]) => mine(x, y));
              const obscured = pts.length > 0 && !seen.some(Boolean);
              const partly = !obscured && pts.length > 0 && !seen[0];
              const offscreen = pts.length === 0;
              const tabindex = el.tabIndex;
              return { sel, label, ring, obscured, partly, offscreen, textarea: el.localName === 'textarea', tabindex, left: r.left, right: r.right, vw: innerWidth };
            });
            if (!s) break;
            if (previous && s.sel === previous.sel && s.label === previous.label && s.textarea) {
              // Live editor keeps Tab; Escape then Tab leaves.
              await page.keyboard.press('Escape');
              continue;
            }
            if (order.length && order[0].sel === s.sel && order[0].label === s.label) break; // wrapped around
            order.push(s);
            previous = s;
            if (s.iframe) continue;
            if (!s.ring) fail('focus-visible', `no visible focus indicator on ${s.sel} "${s.label}"`, ctx);
            if (s.obscured) fail('focus-obscured', `focused ${s.sel} "${s.label}" is entirely covered by other content`, ctx);
            else if (s.partly) warn('focus-obscured', `focused ${s.sel} "${s.label}" is partly covered`, ctx);
            if (s.offscreen) warn('focus-offscreen', `focused ${s.sel} "${s.label}" was not scrolled into view`, ctx);
            if (s.right > s.vw + 1 || s.left < -1) fail('focus-offscreen', `focused ${s.sel} "${s.label}" is off-screen horizontally`, ctx);
            if (s.tabindex > 0) fail('tab-order', `positive tabindex on ${s.sel}`, ctx);
          }
          if (engine === 'chromium' && theme === 'dark') info.focusOrder[`${path} @${vpName}`] = order.map((o) => `${o.sel} "${o.label}"`);
        });
        await page.close();
      }
      await context.close();
    }
  }
}

async function siteMenu(browser, engine, path) {
  for (const vpName of ['375x667', '667x375', '320x568']) {
    if (!plan[engine].includes(vpName) && engine !== 'chromium') continue;
    const context = await newContext(browser, engine, vpName);
    const { page, ctx, errors } = await openPage(context, path, { theme: 'dark', engine, viewport: vpName });
    await scenario('site-menu', ctx, async () => {
      const summary = page.locator('.site-header details.menu > summary');
      if (!(await summary.isVisible())) return fail('site-menu', 'menu button not visible on a small screen', ctx);
      await summary.click();
      await page.waitForTimeout(60); // the toggle event is async
      let st = await page.evaluate(() => {
        const d = document.querySelector('.site-header details.menu');
        const p = d.querySelector('.menu-panel');
        const r = p.getBoundingClientRect();
        const cs = getComputedStyle(p);
        return {
          open: d.open,
          expanded: d.querySelector('summary').getAttribute('aria-expanded'),
          fits: r.bottom <= innerHeight + 1 || ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && r.bottom <= innerHeight + 1),
          bottom: r.bottom,
          right: r.right,
          left: r.left,
          scrollLocked: getComputedStyle(document.documentElement).overflow === 'hidden' || getComputedStyle(document.body).overflow === 'hidden',
        };
      });
      if (!st.open) return fail('site-menu', 'click does not open the menu', ctx);
      if (st.expanded !== 'true') fail('site-menu', `aria-expanded="${st.expanded}" while open`, ctx);
      if (!st.fits) fail('site-menu', `menu panel runs off the bottom of the viewport (${Math.round(st.bottom)}px) and does not scroll`, ctx);
      if (st.left < 0 || st.right > VIEWPORTS[vpName].width) fail('site-menu', 'menu panel runs off the side of the viewport', ctx);
      await shot(page, `${engine}-${vpName}-site-menu-open`);
      await page.keyboard.press('Escape');
      st = await page.evaluate(() => ({
        open: document.querySelector('.site-header details.menu').open,
        focus: document.activeElement?.localName,
      }));
      if (st.open) fail('site-menu', 'Escape does not close the menu', ctx);
      else if (st.focus !== 'summary') fail('site-menu', 'Escape does not return focus to the menu button', ctx);
      // Keyboard: open, Tab through, Tab past the end closes it.
      await page.keyboard.press('Enter');
      await page.waitForTimeout(60);
      const n = await page.locator('.site-header .menu-panel :is(a, select, button)').count();
      for (let i = 0; i < n + 1; i++) await page.keyboard.press(engine === 'webkit' ? 'Alt+Tab' : 'Tab');
      st = await page.evaluate(() => ({
        open: document.querySelector('.site-header details.menu').open,
        inside: !!document.activeElement?.closest('.site-header details.menu'),
      }));
      if (st.open && !st.inside) fail('site-menu', 'menu stays open after focus has left it', ctx);
      await page.evaluate(() => (document.querySelector('.site-header details.menu').open = true));
      await page.mouse.click(5, VIEWPORTS[vpName].height - 5);
      if (await page.evaluate(() => document.querySelector('.site-header details.menu').open)) fail('site-menu', 'click outside does not close the menu', ctx);
      // Same-page link (e.g. #anchor) closes it too; a real navigation reloads anyway.
      await page.evaluate(() => (document.querySelector('.site-header details.menu').open = true));
      await page.evaluate(() => {
        const a = document.querySelector('.site-header .menu-panel a');
        a.addEventListener('click', (e) => e.preventDefault(), { once: true });
        a.click();
      });
      if (await page.evaluate(() => document.querySelector('.site-header details.menu').open)) fail('site-menu', 'following a link does not close the menu', ctx);
    });
    flushErrors(errors, ctx);
    await context.close();
  }
}

async function starlightMenu(browser, engine, path) {
  for (const vpName of ['375x667', '667x375']) {
    if (!plan[engine].includes(vpName) && engine !== 'chromium') continue;
    const context = await newContext(browser, engine, vpName);
    const { page, ctx, errors } = await openPage(context, path, { theme: 'dark', engine, viewport: vpName });
    await scenario('docs-menu', ctx, async () => {
      const buttons = await page.evaluate(() =>
        [...document.querySelectorAll('.sl-menu-button, .site-header details.menu > summary, site-search button')]
          .filter((b) => b.getBoundingClientRect().width > 0 && getComputedStyle(b).visibility !== 'hidden')
          .map((b) => b.className || b.localName),
      );
      const menus = buttons.filter((b) => /sl-menu-button|summary/.test(b));
      if (menus.length !== 1) fail('docs-menu', `${menus.length} menu buttons visible on a docs page (want 1)`, ctx);
      if (!buttons.some((b) => /search|button/.test(b) && !/sl-menu|summary/.test(b))) warn('docs-menu', 'search button not visible in the small-screen header', ctx);
      await page.locator('.sl-menu-button').click();
      await page.waitForTimeout(60);
      const st = await page.evaluate(() => {
        const pane = document.getElementById('starlight__sidebar');
        const nav = pane?.querySelector('.site-nav');
        return {
          open: pane?.matches(':popover-open'),
          nav: !!nav && nav.getBoundingClientRect().height > 0,
          locked: getComputedStyle(document.body).overflow === 'hidden',
          inert: document.querySelector('.main-frame')?.inert,
          navLinks: nav ? [...nav.querySelectorAll('a')].map((a) => a.getBoundingClientRect().height) : [],
        };
      });
      if (!st.open) return fail('docs-menu', 'menu button does not open the sidebar', ctx);
      if (!st.nav) fail('docs-menu', 'site nav missing from the docs mobile menu', ctx);
      if (!st.locked) fail('docs-menu', 'page behind the open menu still scrolls', ctx);
      if (!st.inert) fail('docs-menu', 'focus is not trapped in the open menu', ctx);
      await page.evaluate(() => document.querySelector('#starlight__sidebar .site-nav')?.scrollIntoView());
      await shot(page, `${engine}-${vpName}-docs-menu-open`);
      await page.keyboard.press('Escape');
      if (await page.evaluate(() => document.getElementById('starlight__sidebar').matches(':popover-open'))) fail('docs-menu', 'Escape does not close the docs menu', ctx);
    });
    flushErrors(errors, ctx);
    await context.close();
  }
}

async function search(browser, engine, path) {
  for (const vpName of ['375x667', '1280x800']) {
    const context = await newContext(browser, engine, vpName);
    const { page, ctx, errors } = await openPage(context, path, { theme: 'dark', engine, viewport: vpName });
    await scenario('search', ctx, async () => {
      const button = page.locator('site-search button[data-open-modal]');
      if (!(await button.count())) return warn('search', 'no search on docs page', ctx);
      await button.click();
      await page.waitForSelector('site-search dialog[open]', { timeout: 3000 });
      await page.keyboard.type('live', { delay: 30 });
      await page.waitForSelector('.pagefind-ui__result', { timeout: 5000 }).catch(() => fail('search', 'no results for "live"', ctx));
      const r = await page.evaluate(() => {
        const d = document.querySelector('site-search dialog[open]').getBoundingClientRect();
        return { right: d.right, left: d.left, w: innerWidth, scroll: document.documentElement.scrollWidth };
      });
      if (r.left < -1 || r.right > r.w + 1) fail('search', 'search dialog wider than the viewport', ctx);
      await shot(page, `${engine}-${vpName}-search`);
      await page.keyboard.press('Escape');
      if (await page.locator('site-search dialog[open]').count()) fail('search', 'Escape does not close search', ctx);
    });
    flushErrors(errors, ctx);
    await context.close();
  }
}

async function galleryFilters(browser, engine) {
  for (const vpName of ['375x667', '1280x800']) {
    const context = await newContext(browser, engine, vpName);
    const { page, ctx, errors } = await openPage(context, '/gallery/', { theme: 'dark', engine, viewport: vpName });
    await scenario('gallery-filters', ctx, async () => {
      const filters = page.locator('gallery-filters');
      if (!(await filters.count()) || !(await filters.isVisible())) return warn('gallery-filters', 'no filters shown (fewer than two kinds and no tags?)', ctx);
      const st0 = await page.evaluate(() => ({
        status: document.querySelector('gallery-filters [role=status]')?.textContent,
        groupsLabelled: [...document.querySelectorAll('gallery-filters [role=group]')].every((g) => g.getAttribute('aria-labelledby') || g.getAttribute('aria-label')),
      }));
      if (!st0.groupsLabelled) fail('gallery-filters', 'filter group without a label', ctx);
      const btn = page.locator('gallery-filters button[aria-pressed="false"]').first();
      await btn.click();
      const st = await page.evaluate(() => {
        const pressed = document.querySelectorAll('gallery-filters button[aria-pressed="true"]').length;
        const shown = [...document.querySelectorAll('#gallery-items > li')].filter((li) => !li.hidden).length;
        const total = document.querySelectorAll('#gallery-items > li').length;
        return { status: document.querySelector('gallery-filters [role=status]')?.textContent ?? '', pressed, shown, total };
      });
      if (!/\d/.test(st.status)) fail('gallery-filters', 'result count is not announced after filtering', ctx);
      else if (!st.status.includes(String(st.shown))) fail('gallery-filters', `status "${st.status}" does not match ${st.shown} shown`, ctx);
      if (st.shown === 0) warn('gallery-filters', 'a filter leaves an empty grid with no message', ctx);
      await shot(page, `${engine}-${vpName}-gallery-filtered`);
    });
    flushErrors(errors, ctx);
    await context.close();
  }
}

async function liveEditor(browser, engine, pages) {
  const context = await newContext(browser, engine, '1280x800');
  for (const path of pages) {
    const { page, ctx } = await openPage(context, path, { theme: 'dark', engine, viewport: '1280x800', collect: false });
    if (!(await page.locator('.live-ex__editor').count())) {
      await page.close();
      continue;
    }
    await scenario('live-editor', ctx, async () => {
      const ta = page.locator('.live-ex__editor').first();
      await ta.scrollIntoViewIfNeeded();
      await ta.focus();
      const before = await ta.inputValue();
      await page.keyboard.press('Tab');
      const st = await page.evaluate(() => ({ tag: document.activeElement.localName }));
      const after = await ta.inputValue();
      if (st.tag !== 'textarea' || after === before) fail('live-editor', 'Tab in the editor does not indent', ctx);
      await page.keyboard.press('Escape');
      await page.keyboard.press(engine === 'webkit' ? 'Alt+Tab' : 'Tab');
      if (await page.evaluate(() => document.activeElement.localName === 'textarea')) fail('live-editor', 'Escape, Tab does not leave the editor', ctx);
      const hint = await page.evaluate(() => {
        const t = document.querySelector('.live-ex__editor');
        const id = t.getAttribute('aria-describedby');
        return id && document.getElementById(id)?.textContent;
      });
      if (!hint) fail('live-editor', 'editor has no keyboard hint (aria-describedby)', ctx);
    });
    await page.close();
  }
  await context.close();
}

async function copyButtons(browser, engine, pages) {
  const context = await newContext(browser, engine, '1280x800');
  if (engine === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  for (const path of pages) {
    const { page, ctx } = await openPage(context, path, { theme: 'dark', engine, viewport: '1280x800', collect: false });
    for (const sel of ['.install [data-copy]', '.expressive-code .copy button']) {
      const btn = page.locator(sel).first();
      if (!(await btn.count()) || !(await btn.isVisible().catch(() => false))) continue;
      await scenario('copy', ctx, async () => {
        const name = await btn.evaluate((b) => b.getAttribute('aria-label') || b.title || b.textContent.trim());
        if (!name) fail('copy', `${sel} has no accessible name`, ctx);
        const before = await page.evaluate(() => [...document.querySelectorAll('[aria-live], [role=status], [role=alert]')].map((e) => e.textContent).join('|'));
        await btn.click();
        await page.waitForTimeout(250);
        const after = await page.evaluate(() => [...document.querySelectorAll('[aria-live], [role=status], [role=alert]')].map((e) => e.textContent).join('|'));
        if (before === after) fail('copy', `${sel}: no aria-live announcement after copying`, ctx);
      });
    }
    await page.close();
  }
  await context.close();
}

async function motion(browser, engine, pages) {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
  for (const path of pages.slice(0, 8)) {
    const { page, ctx } = await openPage(context, path, { theme: 'dark', engine, viewport: '1280x800', collect: false });
    ctx.theme = 'reduced-motion';
    const st = await page.evaluate(() => ({
      smooth: getComputedStyle(document.documentElement).scrollBehavior === 'smooth',
      running: document
        .getAnimations()
        .filter((a) => a.playState === 'running' && !(a.effect?.target?.closest?.('.live-ex__preview, iframe')))
        .map((a) => a.animationName || a.transitionProperty || 'animation'),
    }));
    if (st.smooth) fail('reduced-motion', 'smooth scrolling despite prefers-reduced-motion', ctx);
    if (st.running.length) fail('reduced-motion', `animations running despite prefers-reduced-motion: ${st.running.join(', ')}`, ctx);
    // Transitions on hover: a sample of interactive elements.
    const long = await page.evaluate(() =>
      [...document.querySelectorAll('a, button, select, summary')]
        .filter((el) => getComputedStyle(el).transitionDuration.split(',').some((d) => parseFloat(d) > 0.2))
        .map((el) => el.className || el.localName)
        .slice(0, 3),
    );
    if (long.length) warn('reduced-motion', `transitions longer than 200ms under reduced motion: ${long.join(', ')}`, ctx);
    await page.close();
  }
  await context.close();
}

async function forcedColors(browser, pages) {
  const context = await browser.newContext({ forcedColors: 'active', viewport: { width: 1280, height: 800 } });
  for (const path of pages.filter((p) => !mirrorPages.has(p)).slice(0, 8)) {
    const { page, ctx } = await openPage(context, path, { theme: 'dark', engine: 'chromium', viewport: '1280x800', collect: false });
    ctx.theme = 'forced-colors';
    await scenario('forced-colors', ctx, async () => {
      const st = await page.evaluate(() => {
        const sig = (el) => {
          const cs = getComputedStyle(el);
          return [cs.backgroundColor, cs.color, cs.borderTopColor, cs.borderTopWidth, cs.outlineStyle, cs.fontWeight, cs.textDecorationLine, cs.borderBottomWidth].join(';');
        };
        const out = [];
        const pressed = document.querySelector('gallery-filters:not([hidden]) button[aria-pressed="true"]');
        const unpressed = document.querySelector('gallery-filters:not([hidden]) button[aria-pressed="false"]');
        if (pressed && unpressed && sig(pressed) === sig(unpressed)) out.push(['error', 'pressed and unpressed filter buttons look the same']);
        const cur = document.querySelector('.site-header .nav a[aria-current]');
        const other = document.querySelector('.site-header .nav a:not([aria-current])');
        if (cur && other && sig(cur) === sig(other)) out.push(['warn', 'current nav item looks like the others']);
        for (const b of document.querySelectorAll('.site-btn')) {
          if (getComputedStyle(b).borderTopStyle === 'none' || parseFloat(getComputedStyle(b).borderTopWidth) === 0) out.push(['error', 'button has no border in forced colours']);
        }
        const sel = document.querySelector('.sidebar-content a[aria-current="page"]');
        const unsel = document.querySelector('.sidebar-content a:not([aria-current])');
        if (sel && unsel && sig(sel) === sig(unsel)) out.push(['error', 'current sidebar page looks like the others']);
        return out;
      });
      for (const [sev, msg] of st) (sev === 'error' ? fail : warn)('forced-colors', msg, ctx);
      // Focus ring survives forced colours.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const cs = getComputedStyle(document.activeElement);
        return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      });
      if (!ring) fail('forced-colors', 'no focus outline in forced colours', ctx);
      await shot(page, `chromium-forced-colors-${slug(path)}`);
    });
    await page.close();
  }
  await context.close();
}

async function contrastMore(browser, pages) {
  const context = await browser.newContext({ contrast: 'more', viewport: { width: 1280, height: 800 } });
  for (const path of pages.filter((p) => !mirrorPages.has(p)).slice(0, 3)) {
    for (const theme of ['dark', 'light']) {
      const { page, ctx } = await openPage(context, path, { theme, engine: 'chromium', viewport: '1280x800', collect: false });
      ctx.theme = `${theme}/contrast-more`;
      const muted = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--site-muted').trim());
      info.notes.push(`prefers-contrast: more, ${theme}, ${path}: --site-muted = ${muted}`);
      record(await audit(page, { contrast: true }), ctx);
      await shot(page, `chromium-contrast-more-${theme}-${slug(path)}`);
      await page.close();
    }
  }
  await context.close();
}

async function print(browser, pages) {
  const docs = pages.filter((p) => p.startsWith('/docs/')).slice(0, 3);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  for (const path of docs) {
    const { page, ctx } = await openPage(context, path, { theme: 'dark', engine: 'chromium', viewport: '1280x800', collect: false });
    ctx.theme = 'print';
    await page.emulateMedia({ media: 'print' });
    const st = await page.evaluate(() => {
      const shown = (el) => el && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== 'hidden';
      const chrome = [...document.querySelectorAll('nav, .site-header .search, .site-header .actions, .sl-menu-button, site-search, starlight-theme-select, .site-header .menu')]
        .filter((el) => !el.closest('main .sl-markdown-content'))
        .filter(shown)
        .map((el) => el.getAttribute('aria-label') || el.className || el.localName);
      const bg = getComputedStyle(document.body).backgroundColor;
      const text = getComputedStyle(document.querySelector('.sl-markdown-content') || document.body).color;
      const fixed = [...document.querySelectorAll('header')].filter((h) => ['fixed', 'sticky'].includes(getComputedStyle(h).position) && shown(h)).length;
      return { chrome, bg, text, fixed };
    });
    for (const c of st.chrome) fail('print', `navigation chrome printed: ${c}`, ctx);
    if (st.fixed) warn('print', 'a fixed/sticky header is printed (repeats or covers content)', ctx);
    await shot(page, `chromium-print-${slug(path)}`, true);
    if (shots) await page.pdf({ path: join(shotsDir, `print-${slug(path)}.pdf`) }).catch(() => {});
    await page.close();
  }
  await context.close();
}

async function tokens(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  for (const theme of ['dark', 'light']) {
    for (const path of ['/', '/docs/']) {
      const { page } = await openPage(context, path, { theme, engine: 'chromium', viewport: '1280x800', collect: false });
      const pairs = [
        ['--site-text', '--site-bg', 4.5], ['--site-text', '--site-surface', 4.5], ['--site-muted', '--site-bg', 4.5],
        ['--site-muted', '--site-surface', 4.5], ['--site-muted', '--site-accent-soft', 4.5], ['--site-link', '--site-bg', 4.5],
        ['--site-link', '--site-surface', 4.5], ['--site-link', '--site-accent-soft', 4.5], ['--site-accent-strong', '--site-accent-soft', 4.5],
        ['--site-accent-strong', '--site-bg', 4.5], ['--site-accent-strong', '--site-surface', 4.5],
        ['--site-on-accent', '--site-accent', 4.5], ['--site-text', '--site-accent-soft', 4.5],
        ['--site-code-text', '--site-code-bg', 4.5], ['--site-accent', '--site-bg', 3], ['--site-accent', '--site-surface', 3],
        ['--site-focus', '--site-bg', 3], ['--site-focus', '--site-surface', 3], ['--site-focus', '--site-accent-soft', 3],
        ['--sl-color-text', '--sl-color-black', 4.5], ['--sl-color-text-accent', '--sl-color-black', 4.5],
        ['--sl-color-gray-2', '--sl-color-black', 4.5], ['--sl-color-gray-3', '--sl-color-black', 4.5],
        ['--sl-color-gray-3', '--sl-color-gray-6', 4.5], ['--sl-color-white', '--sl-color-accent-low', 4.5],
        ['--sl-color-text-invert', '--sl-color-accent', 4.5], ['--sl-color-white', '--sl-color-gray-6', 4.5],
        ['--sl-color-gray-2', '--sl-color-gray-6', 4.5], ['--sl-color-text-accent', '--sl-color-gray-6', 4.5],
        ['--sl-color-gray-5', '--sl-color-black', 1], ['--site-border', '--site-bg', 1],
      ];
      const res = await page.evaluate((pairs) => {
        const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        const probe = document.createElement('div');
        document.body.append(probe);
        const resolve = (v) => {
          probe.style.color = `var(${v})`;
          const css = getComputedStyle(probe).color;
          c.clearRect(0, 0, 1, 1);
          c.fillStyle = css;
          c.fillRect(0, 0, 1, 1);
          const d = c.getImageData(0, 0, 1, 1).data;
          return [d[0], d[1], d[2]];
        };
        const lum = ([r, g, b]) => [r, g, b].map((x) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
        const hex = (a) => '#' + a.map((x) => x.toString(16).padStart(2, '0')).join('');
        const out = pairs.map(([fg, bg, need]) => {
          const f = resolve(fg), b = resolve(bg);
          const [l1, l2] = [lum(f), lum(b)].sort((x, y) => y - x);
          return { fg, bg, need, fgHex: hex(f), bgHex: hex(b), ratio: +((l1 + 0.05) / (l2 + 0.05)).toFixed(2) };
        });
        probe.remove();
        return out;
      }, pairs);
      info.tokens[`${theme} ${path}`] = res;
      for (const r of res) {
        if (r.need > 1 && r.ratio < r.need)
          fail('token-contrast', `${r.fg} on ${r.bg}: ${r.ratio} < ${r.need} (${r.fgHex} on ${r.bgHex})`, { page: path, engine: 'chromium', viewport: '-', theme });
      }
      await page.close();
    }
  }
  await context.close();
}

async function perf(browser, pages) {
  for (const vpName of ['375x667', '1280x800']) {
    const context = await newContext(browser, 'chromium', vpName);
    for (const path of pages.filter((p) => !mirrorPages.has(p))) {
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(new URL(path, origin).href, { waitUntil: 'load' });
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(800);
      const st = await page.evaluate(() => {
        const res = performance.getEntriesByType('resource');
        const sum = (f) => res.filter(f).reduce((s, r) => s + (r.decodedBodySize || r.encodedBodySize || 0), 0);
        const inlineJs = [...document.querySelectorAll('script:not([src])')].filter((s) => !s.type || s.type === 'module' || s.type === 'text/javascript').reduce((s, x) => s + x.textContent.length, 0);
        const inlineCss = [...document.querySelectorAll('style')].reduce((s, x) => s + x.textContent.length, 0);
        return {
          cls: +window.__cls.toFixed(4),
          js: sum((r) => /\.m?js(\?|$)/.test(r.name) && !r.name.includes('pagefind')) + inlineJs,
          css: sum((r) => /\.css(\?|$)/.test(r.name)) + inlineCss,
          img: sum((r) => r.initiatorType === 'img'),
        };
      });
      info.perf[`${path} @${vpName}`] = st;
      const ctx = { page: path, engine: 'chromium', viewport: vpName, theme: 'dark' };
      if (st.cls > 0.1) fail('cls', `cumulative layout shift ${st.cls}`, ctx);
      else if (st.cls > 0.02) warn('cls', `cumulative layout shift ${st.cls}`, ctx);
      await page.close();
    }
    await context.close();
  }
}

async function viewportMeta(pages) {
  for (const path of pages.filter((p) => !mirrorPages.has(p))) {
    const html = await (await fetch(new URL(path, origin))).text();
    const meta = /<meta name="viewport" content="([^"]+)"/.exec(html)?.[1] ?? '';
    const ctx = { page: path, engine: '-', viewport: '-', theme: '-' };
    if (!meta) fail('viewport-meta', 'no viewport meta', ctx);
    if (/user-scalable=no|maximum-scale=1(?!\d)/.test(meta)) fail('viewport-meta', `zoom disabled: ${meta}`, ctx);
    if (/viewport-fit=cover/.test(meta)) {
      const css = [];
      for (const [, href] of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) css.push(await (await fetch(new URL(href, origin))).text());
      for (const [, s] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) css.push(s);
      if (!css.some((c) => c.includes('safe-area-inset'))) fail('safe-area', 'viewport-fit=cover without env(safe-area-inset-*) padding', ctx);
    }
  }
}

// ── Run ────────────────────────────────────────────────────────────────────────────────────────
const started = Date.now();
const pages = await discover();
console.log(`ux-check ${origin}: ${pages.length} pages, engines ${engines.join(', ')}`);
await checkLinks(pages);
await viewportMeta(pages);
const docsPages = pages.filter((p) => p.startsWith('/docs/'));
const sitePages = pages.filter((p) => !mirrorPages.has(p) && !p.startsWith('/docs/') && !p.startsWith('/__ux'));

for (const engine of engines) {
  let browser;
  try {
    browser = await pw[engine].launch();
  } catch (e) {
    fail('engine', `${engine} could not be launched: ${String(e.message).split('\n')[0]}`, { page: '-', engine, viewport: '-', theme: '-' });
    console.warn(`${engine}: could not be launched (npx playwright install ${engine})`);
    continue;
  }
  const t = Date.now();
  console.log(`· ${engine}: matrix`);
  await runMatrix(browser, engine, pages);
  console.log(`· ${engine}: scenarios`);
  if (sitePages.includes('/')) await siteMenu(browser, engine, '/');
  if (docsPages.length) {
    await starlightMenu(browser, engine, docsPages[0]);
    await search(browser, engine, docsPages[0]);
  }
  if (pages.includes('/gallery/')) await galleryFilters(browser, engine);
  await liveEditor(browser, engine, pages.filter((p) => !mirrorPages.has(p)));
  if (engine === 'chromium' || !quick) {
    await keyboard(browser, engine, engine === 'chromium' ? pages : pages.filter((p) => p === '/' || p === docsPages[0] || p === '/gallery/'));
    await themeFlash(browser, engine, pages);
    await motion(browser, engine, pages);
  }
  if (engine === 'chromium') {
    await copyButtons(browser, engine, pages.filter((p) => !mirrorPages.has(p)));
    await forcedColors(browser, pages);
    await contrastMore(browser, pages);
    await print(browser, pages);
    await tokens(browser);
    await perf(browser, pages);
  }
  await browser.close();
  console.log(`  ${engine} done in ${Math.round((Date.now() - t) / 1000)}s`);
}

// ── Report ─────────────────────────────────────────────────────────────────────────────────────
// One issue = same page, check, message (numbers normalised) and element; the contexts it showed up in are listed.
const issues = new Map();
for (const f of findings) {
  const key = [f.severity, f.page, f.check, f.message.replace(/-?\d+(\.\d+)?/g, '#'), f.selector].join('|');
  if (!issues.has(key)) issues.set(key, { ...f, contexts: [] });
  issues.get(key).contexts.push(`${f.engine}/${f.viewport}/${f.theme}`);
}
const list = [...issues.values()].sort((a, b) => (a.severity === b.severity ? a.check.localeCompare(b.check) : a.severity === 'error' ? -1 : 1));
const errors = list.filter((i) => i.severity === 'error');
const warnings = list.filter((i) => i.severity === 'warn');
const byCheck = (l) => Object.entries(l.reduce((m, i) => ((m[i.check] = (m[i.check] || 0) + 1), m), {})).sort();
const summary = {
  url: origin,
  date: new Date().toISOString(),
  seconds: Math.round((Date.now() - started) / 1000),
  engines,
  pages,
  mirrorPages: [...mirrorPages],
  errors: errors.length,
  warnings: warnings.length,
  errorsByCheck: Object.fromEntries(byCheck(errors)),
  warningsByCheck: Object.fromEntries(byCheck(warnings)),
};
writeFileSync(join(outDir, 'report.json'), JSON.stringify({ summary, issues: list, info }, null, 2));

const md = [];
md.push(`# UX check: ${origin}`, '', `${summary.date} · ${summary.seconds}s · engines: ${engines.join(', ')} · ${pages.length} pages`, '');
md.push(`**${errors.length} errors, ${warnings.length} warnings** (unique issues; each lists where it showed up).`, '');
md.push('| check | errors | warnings |', '|---|---|---|');
for (const c of [...new Set(list.map((i) => i.check))].sort()) md.push(`| ${c} | ${summary.errorsByCheck[c] ?? 0} | ${summary.warningsByCheck[c] ?? 0} |`);
md.push('');
for (const [title, l] of [['Errors', errors], ['Warnings', warnings]]) {
  md.push(`## ${title}`, '');
  for (const i of l) {
    const ctxs = [...new Set(i.contexts)];
    md.push(`- **${i.check}** \`${i.page}\` ${i.message}${i.selector ? ` — \`${i.selector}\`` : ''}${i.scope === 'mirror' ? ' _(mirrored app)_' : ''}`);
    if (i.detail) md.push(`  - ${JSON.stringify(i.detail)}`);
    md.push(`  - ${ctxs.length} context(s): ${ctxs.slice(0, 6).join(', ')}${ctxs.length > 6 ? ', …' : ''}`);
  }
  md.push('');
}
md.push('## Colour tokens', '');
for (const [k, rows] of Object.entries(info.tokens)) {
  md.push(`### ${k}`, '', '| fg | bg | ratio | need |', '|---|---|---|---|');
  for (const r of rows) md.push(`| ${r.fg} ${r.fgHex} | ${r.bg} ${r.bgHex} | ${r.ratio} | ${r.need > 1 ? r.need : 'info'} |`);
  md.push('');
}
md.push('## Performance (Chromium)', '', '| page | CLS | JS bytes | CSS bytes | image bytes |', '|---|---|---|---|---|');
for (const [k, v] of Object.entries(info.perf)) md.push(`| ${k} | ${v.cls} | ${v.js} | ${v.css} | ${v.img} |`);
md.push('', '## Notes', '', ...info.notes.map((n) => `- ${n}`), `- links checked: ${info.linksChecked}`, '');
writeFileSync(join(outDir, 'report.md'), md.join('\n'));

console.log(`\n${errors.length} errors, ${warnings.length} warnings in ${summary.seconds}s`);
for (const [c, n] of byCheck(errors)) console.log(`  error ${c}: ${n}`);
for (const [c, n] of byCheck(warnings)) console.log(`  warn  ${c}: ${n}`);
console.log(`report: ${join(outDir, 'report.md')}`);
process.exit(errors.length ? 1 : 0);
