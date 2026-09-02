// render.js — orthographic projection, rigid rotation, and the cue dial.
//
// The whole product depends on one discipline: at cue = 0 the image must carry
// NO depth information. That means
//   * orthographic projection (no perspective divide),
//   * every dot the same radius and the same alpha regardless of z,
//   * every wire segment the same width and alpha regardless of z,
//   * no occlusion, no shading, no fog.
// Under those conditions a rigid rotation of a shape S about the vertical axis
// at +omega projects to exactly the same image as the depth-mirrored shape
// (x, y, -z) rotating at -omega, because the projection P drops z and P.D = P.
// So the image is genuinely, provably ambiguous, and the percept is free.
//
// The `cue` dial in [0,1] adds real depth information back, proportional to
// cue, so the true direction becomes visible. cue = 0 is the ambiguous state.

export const TAU = Math.PI * 2;

// deterministic little PRNG so a stimulus regenerates identically ------------
export function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

// --- rotation --------------------------------------------------------------
// Axis given by a tilt in degrees. plane 'xy' tilts the axis inside the screen
// plane (away from vertical, toward the right); plane 'yz' tilts it into depth
// (away from vertical, toward the viewer).
export function axisFrom(tiltDeg, plane) {
  const t = (tiltDeg || 0) * Math.PI / 180;
  if (plane === 'yz') return [0, Math.cos(t), Math.sin(t)];
  return [Math.sin(t), Math.cos(t), 0];
}

// Rodrigues rotation matrix about unit axis k by angle a, as a flat 9-array.
export function rotMatrix(k, a) {
  const [x, y, z] = k;
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [
    t * x * x + c,     t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c,     t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c
  ];
}

export function applyM(m, p, out) {
  const [x, y, z] = p;
  const o = out || [0, 0, 0];
  o[0] = m[0] * x + m[1] * y + m[2] * z;
  o[1] = m[3] * x + m[4] * y + m[5] * z;
  o[2] = m[6] * x + m[7] * y + m[8] * z;
  return o;
}

// Rotate a whole [x,y,z][] point list, reusing a scratch buffer.
export function rotateAll(pts, m, out) {
  const dst = out && out.length === pts.length ? out : pts.map(() => [0, 0, 0]);
  for (let i = 0; i < pts.length; i++) applyM(m, pts[i], dst[i]);
  return dst;
}

// --- view ------------------------------------------------------------------
// Model space is roughly the unit ball; R is the half-extent in device px.
export function view(ctx, fill) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  return { cx: w / 2, cy: h / 2, R: Math.min(w, h) * (fill == null ? 0.40 : fill), w, h };
}

export function clear(ctx, bg) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = bg || '#08090f';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

// --- the cue dial ----------------------------------------------------------
export const CUE_K = 0.34;   // perspective strength
const CUE_FIT = 0.17;        // global shrink that keeps a cued figure in frame
const SIZE_K = 0.48;         // dot-size-with-depth strength
const DIM_K = 0.58;          // how dark the far side gets at cue = 1

// perspective: scale = 1 / (1 - cue*k*z), with a global shrink so the near
// side does not grow off the edge of the canvas. Exactly 1 at cue = 0, which
// is the property the whole site rests on.
export function perspScale(z, cue) {
  return cue > 0 ? (1 - cue * CUE_FIT) / (1 - cue * CUE_K * z) : 1;
}
// dot radius x (1 + cue*z*k). Exactly baseR at cue = 0.
export function cueRadius(baseR, z, cue) {
  return baseR * (1 + cue * z * SIZE_K);
}
// alpha: 1 everywhere at cue = 0; 1 (near) .. 0.35 (far) at cue = 1.
export function cueAlpha(z, cue) {
  return 1 - cue * DIM_K * (1 - z) / 2;
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')';
}

