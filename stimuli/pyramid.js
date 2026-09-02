import { TAU, drawCloud, drawEdges } from '../lib/render.js';
import { pose, wire, triPatch, panelPatch, fillCloud, memo } from '../lib/cloud.js';
import { adapt, palName, PALETTES } from '../lib/palette.js';

// A square pyramid lying on its side — its own axis horizontal — turning about
// the vertical. So the apex sweeps out to the left, comes round to point
// straight at you (at which moment the whole thing is a square with an X
// through it), and goes out to the right. Thin edges coloured by the corners
// they join, sparse green dots on the faces, nothing filled.
//
// The square-with-an-X pose is the one worth waiting for: it is the classic
// Necker figure, and it is where the two readings are furthest apart and the
// picture is most obviously silent about which is right.

const BASE_X = -0.70, APEX_X = 0.80, S = 0.60;

// apex, then the four base corners
const VC = ['#63f09a', '#3f9ef0', '#f0a13a', '#8ce84a', '#46e0d0'];
const DOTS = ['#4fe07a', '#a8f0b4'];

function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return '#' + [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join('');
}

const STEPS = 5;

function build(N) {
  const apex = [APEX_X, 0, 0];
  const b = [
    [BASE_X, -S, -S], [BASE_X, S, -S], [BASE_X, S, S], [BASE_X, -S, S]
  ];
  const V = [apex].concat(b);
  const E = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1]];

  const edgeColors = [];
  const w = wire(E.length * (STEPS + 1), E.length * STEPS);
  let pi = 0, si = 0;
  for (const e of E) {
    const A = V[e[0]], B = V[e[1]], ca = VC[e[0]], cb = VC[e[1]];
    const first = pi;
    for (let k = 0; k <= STEPS; k++) {
      const t = k / STEPS;
      w.xyz[pi * 3] = A[0] + (B[0] - A[0]) * t;
      w.xyz[pi * 3 + 1] = A[1] + (B[1] - A[1]) * t;
      w.xyz[pi * 3 + 2] = A[2] + (B[2] - A[2]) * t;
      pi++;
    }
    for (let k = 0; k < STEPS; k++) {
      w.seg[si * 2] = first + k; w.seg[si * 2 + 1] = first + k + 1;
      w.col[si] = edgeColors.length;
      edgeColors.push(mix(ca, cb, (k + 0.5) / STEPS));
      si++;
    }
  }

  const faces = [];
  for (let i = 0; i < 4; i++) faces.push(triPatch(apex, b[i], b[(i + 1) % 4]));
  faces.push(panelPatch(b[0], [0, 2 * S, 0], [0, 0, 2 * S]));
  const cl = fillCloud([{ patches: faces, col: 0 }], N, 0x9d1e33);
  // a scatter of the paler green so the faces are not one dead tone
  for (let i = 0; i < cl.n; i += 5) cl.col[i] = 1;
  return { w: w, cl: cl, edgeColors: edgeColors };
}

const cache = memo(4);
function geom(N) { return cache(String(N), () => build(N)); }

export default {
  id: 'pyramid',
  name: 'pyramid',
  palette: 'dark',
  mirrors: true,
  blurb: 'A square pyramid on its side, turning about the vertical: the apex swings out left, comes ' +
         'round to point straight at you — a square with an X through it — and goes out right. Thin ' +
         'coloured edges and a sparse scatter of dots on the faces, nothing filled and nothing hidden.',
  tryThis: 'Wait for the square with the X and stop it there in your head. Is the apex coming at you ' +
           'or going away? Pick one, then pick the other; the whole rotation follows.',
  controls: [
    { key: 'period', label: 'period', min: 3, max: 14, step: 0.5, def: 6, unit: 's' },
    { key: 'tilt', label: 'tilt', min: 0, max: 40, step: 1, def: 12, unit: '°' },
    { key: 'dots', label: 'dots', min: 200, max: 4000, step: 50, def: 1100 },
    { key: 'dot', label: 'dot', min: 1, max: 3.5, step: 0.25, def: 1.5 }
  ],
  draw(ctx, phase, p, cue, opts) {
    const detail = (opts && opts.detail) || 1;
    const g = geom(Math.max(200, Math.round(p.dots * (detail < 1 ? 0.6 : 1))));
    const mirror = !!(opts && opts.mirror);
    const m = pose(p.tilt, phase * TAU, mirror);
    const name = palName(this, opts);
    const blend = PALETTES[name].blend;
    drawEdges(ctx, g.w, m, cue, {
      fill: 0.46, width: 1.0, alpha: 0.95, mirror: mirror,
      colors: adapt(g.edgeColors, name), blend: blend
    });
    drawCloud(ctx, g.cl, m, cue, {
      fill: 0.46, size: p.dot, alpha: 0.85, mirror: mirror,
      colors: adapt(DOTS, name), blend: blend
    });
  }
};
