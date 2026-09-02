import { TAU, drawCloud } from '../lib/render.js';
import { pose, surfaceArea, fillCloud, memo } from '../lib/cloud.js';
import { palName, PALETTES } from '../lib/palette.js';

// Our own: a smooth arrow — round shaft with a domed back end, cone head — as
// a cloud of pale dots. Round, so the outline changes continuously as it turns
// instead of snapping between flat faces, and pitched up a little in the plane
// of the screen so it never collapses to a bare disc when the head comes
// straight at you.
//
// This is the airtight one. An arrow of revolution is mirror-symmetric about
// its own z = 0 plane, so depth-mirroring it gives back the SAME arrow, not a
// different object. Orthographic projection discards z. "This arrow turning
// left" and "this arrow turning right" are therefore not two rival models of
// one picture: they are one picture, and there is nothing to be right about.

function build(N, head, len, pitchDeg) {
  const x0 = -0.95, x1 = 0.95;
  const rs = 0.15;                       // shaft radius
  const xs = x1 - len;                   // where the head begins
  const ring = (x, r, th, out) => { out[0] = x; out[1] = r * Math.cos(th); out[2] = r * Math.sin(th); };

  const shaft = surfaceArea((u, v, out) => ring(x0 + (xs - x0) * u, rs, v * TAU, out), 40, 64);
  // a hemispherical cap on the back end
  const cap = surfaceArea((u, v, out) => {
    const a = u * Math.PI / 2;
    out[0] = x0 - rs * Math.sin(a);
    out[1] = rs * Math.cos(a) * Math.cos(v * TAU);
    out[2] = rs * Math.cos(a) * Math.sin(v * TAU);
  }, 16, 64);
  const cone = surfaceArea((u, v, out) => ring(xs + (x1 - xs) * u, head * (1 - u), v * TAU, out), 40, 64);
  const skirt = surfaceArea((u, v, out) => ring(xs, rs + (head - rs) * u, v * TAU, out), 10, 64);

  const cl = fillCloud([{ patches: [shaft, cap, cone, skirt], col: 0 }], N, 0x4a4077);
  const a = pitchDeg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
  for (let i = 0; i < cl.n; i++) {
    const j = i * 3, x = cl.xyz[j], y = cl.xyz[j + 1];
    cl.xyz[j] = x * c - y * sn;
    cl.xyz[j + 1] = x * sn + y * c;
  }
  return cl;
}

const cache = memo(4);
function geom(N, head, len, pitch) {
  return cache([N, head, len, pitch].join('/'), () => build(N, head, len, pitch));
}

export default {
  id: 'arrow',
  name: 'arrow',
  palette: 'dark',
  mirrors: true,
  blurb: 'A smooth arrow — round shaft, domed back, cone head — drawn as a few thousand pale dots on ' +
         'its surface, turning about a vertical axis that leans towards you. An arrow of revolution is ' +
         'its own mirror image in depth, so the two readings are not rival guesses about one picture: ' +
         'they are the same picture.',
  tryThis: 'Watch the head. When it swings across the middle, decide it is passing in front of the ' +
           'shaft — then decide it is passing behind. That is the whole illusion, and both are true.',
  controls: [
    { key: 'period', label: 'period', min: 2, max: 14, step: 0.5, def: 5, unit: 's' },
    { key: 'tilt', label: 'tilt', min: 0, max: 40, step: 1, def: 20, unit: '°' },
    { key: 'head', label: 'head', min: 0.20, max: 0.48, step: 0.01, def: 0.34 },
    { key: 'len', label: 'point', min: 0.3, max: 1.0, step: 0.05, def: 0.60 },
    { key: 'pitch', label: 'pitch', min: 0, max: 30, step: 1, def: 15, unit: '°' },
    { key: 'dots', label: 'dots', min: 2000, max: 20000, step: 500, def: 7000 }
  ],
  draw(ctx, phase, p, cue, opts) {
    const detail = (opts && opts.detail) || 1;
    const N = Math.max(1500, Math.round(p.dots * (detail < 1 ? 0.4 : 1)));
    const cl = geom(N, p.head, p.len, p.pitch);
    const mirror = !!(opts && opts.mirror);
    const m = pose(p.tilt, phase * TAU, mirror);
    const name = palName(this, opts);
    const P = PALETTES[name];
    drawCloud(ctx, cl, m, cue, {
      fill: 0.48, size: 1.3, alpha: 0.6, mirror: mirror,
      colors: [P.ink], blend: P.blend
    });
  }
};