// --- primitives ------------------------------------------------------------
// Dots. Sorted back-to-front so that when cue > 0 the near dots sit on top;
// at cue = 0 every dot is identical so the ordering is unobservable.
export function drawDots(ctx, pts, cue, o) {
  const v = view(ctx, o.fill);
  const color = o.color || '#dfe9f5';
  const baseR = (o.radius || 2) * (v.R / 260);
  const order = o.sort === false ? null : pts.map((_, i) => i).sort((a, b) => pts[a][2] - pts[b][2]);
  const n = pts.length;
  if (cue <= 0) {
    // one fill for the whole cloud: identical radius, identical alpha
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const x = v.cx + p[0] * v.R, y = v.cy - p[1] * v.R;
      ctx.moveTo(x + baseR, y);
      ctx.arc(x, y, baseR, 0, TAU);
    }
    ctx.fill();
    return;
  }
  for (let k = 0; k < n; k++) {
    const p = pts[order ? order[k] : k];
    const s = perspScale(p[2], cue);
    const x = v.cx + p[0] * v.R * s, y = v.cy - p[1] * v.R * s;
    const r = Math.max(0.35, cueRadius(baseR, p[2], cue) * s);
    ctx.fillStyle = rgba(color, cueAlpha(p[2], cue));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

// A wire: polyline through pts (closed if o.closed). At cue = 0 it is one path
// stroked once at a single width and full alpha, so no segment can be read as
// nearer than another.
export function drawWire(ctx, pts, cue, o) {
  const v = view(ctx, o.fill);
  const color = o.color || '#dfe9f5';
  const lw = (o.width || 2) * (v.R / 260);
  const closed = o.closed !== false;
  const n = pts.length;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (cue <= 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const x = v.cx + p[0] * v.R, y = v.cy - p[1] * v.R;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    if (closed) ctx.closePath();
    ctx.stroke();
    return;
  }
  const segs = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    segs.push([a, b, (a[2] + b[2]) / 2]);
  }
  segs.sort((p, q) => p[2] - q[2]);
  // Painter order is by depth, so consecutive segments have nearly equal z.
  // Quantise the style into buckets and batch each run into one stroke: same
  // pixels, a couple of dozen draw calls instead of several hundred.
  let bucket = -1;
  for (let i = 0; i <= segs.length; i++) {
    const seg = segs[i];
    const bk = seg ? Math.round(((seg[2] + 1) / 2) * 24) : -2;
    if (bk !== bucket) {
      if (bucket >= 0) ctx.stroke();
      if (!seg) break;
      bucket = bk;
      const zq = (bucket / 24) * 2 - 1;
      ctx.strokeStyle = rgba(color, cueAlpha(zq, cue));
      ctx.lineWidth = Math.max(0.4, lw * (1 + cue * zq * 0.7));
      ctx.beginPath();
    }
    const a = seg[0], b = seg[1];
    const sa = perspScale(a[2], cue), sb = perspScale(b[2], cue);
    ctx.moveTo(v.cx + a[0] * v.R * sa, v.cy - a[1] * v.R * sa);
    ctx.lineTo(v.cx + b[0] * v.R * sb, v.cy - b[1] * v.R * sb);
  }
}

// Independent segments (e.g. the 12 edges of a cube): pairs [[a,b],...].
export function drawSegments(ctx, segs, cue, o) {
  const v = view(ctx, o.fill);
  const color = o.color || '#dfe9f5';
  const lw = (o.width || 2) * (v.R / 260);
  ctx.lineCap = 'round';
  if (cue <= 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (const [a, b] of segs) {
      ctx.moveTo(v.cx + a[0] * v.R, v.cy - a[1] * v.R);
      ctx.lineTo(v.cx + b[0] * v.R, v.cy - b[1] * v.R);
    }
    ctx.stroke();
    return;
  }
  const ord = segs.slice().sort((p, q) => (p[0][2] + p[1][2]) - (q[0][2] + q[1][2]));
  for (const [a, b] of ord) {
    const zm = (a[2] + b[2]) / 2;
    const sa = perspScale(a[2], cue), sb = perspScale(b[2], cue);
    ctx.strokeStyle = rgba(color, cueAlpha(zm, cue));
    ctx.lineWidth = Math.max(0.4, lw * (1 + cue * zm * 0.7));
    ctx.beginPath();
    ctx.moveTo(v.cx + a[0] * v.R * sa, v.cy - a[1] * v.R * sa);
    ctx.lineTo(v.cx + b[0] * v.R * sb, v.cy - b[1] * v.R * sb);
    ctx.stroke();
  }
}

