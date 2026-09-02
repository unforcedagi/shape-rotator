// cloud.js — the dot-cloud toolkit.
//
// The figurative loops on this site are not drawn as filled solids. They are
// drawn the way the loops on the timeline are drawn: as a few thousand tiny
// dots scattered over the object's SURFACE, every dot the same size, with no
// occlusion and no z-sort. Everything that makes those loops look good falls
// out of that one decision:
//
//   * where the surface turns away from you the dots pile up in projection,
//     so the silhouette draws itself as a bright rim — you do not fake it;
//   * where the surface faces you the dots spread out and it goes dim;
//   * the shape reads as a shape without a single shading cue.
//
// So the primitive here is "sample this parametric surface uniformly by area".
//
// Geometry lives in flat Float32Arrays and is rotated inside the draw call,
// because at ten thousand points an array-of-arrays costs more than the maths.

// --- deterministic RNG (same generator as render.js, kept local) ------------
export function rng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

// --- containers ------------------------------------------------------------
// A cloud is n points plus a palette index per point. `col` is an index into
// whatever ramp the stimulus hands the renderer, never a colour: colours have
// to stay quantised so a frame can be drawn in a couple of dozen fills.
export function cloud(n) {
  return { n: n, xyz: new Float32Array(n * 3), col: new Uint8Array(n) };
}

// A wire is a point list plus independent segments, each with a palette index.
export function wire(np, ns) {
  return { np: np, ns: ns, xyz: new Float32Array(np * 3), seg: new Int32Array(ns * 2), col: new Uint8Array(ns) };
}

// --- pose ------------------------------------------------------------------
// Every figurative object spins about its OWN axis, and that axis is tilted
// `tilt` degrees towards the viewer, so you are looking at it slightly from
// above and the top of it traces a visible circle instead of sliding flatly
// left and right. That tilt is the whole difference between "blocky and sharp
// in its turns" and the circular, wheeling feel of the loops we are copying.
//
// The matrix is Rx(tilt) . Ry(angle) — spin the object about its own vertical,
// then tip the whole thing towards the camera.
//
// `mirror` builds the OTHER member of the ambiguous pair: the depth-mirrored
// object turning the other way, i.e. Rx(-tilt) . Ry(-angle) applied to the
// object with every z negated. Conjugation by the depth flip D = diag(1,1,-1)
// maps a rotation about k by a to a rotation about Dk by -a, so this is a
// genuine rigid rotation of a genuine mirrored object, not a relabelling —
// and its projection is the same picture, to the bit. Every sign that changes
// changes twice on the way to x and y, and IEEE arithmetic gets exactly the
// same answer for a sum of exactly negated products.
export function pose(tiltDeg, angle, mirror) {
  const t = (tiltDeg || 0) * Math.PI / 180 * (mirror ? -1 : 1);
  // wrap first: a turn of exactly 2pi is the identity, but sin(2pi) is -2.4e-16
  // rather than 0, and that is enough to reorder a depth sort and make the last
  // frame of a loop differ from the first by a pixel or two.
  const a = (mirror ? -angle : angle) % (Math.PI * 2);
  const ct = Math.cos(t), st = Math.sin(t), ca = Math.cos(a), sa = Math.sin(a);
  return [
    ca, 0, sa,
    st * sa, ct, -st * ca,
    -ct * sa, st, ct * ca
  ];
}

// --- area-weighted sampling ------------------------------------------------
// Sample a parametric patch f(u, v, out) with u, v in [0,1] at N points spread
// uniformly by AREA: build a coarse grid, measure each cell, and pick cells in
// proportion. Uniform-in-(u,v) would bunch the dots wherever the
// parametrisation is dense (the poles of a sphere, the tip of a cone) and the
// object would look wrong in exactly the places the eye checks.
export function surfaceArea(f, uSegs, vSegs) {
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0], d = [0, 0, 0];
  const cells = new Float64Array(uSegs * vSegs);
  let total = 0;
  for (let i = 0; i < uSegs; i++) {
    const u0 = i / uSegs, u1 = (i + 1) / uSegs;
    for (let j = 0; j < vSegs; j++) {
      const v0 = j / vSegs, v1 = (j + 1) / vSegs;
      f(u0, v0, a); f(u1, v0, b); f(u1, v1, c); f(u0, v1, d);
      const A = triArea(a, b, c) + triArea(a, c, d);
      cells[i * vSegs + j] = A;
      total += A;
    }
  }
  return { cells: cells, total: total, uSegs: uSegs, vSegs: vSegs, f: f };
}

function triArea(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
  const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
  return 0.5 * Math.hypot(nx, ny, nz);
}

