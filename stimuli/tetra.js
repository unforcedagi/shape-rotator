import { TAU, drawCloud, drawEdges } from '../lib/render.js';
import { pose, cloud, wire } from '../lib/cloud.js';
import { adapt, palName, PALETTES } from '../lib/palette.js';

// A regular tetrahedron standing on its base, turning about the axis through
// its apex, so the apex sits perfectly still and everything else wheels round
// it. Nothing is filled: six thin edges that take their colour from the two
// corners they join, and a regular lattice of pale dots on each face.
//
// The colours belong to the OBJECT — corner three is pink whichever way you
// think the thing is turning — so they say nothing about depth. The mirrored
// tetrahedron carries the same colours to the same places on the screen.

const VC = ['#4fd8e8', '#f5d341', '#f2557a', '#5fe3a8'];   // apex, then the base
// pale: neutral first, then one washed-out tint per corner
const FACE = ['#e4ece8', '#bfe9f0', '#efe4bc', '#f0cdd8', '#c9f0d8'];

function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) {
  const A = hex(a), Bc = hex(b);
  return '#' + [0, 1, 2].map(i => Math.round(A[i] + (Bc[i] - A[i]) * t).toString(16).padStart(2, '0')).join('');
}

const EDGE_STEPS = 10;

function verts() {
  const Rb = 0.80;
  const edge = Rb * Math.sqrt(3);
  const h = edge * Math.sqrt(2 / 3);
  const yb = -h / 4, ya = yb + h;
  const V = [[0, ya, 0]];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 2;
    V.push([Rb * Math.cos(a), yb, Rb * Math.sin(a)]);
  }
  return V;
}

function build(rows) {
  const V = verts();
  const E = [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [3, 1]];
  const FACES = [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]];

  // --- edges, subdivided only so the colour can run along them
  const edgeColors = [];
  const w = wire(E.length * (EDGE_STEPS + 1), E.length * EDGE_STEPS);
  let pi = 0, si = 0;
  for (let e = 0; e < E.length; e++) {
    const a = V[E[e][0]], b = V[E[e][1]];
    const ca = VC[E[e][0]], cb = VC[E[e][1]];
    const first = pi;
    for (let k = 0; k <= EDGE_STEPS; k++) {
      const t = k / EDGE_STEPS;
      w.xyz[pi * 3] = a[0] + (b[0] - a[0]) * t;
      w.xyz[pi * 3 + 1] = a[1] + (b[1] - a[1]) * t;
      w.xyz[pi * 3 + 2] = a[2] + (b[2] - a[2]) * t;
      pi++;
    }
    for (let k = 0; k < EDGE_STEPS; k++) {
      w.seg[si * 2] = first + k; w.seg[si * 2 + 1] = first + k + 1;
      w.col[si] = edgeColors.length;
      edgeColors.push(mix(ca, cb, (k + 0.5) / EDGE_STEPS));
      si++;
    }
  }

  // --- face lattice: rows parallel to each edge, interior points only, so the
  //     lattice never doubles up on the wires
  const pts = [];
  const cols = [];
  for (const f of FACES) {
    const A = V[f[0]], Bv = V[f[1]], C = V[f[2]];
    for (let i = 1; i < rows; i++) {
      for (let j = 1; i + j < rows; j++) {
        const k = rows - i - j;
        const bx = i / rows, by = j / rows, bz = k / rows;
        pts.push([A[0] * bx + Bv[0] * by + C[0] * bz,
                  A[1] * bx + Bv[1] * by + C[1] * bz,
                  A[2] * bx + Bv[2] * by + C[2] * bz]);
        // pale, tinted by whichever corner of the face is nearest; neutral
        // when no corner is clearly the nearest
        const mx = Math.max(bx, by, bz);
        const near = mx === bx ? 0 : mx === by ? 1 : 2;
        cols.push(mx < 0.5 ? 0 : f[near] + 1);
      }
    }
  }
  const cl = cloud(pts.length);
  for (let i = 0; i < pts.length; i++) {
    cl.xyz[i * 3] = pts[i][0]; cl.xyz[i * 3 + 1] = pts[i][1]; cl.xyz[i * 3 + 2] = pts[i][2];
    cl.col[i] = cols[i];
  }
  return { w: w, cl: cl, edgeColors: edgeColors };
}

let cache = null;
function geom(rows) {
  if (!cache || cache.rows !== rows) cache = { rows: rows, g: build(rows) };
  return cache.g;
}

export default {
  id: 'tetra',
  name: 'tetra',
  palette: 'dark',
  blurb: 'A regular tetrahedron turning about the axis through its apex: thin edges coloured by the ' +
         'corners they join, and a regular lattice of pale dots on each face. Nothing is filled and ' +
         'nothing is hidden, so the far face and the near face are drawn exactly alike.',
  tryThis: 'Pick the edge that runs across the middle and decide it is the front one. The whole solid ' +
           'turns inside out around that decision, and the lattice on the faces goes with it.',
  controls: [
    { key: 'period', label: 'period', min: 3, max: 18, step: 0.5, def: 9, unit: 's' },
    { key: 'tilt', label: 'tilt', min: 0, max: 40, step: 1, def: 14, unit: '°' },
    { key: 'rows', label: 'rows', min: 8, max: 24, step: 1, def: 18 },
    { key: 'dot', label: 'dot', min: 1, max: 3.5, step: 0.25, def: 2 }
  ],
  draw(ctx, phase, p, cue, opts) {
    const detail = (opts && opts.detail) || 1;
    const g = geom(Math.round(p.rows * (detail < 1 ? 0.7 : 1)));
    const mirror = !!(opts && opts.mirror);
    const m = pose(p.tilt, phase * TAU, mirror);
    const name = palName(this, opts);
    const blend = PALETTES[name].blend;
    drawEdges(ctx, g.w, m, cue, {
      fill: 0.52, width: 1.0, alpha: 0.95, mirror: mirror,
      colors: adapt(g.edgeColors, name), blend: blend
    });
    drawCloud(ctx, g.cl, m, cue, {
      fill: 0.52, size: p.dot, alpha: 0.9, mirror: mirror,
      colors: adapt(FACE, name), blend: blend
    });
  }
};