// A closed mesh drawn as a pure silhouette: at cue = 0 every triangle is filled
// with the identical colour and the union is taken with a nonzero fill, so the
// result is a flat shape with no internal edges at all — no depth information
// whatsoever. At cue > 0 the faces are painted back-to-front with flat lambert
// shading mixed in by cue, which separates front from back.
export function drawMesh(ctx, tris, cue, o) {
  const v = view(ctx, o.fill);
  const color = o.color || '#dfe9f5';
  if (cue <= 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const t of tris) {
      // Every face must be wound the same way in screen space, or a nonzero
      // fill will subtract one overlap from another and punch a hole in the
      // silhouette. Shoelace over the whole polygon, not just the first three
      // points, because these are not all triangles and not all convex.
      let area = 0;
      for (let i = 0, n = t.length; i < n; i++) {
        const p = t[i], q = t[(i + 1) % n];
        area += p[0] * q[1] - q[0] * p[1];
      }
      ctx.moveTo(v.cx + t[0][0] * v.R, v.cy - t[0][1] * v.R);
      if (area < 0) for (let i = t.length - 1; i >= 1; i--) ctx.lineTo(v.cx + t[i][0] * v.R, v.cy - t[i][1] * v.R);
      else for (let i = 1; i < t.length; i++) ctx.lineTo(v.cx + t[i][0] * v.R, v.cy - t[i][1] * v.R);
      ctx.closePath();
    }
    ctx.fill('nonzero');
    return;
  }
  const L = [0.45, 0.62, 0.65];
  const hex = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  // The shaded colour runs from `dark` (facing away from the light) to `lit`
  // (facing it), and `cue` says how far to travel from the flat fill towards it.
  // At cue = 0 every face is exactly `color`, which is what makes the silhouette
  // carry no depth information at all.
  const B = hex(color), D = hex(o.dark || color), S = hex(o.lit || '#9aa1b2');
  const ord = tris.slice().sort((p, q) => (p[0][2] + p[1][2] + p[2][2]) - (q[0][2] + q[1][2] + q[2][2]));
  ctx.lineJoin = 'round';
  // No back-face culling by default: for a non-convex assembly (the arrow is a
  // box plus a pyramid) the silhouette is not always bounded by front faces, and
  // culling eats the tip when the head points away. Painter's algorithm over
  // every triangle is correct for any closed solid and cheap at these counts.
  const cull = o.cull === true;
  for (const t of ord) {
    const ux = t[1][0] - t[0][0], uy = t[1][1] - t[0][1], uz = t[1][2] - t[0][2];
    const wx = t[2][0] - t[0][0], wy = t[2][1] - t[0][1], wz = t[2][2] - t[0][2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    if (cull && nz < 0) continue;
    let lam = Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
    if (nz < 0) lam *= 0.35;                 // a face pointing away reads as unlit
    lam = Math.min(1, 0.30 + 0.70 * lam);
    const col = 'rgb(' +
      Math.round(B[0] + (D[0] + (S[0] - D[0]) * lam - B[0]) * cue) + ',' +
      Math.round(B[1] + (D[1] + (S[1] - D[1]) * lam - B[1]) * cue) + ',' +
      Math.round(B[2] + (D[2] + (S[2] - D[2]) * lam - B[2]) * cue) + ')';
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < t.length; i++) {
      const q = t[i], sc = perspScale(q[2], cue);
      const X = v.cx + q[0] * v.R * sc, Y = v.cy - q[1] * v.R * sc;
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();     // stroke closes antialiasing seams
  }
}

// --- dot clouds ------------------------------------------------------------
// The main primitive of the figurative set. `cl` is a cloud from lib/cloud.js
// (a flat Float32Array of model points plus a palette index each); `m` is the
// 3x3 pose matrix. The rotation happens in here because at ten thousand points
// the per-point array allocation costs more than the arithmetic.
//
// At cue = 0 every dot is the same size and the same alpha, and the only thing
// that varies is which palette entry it is drawn in — either the index baked
// into the object, or a bucket taken from its height ON THE SCREEN. Both are
// invariant under the depth mirror, so the two readings of the loop are still
// the same picture down to the byte. Drawing order is by bucket, never by
// depth, so the order is invariant too.
//
// Overlaps are meant to brighten: with the additive blend of the `dark`
// palette, the places where the surface turns edge-on and the projected dots
// pile up run hot all by themselves. That rim is not drawn, it is counted.

const BINS = [];
function bins(k) {
  while (BINS.length < k) BINS.push([]);
  for (let i = 0; i < k; i++) BINS[i].length = 0;
  return BINS;
}
let SX = new Float32Array(0), SY = new Float32Array(0), SZ = new Float32Array(0);
let DX = new Float32Array(0), DY = new Float32Array(0), DW = new Uint8Array(0);
function scratch(n) {
  if (SX.length >= n) return;
  SX = new Float32Array(n); SY = new Float32Array(n); SZ = new Float32Array(n);
  DX = new Float32Array(n); DY = new Float32Array(n); DW = new Uint8Array(n);
}