// Draw n points from a measured patch into xyz at offset `off` (in points).
export function sampleSurface(patch, n, rnd, xyz, off) {
  const { cells, total, uSegs, vSegs, f } = patch;
  // prefix sums for O(log) cell choice
  const cdf = new Float64Array(cells.length);
  let acc = 0;
  for (let i = 0; i < cells.length; i++) { acc += cells[i]; cdf[i] = acc; }
  const p = [0, 0, 0];
  for (let k = 0; k < n; k++) {
    const r = rnd() * total;
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < r) lo = mid + 1; else hi = mid; }
    const i = (lo / vSegs) | 0, j = lo - i * vSegs;
    const u = (i + rnd()) / uSegs, v = (j + rnd()) / vSegs;
    f(u, v, p);
    const o = (off + k) * 3;
    xyz[o] = p[0]; xyz[o + 1] = p[1]; xyz[o + 2] = p[2];
  }
  return off + n;
}

// Arc-length-weighted sampling of a curve g(u, out), optionally scattered
// inside a tube of radius `jitter` around it. This is what draws the banana's
// ridge lines and the coil's fat grainy stroke.
export function sampleCurve(g, n, rnd, xyz, off, jitter) {
  const S = 256;
  const a = [0, 0, 0], b = [0, 0, 0];
  const cdf = new Float64Array(S);
  let acc = 0;
  g(0, a);
  for (let i = 0; i < S; i++) {
    g((i + 1) / S, b);
    acc += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    cdf[i] = acc;
    a[0] = b[0]; a[1] = b[1]; a[2] = b[2];
  }
  const p = [0, 0, 0];
  const j = jitter || 0;
  for (let k = 0; k < n; k++) {
    const r = rnd() * acc;
    let lo = 0, hi = S - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < r) lo = mid + 1; else hi = mid; }
    g((lo + rnd()) / S, p);
    const o = (off + k) * 3;
    if (j > 0) {
      // uniform inside a ball of radius j (rejection: three tries is plenty)
      let dx = 0, dy = 0, dz = 0;
      for (let t = 0; t < 6; t++) {
        dx = rnd() * 2 - 1; dy = rnd() * 2 - 1; dz = rnd() * 2 - 1;
        if (dx * dx + dy * dy + dz * dz <= 1) break;
      }
      xyz[o] = p[0] + dx * j; xyz[o + 1] = p[1] + dy * j; xyz[o + 2] = p[2] + dz * j;
    } else {
      xyz[o] = p[0]; xyz[o + 1] = p[1]; xyz[o + 2] = p[2];
    }
  }
  return off + n;
}

// --- patch builders --------------------------------------------------------
// Each returns a measured patch ready for sampleSurface.

// A swept tube: centreline path(u) -> [x,y,z], radius radiusFn(u), with a
// parallel-transported frame so it does not twist. Optional `caps`.
export function tubePatches(path, radiusFn, uSegs, vSegs, capEnds) {
  const frames = buildFrames(path, uSegs);
  const f = (u, v, out) => tubePoint(frames, radiusFn, u, v, out);
  const list = [surfaceArea(f, uSegs, vSegs)];
  if (capEnds) {
    for (const end of [0, 1]) {
      const cap = (u, v, out) => {
        // u = radial fraction, v = angle
        const r = radiusFn(end) * u;
        const fr = frameAt(frames, end);
        const a = v * Math.PI * 2;
        out[0] = fr.p[0] + r * (Math.cos(a) * fr.n[0] + Math.sin(a) * fr.b[0]);
        out[1] = fr.p[1] + r * (Math.cos(a) * fr.n[1] + Math.sin(a) * fr.b[1]);
        out[2] = fr.p[2] + r * (Math.cos(a) * fr.n[2] + Math.sin(a) * fr.b[2]);
      };
      list.push(surfaceArea(cap, 8, vSegs));
    }
  }
  return list;
}

function buildFrames(path, uSegs) {
  const N = uSegs + 1;
  const P = [], T = [], NN = [], B = [];
  const a = [0, 0, 0], b = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const u = i / uSegs;
    const p = [0, 0, 0];
    path(u, p);
    P.push(p);
    const h = 1e-4;
    path(Math.max(0, u - h), a); path(Math.min(1, u + h), b);
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
    const L = Math.hypot(tx, ty, tz) || 1;
    T.push([tx / L, ty / L, tz / L]);
  }
  // parallel transport an initial normal
  let n0 = cross(T[0], Math.abs(T[0][2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]);
  n0 = norm(n0);
  NN.push(n0); B.push(norm(cross(T[0], n0)));
  for (let i = 1; i < N; i++) {
    let n = sub(NN[i - 1], scale(T[i], dot(NN[i - 1], T[i])));
    n = norm(n);
    NN.push(n); B.push(norm(cross(T[i], n)));
  }
  return { P: P, T: T, N: NN, B: B, uSegs: uSegs };
}

function frameAt(fr, u) {
  const i = Math.min(fr.uSegs, Math.max(0, Math.round(u * fr.uSegs)));
  return { p: fr.P[i], n: fr.N[i], b: fr.B[i], t: fr.T[i] };
}

