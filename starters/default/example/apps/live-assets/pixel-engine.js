// A tiny "engine" for the live-examples showcase: draws a JSON pixel-art spec on a canvas and animates it.
// Served at /apps/live-assets/ by the static-apps mirror; used by the live-examples showcase page.
// It is a <Live runner="…"> module: export function run(source, mount, ctx).
//
// Spec: { "palette": { "k": "#222" }, "frames": [["k.k", ".k.", "k.k"]], "fps": 4 }
// "." is transparent; every other character must be in the palette.

class SpecError extends Error {
  constructor(problems) {
    super(problems.join('\n'));
    this.name = 'SpecError';
  }
}

function validate(spec) {
  const problems = [];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new SpecError(['$: expected an object']);
  const palette = spec.palette ?? {};
  if (typeof palette !== 'object') problems.push('palette: expected an object of "char": "colour"');
  if (!Array.isArray(spec.frames) || !spec.frames.length) throw new SpecError([...problems, 'frames: expected a non-empty array']);
  const h = spec.frames[0].length, w = spec.frames[0][0]?.length ?? 0;
  spec.frames.forEach((frame, f) => {
    if (!Array.isArray(frame)) return problems.push(`frames[${f}]: expected an array of strings`);
    if (frame.length !== h) problems.push(`frames[${f}]: ${frame.length} rows, expected ${h}`);
    frame.forEach((row, y) => {
      if (typeof row !== 'string') return problems.push(`frames[${f}][${y}]: expected a string`);
      if (row.length !== w) problems.push(`frames[${f}][${y}]: ${row.length} wide, expected ${w}`);
      [...row].forEach((c, x) => {
        if (c !== '.' && !(c in palette)) problems.push(`frames[${f}][${y}][${x}]: "${c}" is not in the palette`);
      });
    });
  });
  if (spec.fps !== undefined && !(spec.fps > 0 && spec.fps <= 60)) problems.push('fps: expected a number from 1 to 60');
  if (problems.length) throw new SpecError(problems.slice(0, 6).concat(problems.length > 6 ? [`…and ${problems.length - 6} more`] : []));
  return { palette, frames: spec.frames, w, h, fps: spec.fps ?? 4 };
}

export function run(source, mount, ctx) {
  let spec;
  try {
    spec = JSON.parse(source);
  } catch (e) {
    throw new SyntaxError(`JSON: ${e.message}`);
  }
  const { palette, frames, w, h, fps } = validate(spec);
  const scale = Number(ctx.options.scale ?? spec.scale ?? 8);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', spec.alt ?? `Pixel art, ${frames.length} frame${frames.length > 1 ? 's' : ''}`);
  const checker = ctx.theme === 'dark' ? '#ffffff10' : '#00000010';
  canvas.style.cssText = `width:${w * scale}px;height:${h * scale}px;image-rendering:pixelated;display:block;margin:auto;` +
    `background:repeating-conic-gradient(${checker} 0 25%,transparent 0 50%) 0 0/${scale * 2}px ${scale * 2}px`;
  mount.append(canvas);
  const g = canvas.getContext('2d');

  const draw = (f) => {
    g.clearRect(0, 0, w, h);
    frames[f].forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '.') return;
      g.fillStyle = palette[c];
      g.fillRect(x, y, 1, 1);
    }));
  };
  draw(0);

  const what = `ok: ${w}×${h}, ${frames.length} frame${frames.length > 1 ? 's' : ''} at ${fps} fps`;
  if (frames.length < 2) return ctx.status(what, 'ok');
  if (ctx.reducedMotion) return ctx.status(`${what} (paused: reduced motion)`, 'ok');
  ctx.status(what, 'ok');

  let raf = 0, start;
  const tick = (t) => {
    start ??= t;
    draw(Math.floor(((t - start) / 1000) * fps) % frames.length);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