// Depth buckets, used only when cue > 0. A bucket is one fill, and a fill on a
// big canvas costs roughly its bounding box, so colours x buckets is the thing
// that has to stay small: with the 24-entry height ramp, twelve depth buckets
// meant 288 full-width fills and 54 ms a frame. Size and perspective are
// per-dot anyway (a rect inside a path can be any size), so only the alpha
// needs bucketing, and four steps of it are plenty.
export const ZB = 12;
function zbFor(nc) { return nc > 8 ? 4 : 12; }

export function drawCloud(ctx, cl, m, cue, o) {
  const v = view(ctx, o.fill);
  const colors = o.colors || ['#e9f0fa'];
  const nc = colors.length;
  // On a small canvas the dots want to be less than a pixel across. Canvas
  // will not draw a sub-pixel square at full strength, so clamp the size and
  // pay the difference back in alpha — otherwise the landing-page previews
  // come out three times fainter than the real thing.
  const want = (o.size == null ? 1.5 : o.size) * (v.R / 260);
  const size = Math.max(0.85, want);
  let alpha = o.alpha == null ? 0.85 : o.alpha;
  if (want < size) alpha = Math.min(1, alpha * (size / want));
  const n = cl.n, xyz = cl.xyz, ci = cl.col;
  const mir = o.mirror ? -1 : 1;
  const ramp = o.ramp || null;
  const streak = o.streak || 0;
  const kx = o.axis ? o.axis[0] : 0, ky = o.axis ? o.axis[1] : 1, kz = o.axis ? o.axis[2] : 0;
  const dir = o.dir == null ? 1 : o.dir;
  const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3], m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7], m8 = m[8];
  scratch(n);

  const flat = cue <= 0;
  const zb0 = zbFor(nc);
  const nb = flat ? nc : nc * zb0;
  const B = bins(nb);
  // the ramp runs from the TOP of the object's screen height to the bottom
  const rtop = ramp ? ramp.top : 0, rspan = ramp ? (ramp.top - ramp.bot) || 1 : 1;

  for (let i = 0; i < n; i++) {
    const j = i * 3;
    const px = xyz[j], py = xyz[j + 1], pz = xyz[j + 2] * mir;
    const x = m0 * px + m1 * py + m2 * pz;
    const y = m3 * px + m4 * py + m5 * pz;
    const z = m6 * px + m7 * py + m8 * pz;
    SZ[i] = z;
    const s = flat ? 1 : perspScale(z, cue);
    SX[i] = v.cx + x * v.R * s;
    SY[i] = v.cy - y * v.R * s;
    if (streak) {
      // screen velocity of a point rotating about the pose axis. It is a
      // property of the projected motion, identical for both readings.
      DX[i] = dir * (ky * z - kz * y);
      DY[i] = -dir * (kz * x - kx * z);
    }
    let c;
    if (ramp) {
      c = ((rtop - y) / rspan * nc) | 0;
      if (c < 0) c = 0; else if (c >= nc) c = nc - 1;
    } else {
      c = ci[i];
      if (c >= nc) c = nc - 1;
    }
    if (flat) B[c].push(i);
    else {
      let zb = (((z + 1) * 0.5) * zb0) | 0;
      if (zb < 0) zb = 0; else if (zb >= zb0) zb = zb0 - 1;
      B[c * zb0 + zb].push(i);
      const r = cueRadius(size, z, cue) * s;
      DW[i] = r < 1.5 ? 1 : Math.min(255, (r + 0.5) | 0);
    }
  }

  const prevOp = ctx.globalCompositeOperation;
  if (o.blend) ctx.globalCompositeOperation = o.blend;
  ctx.lineCap = 'round';

  const emit = (list, col, a, sz) => {
    if (!list.length) return;
    if (streak) {
      ctx.strokeStyle = rgba(col, a);
      ctx.lineWidth = sz;
      ctx.beginPath();
      for (let q = 0; q < list.length; q++) {
        const i = list[q];
        const ex = DX[i] * streak * v.R, ey = DY[i] * streak * v.R;
        ctx.moveTo(SX[i] - ex, SY[i] - ey);
        ctx.lineTo(SX[i] + ex, SY[i] + ey);
      }
      ctx.stroke();
      return;
    }
    // One path per colour bucket, filled once. Per-dot fillRect measured an
    // order of magnitude slower. The rects are snapped to whole pixels so the
    // rasteriser has no antialiasing to do; snapping is safe for the
    // ambiguity, because both readings compute the same float and therefore
    // land on the same pixel.
    ctx.fillStyle = rgba(col, a);
    ctx.beginPath();
    if (sz > 0) {
      const w = sz < 1.5 ? 1 : (sz + 0.5) | 0, h = w * 0.5;
      for (let q = 0; q < list.length; q++) {
        const i = list[q];
        ctx.rect((SX[i] - h) | 0, (SY[i] - h) | 0, w, w);
      }
    } else {
      // sz < 0 means "each dot has its own size", precomputed in DW
      for (let q = 0; q < list.length; q++) {
        const i = list[q], w = DW[i], h = w * 0.5;
        ctx.rect((SX[i] - h) | 0, (SY[i] - h) | 0, w, w);
      }
    }
    ctx.fill();
  };

  if (flat) {
    for (let c = 0; c < nc; c++) emit(B[c], colors[c], alpha, size);
  } else {
    // far to near, so the near dots land on top once there is anything to see
    for (let zb = 0; zb < zb0; zb++) {
      const zq = ((zb + 0.5) / zb0) * 2 - 1;
      const a = alpha * cueAlpha(zq, cue);
      for (let c = 0; c < nc; c++) emit(B[c * zb0 + zb], colors[c], a, -1);
    }
  }
  ctx.globalCompositeOperation = prevOp;
}