function tubePoint(fr, radiusFn, u, v, out) {
  const x = u * fr.uSegs;
  const i = Math.min(fr.uSegs - 1, Math.max(0, Math.floor(x)));
  const w = x - i;
  const p0 = fr.P[i], p1 = fr.P[i + 1];
  const n0 = fr.N[i], n1 = fr.N[i + 1];
  const b0 = fr.B[i], b1 = fr.B[i + 1];
  const a = v * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
  const r = radiusFn(u);
  for (let k = 0; k < 3; k++) {
    const p = p0[k] + (p1[k] - p0[k]) * w;
    const n = n0[k] + (n1[k] - n0[k]) * w;
    const b = b0[k] + (b1[k] - b0[k]) * w;
    out[k] = p + r * (ca * n + sa * b);
  }
}

// A square-section bar from a to b with half-thickness h: four sides and two
// caps, as six measured patches. This is what every member of the chair is.
export function barPatches(a, b, h, segs) {
  const d = norm(sub(b, a));
  let u = cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  u = norm(u);
  const v = norm(cross(d, u));
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const side = (s0, t0, s1, t1) => (p, q, out) => {
    // p along the bar, q across this face
    const s = s0 + (s1 - s0) * q, t = t0 + (t1 - t0) * q;
    for (let k = 0; k < 3; k++) out[k] = a[k] + d[k] * (L * p) + u[k] * s * h + v[k] * t * h;
  };
  const cap = (end) => (p, q, out) => {
    for (let k = 0; k < 3; k++) {
      out[k] = a[k] + d[k] * (L * end) + u[k] * (p * 2 - 1) * h + v[k] * (q * 2 - 1) * h;
    }
  };
  const n = segs || 24;
  return [
    surfaceArea(side(-1, -1, 1, -1), n, 3),
    surfaceArea(side(1, -1, 1, 1), n, 3),
    surfaceArea(side(1, 1, -1, 1), n, 3),
    surfaceArea(side(-1, 1, -1, -1), n, 3),
    surfaceArea(cap(0), 3, 3),
    surfaceArea(cap(1), 3, 3)
  ];
}

// A flat triangle ABC. The parametrisation collapses one edge to a point at
// u = 1, which is fine: surfaceArea measures the cells and the sampler weights
// them, so the degenerate end simply gets nothing.
export function triPatch(A, B, C) {
  const f = (u, v, out) => {
    const w = v * (1 - u);
    for (let k = 0; k < 3; k++) out[k] = A[k] + (B[k] - A[k]) * u + (C[k] - A[k]) * w;
  };
  return surfaceArea(f, 20, 20);
}

// A flat rectangular panel (both faces), spanned by two edge vectors from o.
export function panelPatch(o, e1, e2) {
  const f = (u, v, out) => {
    for (let k = 0; k < 3; k++) out[k] = o[k] + e1[k] * u + e2[k] * v;
  };
  return surfaceArea(f, 16, 16);
}

// --- little vector helpers -------------------------------------------------
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function norm(a) { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / L, a[1] / L, a[2] / L]; }
export { cross, dot, sub, scale, norm };

// A tiny keyed cache. Every figurative stimulus builds its cloud once per
// (params, dot count) and hands it back, and it has to hold more than ONE
// entry: the app page draws the main canvas at full detail and the two twin
// canvases at reduced detail in the same frame, so a single-slot cache would
// rebuild the geometry three times a frame and the page would crawl.
export function memo(limit) {
  const m = new Map();
  return function (key, make) {
    let v = m.get(key);
    if (v === undefined) {
      v = make();
      m.set(key, v);
      if (m.size > (limit || 4)) m.delete(m.keys().next().value);
    }
    return v;
  };
}

// Fill a whole cloud from a list of parts, splitting N between them in
// proportion to weight, and tagging each part's points with a palette index.
//
// A part is either
//   { patches: [...measured patches], col, share }   surface, weight = area
//   { curve: g(u,out), weight, col, jitter }         curve, weight given
// `share` multiplies a surface's weight when you want a feature denser than
// its area deserves; `weight` for a curve is in the same arbitrary units as
// the areas, so it is set by eye against the surfaces it sits on.
export function fillCloud(parts, N, seed) {
  const rnd = rng(seed);
  const flat = [];
  let total = 0;
  for (const s of parts) {
    if (s.curve) {
      const w = s.weight == null ? 1 : s.weight;
      flat.push({ curve: s.curve, w: w, col: s.col || 0, jitter: s.jitter || 0 });
      total += w;
      continue;
    }
    for (const p of (s.patches || [s.patch])) {
      const w = p.total * (s.share == null ? 1 : s.share);
      flat.push({ p: p, w: w, col: s.col || 0 });
      total += w;
    }
  }
  const counts = flat.map(f => Math.max(1, Math.round(N * f.w / total)));
  let n = 0;
  for (const c of counts) n += c;
  const cl = cloud(n);
  let off = 0;
  for (let i = 0; i < flat.length; i++) {
    const f = flat[i], c = counts[i];
    if (f.curve) off = sampleCurve(f.curve, c, rnd, cl.xyz, off, f.jitter);
    else off = sampleSurface(f.p, c, rnd, cl.xyz, off);
    for (let k = off - c; k < off; k++) cl.col[k] = f.col;
  }
  return cl;
}
