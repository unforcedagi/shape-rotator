import { TAU, spinM, drawMesh } from '../lib/render.js';
import { pal } from '../lib/palette.js';

// A lathe-turned vase with one asymmetric spout. The spinning-dancer principle:
// a filled silhouette carries no interior detail at all, so the only thing the
// image gives you is an outline that grows and shrinks.
//
// One useful consequence of orthographic projection: the silhouette of a solid
// of revolution about the vertical axis does not change as it turns. It is just
// the profile mirrored. So at cue = 0 the body is drawn as ONE polygon built
// straight from the profile — exact, and far cheaper than unioning a couple of
// thousand triangles — and the only thing that actually moves is the spout.
// That is also why the spout has to be there: without it there is no illusion,
// because there is no motion in the picture at all.

const KEY = [
  [0.00, -0.95], [0.26, -0.95], [0.30, -0.88], [0.22, -0.76], [0.19, -0.60],
  [0.27, -0.38], [0.38, -0.12], [0.42, 0.12], [0.36, 0.34], [0.25, 0.52],
  [0.19, 0.64], [0.21, 0.78], [0.27, 0.88], [0.28, 0.94], [0.00, 0.94]
];

// Catmull-Rom through the key points so the outline is a curve, not a polygon.
function smooth(key, sub) {
  const P = [key[0]].concat(key, [key[key.length - 1]]);
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([Math.max(0, f(p0[0], p1[0], p2[0], p3[0])), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(key[key.length - 1]);
  return out;
}
const FINE = smooth(KEY, 4);    // for the exact outline
const COARSE = smooth(KEY, 2);  // for the shaded mesh, which pays per face

// The body silhouette: up the right side of the profile, back down the left.
// Constant under rotation about the vertical axis, so it is built once.
const BODY = FINE.map(p => [p[0], p[1], 0])
  .concat(FINE.slice().reverse().map(p => [-p[0], p[1], 0]));

function armPath(s) {           // centre line of the spout, in the xy plane
  return [0.30 + 0.62 * s, 0.20 + 0.40 * Math.sin(s * 1.35), 0];
}
function armRadius(s) { return 0.125 * (1 - 0.42 * s); }

// --- geometry --------------------------------------------------------------
function armMesh(detail) {
  const M = Math.max(8, Math.round(16 * detail)), K = Math.max(6, Math.round(12 * detail));
  const verts = [], rings = [];
  for (let m = 0; m <= M; m++) {
    const s = m / M;
    const c = armPath(s);
    const c2 = armPath(Math.min(1, s + 0.01)), c0 = armPath(Math.max(0, s - 0.01));
    let tx = c2[0] - c0[0], ty = c2[1] - c0[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const nx = -ty, ny = tx;
    const r = armRadius(s);
    const row = [];
    for (let k = 0; k < K; k++) {
      const th = k / K * TAU, cs = Math.cos(th), sn = Math.sin(th);
      row.push(verts.length);
      verts.push([c[0] + r * cs * nx, c[1] + r * cs * ny, r * sn]);
    }
    rings.push(row);
  }
  const faces = [];
  for (let m = 0; m < M; m++) {
    for (let k = 0; k < K; k++) {
      const k2 = (k + 1) % K;
      faces.push([rings[m][k], rings[m + 1][k], rings[m + 1][k2], rings[m][k2]]);
    }
  }
  faces.push(rings[M].slice());             // the end cap, as one polygon
  return { verts: verts, faces: faces };
}

function bodyMesh(detail) {
  const SEG = Math.max(10, Math.round(20 * detail));
  const verts = [], rings = [];
  for (let j = 0; j < COARSE.length; j++) {
    const row = [];
    for (let i = 0; i < SEG; i++) {
      const a = i / SEG * TAU;
      row.push(verts.length);
      verts.push([COARSE[j][0] * Math.cos(a), COARSE[j][1], COARSE[j][0] * Math.sin(a)]);
    }
    rings.push(row);
  }
  const faces = [];
  for (let j = 0; j < COARSE.length - 1; j++) {
    for (let i = 0; i < SEG; i++) {
      const i2 = (i + 1) % SEG;
      faces.push([rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]]);
    }
  }
  return { verts: verts, faces: faces };
}

function pack(parts) {
  const verts = [], faces = [];
  for (const p of parts) {
    const off = verts.length;
    for (const v of p.verts) verts.push(v);
    for (const f of p.faces) faces.push(f.map(i => i + off));
  }
  return { verts: verts, faces: faces, buf: verts.map(() => [0, 0, 0]), out: faces.map(f => f.map(() => null)) };
}

const cacheFlat = new Map(), cacheFull = new Map();
function flat(detail) {   // spout only; the body is the static BODY polygon
  if (!cacheFlat.has(detail)) cacheFlat.set(detail, pack([armMesh(detail)]));
  return cacheFlat.get(detail);
}
function full(detail) {   // body + spout, for the shaded cue > 0 path
  if (!cacheFull.has(detail)) cacheFull.set(detail, pack([bodyMesh(detail), armMesh(detail)]));
  return cacheFull.get(detail);
}

function place(M, m, mirror) {
  const sz = mirror ? -1 : 1;
  for (let i = 0; i < M.verts.length; i++) {
    const v = M.verts[i], b = M.buf[i], z = v[2] * sz;
    b[0] = m[0] * v[0] + m[1] * v[1] + m[2] * z;
    b[1] = m[3] * v[0] + m[4] * v[1] + m[5] * z;
    b[2] = m[6] * v[0] + m[7] * v[1] + m[8] * z;
  }
  for (let i = 0; i < M.faces.length; i++) {
    const f = M.faces[i], o = M.out[i];
    for (let k = 0; k < f.length; k++) o[k] = M.buf[f[k]];
  }
  return M.out;
}

export default {
  id: 'silhouette',
  name: 'silhouette',
  blurb: 'A solid black-on-light silhouette of a turned vessel with one spout, filled flat with no ' +
         'shading, no outline and no interior line — the spinning-dancer trick. A silhouette throws ' +
         'away every depth cue there is; all that is left is an outline that swells and narrows.',
  tryThis: 'Wait for the spout to point straight at you, at its widest. In that instant decide it is ' +
           'coming towards you, or going away — that single choice sets the direction for the rest of the turn.',
  // a silhouette needs to be the dark thing, so this one is on paper
  palette: 'paper',
  mirrors: true,
  controls: [
    { key: 'period', label: 'period', min: 3, max: 14, step: 0.5, def: 8, unit: 's' }
  ],
  draw(ctx, phase, p, cue, opts) {
    const detail = (opts && opts.detail) || 1;
    const mirror = !!(opts && opts.mirror);
    const m = spinM(0, 'xy', phase * TAU, mirror);
    const P = pal(this, opts);
    const o = { fill: 0.44, color: P.ink, lit: P.dim };
    if (cue <= 0) drawMesh(ctx, [BODY].concat(place(flat(detail), m, mirror)), 0, o);
    else drawMesh(ctx, place(full(detail), m, mirror), cue, o);
  }
};
