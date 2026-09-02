import { TAU, spinM, rotateAll, drawWire } from '../lib/render.js';

const N = 420;
let cache = null;
function curve(a, b, c, ph) {
  const key = a + '/' + b + '/' + c + '/' + ph;
  if (cache && cache.key === key) return cache.pts;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const u = i / N * TAU;
    pts.push([0.92 * Math.cos(a * u), 0.92 * Math.sin(b * u), 0.92 * Math.sin(c * u + ph)]);
  }
  cache = { key, pts, buf: pts.map(() => [0, 0, 0]) };
  return pts;
}

export default {
  id: 'lissajous',
  name: 'lissajous',
  blurb: 'A closed 3D Lissajous curve — x = cos(a·u), y = sin(b·u), z = sin(c·u + φ) — drawn as one ' +
         'wire of constant width and turned about the vertical. Wireframes flip most readily at the ' +
         'crossings, where two strands of the same curve overlap and neither is in front.',
  tryThis: 'Stare at one crossing point and swap which strand is on top. The reversal usually ' +
           'spreads outward from that one crossing to the whole figure.',
  controls: [
    { key: 'period', label: 'period', min: 3, max: 12, step: 0.5, def: 7, unit: 's' },
    { key: 'a', label: 'a', min: 1, max: 5, step: 1, def: 3 },
    { key: 'b', label: 'b', min: 1, max: 5, step: 1, def: 2 },
    { key: 'c', label: 'c', min: 1, max: 5, step: 1, def: 4 },
    { key: 'w', label: 'stroke', min: 1, max: 5, step: 0.25, def: 2 }
  ],
  mirrors: true,
  draw(ctx, phase, p, cue, opts) {
    const mirror = !!(opts && opts.mirror);
    const pts = curve(Math.round(p.a), Math.round(p.b), Math.round(p.c), Math.PI / 4);
    const m = spinM(0, 'xy', phase * TAU, mirror);
    const rot = rotateAll(pts, m, cache.buf, mirror);
    drawWire(ctx, rot, cue, { width: p.w, closed: true, fill: 0.42 });
  }
};
