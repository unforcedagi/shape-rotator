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
export const CUE_K = 0.42;   // perspective strength
const SIZE_K = 0.48;         // dot-size-with-depth strength
const DIM_K = 0.58;          // how dark the far side gets at cue = 1

// perspective: scale = 1 / (1 - cue*k*z). Exactly 1 at cue = 0.
export function perspScale(z, cue) {
  return cue > 0 ? 1 / (1 - cue * CUE_K * z) : 1;
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
