import { TAU, drawCloud } from '../lib/render.js';
import { pose, tubePatches, fillCloud } from '../lib/cloud.js';
import { adapt, palName, PALETTES } from '../lib/palette.js';

// A banana, long axis vertical, turning about it: crescent, then a fat
// straight bar seen edge-on, then the crescent the other way. Gold dots on
// the surface, five ridge lines running the length of it, and a stem.
//
// The bright outline is not an outline. It is where the tube's surface turns
// away from you and a whole band of it projects into a couple of pixels, so
// the dots stack. That is a property of the picture, not of the direction of
// travel: the depth-mirrored banana piles them up in exactly the same places.

const SWEEP = 115 * Math.PI / 180;
const LEN = 1.74;
const RC = LEN / (2 * Math.sin(SWEEP / 2));
const XOFF = RC * (1 + Math.cos(SWEEP / 2)) / 2;

function centre(u, out) {
  const a = (u - 0.5) * SWEEP;
  out[0] = RC * Math.cos(a) - XOFF;
  out[1] = RC * Math.sin(a);
  out[2] = 0;
}

function radius(fat) {
  return (u) => {
    const x = Math.abs(2 * u - 1);
    const taper = 1 - 0.18 * (2 * u - 1);          // a little thinner at the stem end
    return fat * Math.pow(Math.max(0, 1 - Math.pow(x, 2.6)), 0.5) * taper;
  };
}

// the stem: a short blunt cone off the top end, kicked slightly outward
function stemPath(u, out) {
  const base = [0, 0, 0];
  centre(1, base);
  out[0] = base[0] + 0.045 * u;
  out[1] = base[1] + 0.115 * u;
  out[2] = 0;
}

function build(N, fat, ridges) {
  const rf = radius(fat);
  const body = tubePatches(centre, rf, 90, 28, true);
  const stem = tubePatches(stemPath, (u) => 0.05 - 0.032 * u, 10, 14, true);

  const parts = [
    { patches: body, col: 0 },
    { patches: stem, col: 0 }
  ];
  // longitudinal ridge lines. A banana has flats and edges; these are the
  // edges, and they are the only thing on the surface that tells you how far
  // round the tube has turned.
  const n = Math.round(ridges);
  for (let i = 0; i < n; i++) {
    const v = i / n;
    parts.push({
      col: 1,
      weight: 0.36 / n,
      jitter: fat * 0.045,
      curve: (u, out) => {
        // a point on the tube's surface at a fixed angle round the section
        const p0 = [0, 0, 0], p1 = [0, 0, 0];
        centre(Math.max(0, u - 0.002), p0);
        centre(Math.min(1, u + 0.002), p1);
        let tx = p1[0] - p0[0], ty = p1[1] - p0[1];
        const L = Math.hypot(tx, ty) || 1;
        tx /= L; ty /= L;
        const nx = -ty, ny = tx;                    // in-plane normal
        const a = v * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const c = [0, 0, 0];
        centre(u, c);
        const r = rf(u) * 0.99;
        out[0] = c[0] + r * ca * nx;
        out[1] = c[1] + r * ca * ny;
        out[2] = c[2] + r * sa;
      }
    });
  }
  return fillCloud(parts, N, 0xba4a4a);
}

let cache = null;
function geom(N, fat, ridges) {
  const key = N + '/' + fat + '/' + ridges;
  if (!cache || cache.key !== key) cache = { key: key, cl: build(N, fat, ridges) };
  return cache.cl;
}

const COLORS = ['#cfae52', '#fdf0b8'];

export default {
  id: 'banana',
  name: 'banana',
  palette: 'dark',
  blurb: 'A banana standing on end and turning about its own long axis: crescent, then a straight bar ' +
         'when the curve goes edge-on, then a crescent the other way. Gold dots on the surface, and ' +
         'five ridge lines running the length of it.',
  tryThis: 'Catch it at the moment it goes straight. Whichever way you decide it is about to open, it ' +
           'opens — and the moment it does, the whole rotation runs that way.',
  controls: [
    { key: 'period', label: 'period', min: 3, max: 16, step: 0.5, def: 7, unit: 's' },
    { key: 'tilt', label: 'tilt', min: 0, max: 40, step: 1, def: 10, unit: '°' },
    { key: 'fat', label: 'fat', min: 0.10, max: 0.26, step: 0.01, def: 0.145 },
    { key: 'ridges', label: 'ridges', min: 0, max: 8, step: 1, def: 5 },
    { key: 'dots', label: 'dots', min: 2000, max: 20000, step: 500, def: 4000 }
  ],
  draw(ctx, phase, p, cue, opts) {
    const detail = (opts && opts.detail) || 1;
    const N = Math.max(1500, Math.round(p.dots * (detail < 1 ? 0.4 : 1)));
    const cl = geom(N, p.fat, p.ridges);
    const mirror = !!(opts && opts.mirror);
    const m = pose(p.tilt, phase * TAU, mirror);
    const name = palName(this, opts);
    drawCloud(ctx, cl, m, cue, {
      fill: 0.46, size: 1.05, alpha: 0.8, mirror: mirror,
      colors: adapt(COLORS, name), blend: PALETTES[name].blend
    });
  }
};