// --- coloured edges --------------------------------------------------------
// `w` is a wire from lib/cloud.js: a point list, a list of index pairs, and a
// palette index per segment. Edges are pre-subdivided at build time, so a
// gradient along an edge is just a run of segments with neighbouring palette
// indices and the whole frame is still one stroke per colour.
export function drawEdges(ctx, w, m, cue, o) {
  const v = view(ctx, o.fill);
  const colors = o.colors || ['#e9f0fa'];
  const nc = colors.length;
  const lw = (o.width == null ? 1.1 : o.width) * (v.R / 260);
  const alpha = o.alpha == null ? 1 : o.alpha;
  const mir = o.mirror ? -1 : 1;
  const np = w.np, ns = w.ns, xyz = w.xyz, seg = w.seg, col = w.col;
  const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3], m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7], m8 = m[8];
  scratch(np);
  const flat = cue <= 0;
  for (let i = 0; i < np; i++) {
    const j = i * 3;
    const px = xyz[j], py = xyz[j + 1], pz = xyz[j + 2] * mir;
    const z = m6 * px + m7 * py + m8 * pz;
    const s = flat ? 1 : perspScale(z, cue);
    SX[i] = v.cx + (m0 * px + m1 * py + m2 * pz) * v.R * s;
    SY[i] = v.cy - (m3 * px + m4 * py + m5 * pz) * v.R * s;
    SZ[i] = z;
  }
  const nb = flat ? nc : nc * ZB;
  const B = bins(nb);
  for (let s = 0; s < ns; s++) {
    let c = col[s];
    if (c >= nc) c = nc - 1;
    if (flat) B[c].push(s);
    else {
      const zm = (SZ[seg[s * 2]] + SZ[seg[s * 2 + 1]]) / 2;
      let zb = (((zm + 1) * 0.5) * ZB) | 0;
      if (zb < 0) zb = 0; else if (zb >= ZB) zb = ZB - 1;
      B[c * ZB + zb].push(s);
    }
  }
  const prevOp = ctx.globalCompositeOperation;
  if (o.blend) ctx.globalCompositeOperation = o.blend;
  ctx.lineCap = o.cap || 'butt';
  ctx.lineJoin = 'round';
  const emit = (list, color, a, width) => {
    if (!list.length) return;
    ctx.strokeStyle = rgba(color, a);
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let q = 0; q < list.length; q++) {
      const s = list[q], i = seg[s * 2], j = seg[s * 2 + 1];
      ctx.moveTo(SX[i], SY[i]);
      ctx.lineTo(SX[j], SY[j]);
    }
    ctx.stroke();
  };
  if (flat) {
    for (let c = 0; c < nc; c++) emit(B[c], colors[c], alpha, lw);
  } else {
    for (let zb = 0; zb < ZB; zb++) {
      const zq = ((zb + 0.5) / ZB) * 2 - 1;
      const a = alpha * cueAlpha(zq, cue);
      const width = Math.max(0.4, lw * (1 + cue * zq * 0.7));
      for (let c = 0; c < nc; c++) emit(B[c * ZB + zb], colors[c], a, width);
    }
  }
  ctx.globalCompositeOperation = prevOp;
}
