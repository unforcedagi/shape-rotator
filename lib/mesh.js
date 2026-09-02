// mesh.js — the two solid primitives the figurative stimuli are built from.
// Everything comes out as a flat list of triangles [[x,y,z],[x,y,z],[x,y,z]]
// wound so the face normal points away from the piece's own centre, which is
// what drawMesh's back-face cull expects once the cue dial is above zero.

function normal(t) {
  const [a, b, c] = t;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
  return [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
}

// Flip any triangle whose normal points back towards `centre`.
export function faceOutward(tris, centre) {
  for (const t of tris) {
    const n = normal(t);
    const cx = (t[0][0] + t[1][0] + t[2][0]) / 3 - centre[0];
    const cy = (t[0][1] + t[1][1] + t[2][1]) / 3 - centre[1];
    const cz = (t[0][2] + t[1][2] + t[2][2]) / 3 - centre[2];
    if (n[0] * cx + n[1] * cy + n[2] * cz < 0) { const s = t[1]; t[1] = t[2]; t[2] = s; }
  }
  return tris;
}

// Axis-aligned box given centre and half-extents.
export function box(c, h) {
  const V = [];
  for (let i = 0; i < 8; i++) {
    V.push([c[0] + (i & 1 ? h[0] : -h[0]), c[1] + (i & 2 ? h[1] : -h[1]), c[2] + (i & 4 ? h[2] : -h[2])]);
  }
  const F = [
    [0, 2, 6, 4], [1, 3, 7, 5],   // -x, +x
    [0, 1, 5, 4], [2, 3, 7, 6],   // -y, +y
    [0, 1, 3, 2], [4, 5, 7, 6]    // -z, +z
  ];
  const tris = [];
  for (const f of F) {
    tris.push([V[f[0]], V[f[1]], V[f[2]]], [V[f[0]], V[f[2]], V[f[3]]]);
  }
  return faceOutward(tris, c);
}

// Pyramid: a square base perpendicular to +x at x = x0 with half-size s, and
// an apex at x = x1 on the axis. This is the arrowhead.
export function pyramidX(x0, x1, s, yc, zc) {
  const b = [
    [x0, yc - s, zc - s], [x0, yc + s, zc - s], [x0, yc + s, zc + s], [x0, yc - s, zc + s]
  ];
  const apex = [x1, yc, zc];
  const tris = [];
  for (let i = 0; i < 4; i++) tris.push([b[i], b[(i + 1) % 4], apex]);
  tris.push([b[0], b[1], b[2]], [b[0], b[2], b[3]]);
  return faceOutward(tris, [(x0 * 3 + x1) / 4, yc, zc]);
}

// Bake a mesh into the buffers drawMesh wants, so a stimulus can rotate it
// without allocating anything per frame.
export function bake(tris) {
  const verts = [], index = new Map(), idx = [];
  for (const t of tris) {
    const row = [];
    for (const p of t) {
      const k = p[0].toFixed(6) + ',' + p[1].toFixed(6) + ',' + p[2].toFixed(6);
      let i = index.get(k);
      if (i === undefined) { i = verts.length; verts.push(p); index.set(k, i); }
      row.push(i);
    }
    idx.push(row);
  }
  return { verts, idx, buf: verts.map(() => [0, 0, 0]), out: idx.map(() => [null, null, null]) };
}

export function transform(M, m, applyM) {
  for (let i = 0; i < M.verts.length; i++) applyM(m, M.verts[i], M.buf[i]);
  for (let i = 0; i < M.idx.length; i++) {
    const t = M.idx[i], o = M.out[i];
    o[0] = M.buf[t[0]]; o[1] = M.buf[t[1]]; o[2] = M.buf[t[2]];
  }
  return M.out;
}
