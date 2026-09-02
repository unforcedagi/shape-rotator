import { TAU, makeRng, spinM, rotateAll, drawDots } from '../lib/render.js';

let cache = null;
function points(n) {
  if (cache && cache.n === n) return cache.pts;
  const rnd = makeRng(0x5eed01 ^ n);
  const pts = [];
  for (let i = 0; i < n; i++) {
    // uniform on the sphere: y uniform in [-1,1], azimuth uniform
    const y = rnd() * 2 - 1;
    const a = rnd() * TAU;
    const r = Math.sqrt(1 - y * y);
    pts.push([r * Math.cos(a), y, r * Math.sin(a)]);
  }
  cache = { n, pts, buf: pts.map(() => [0, 0, 0]) };
  return pts;
}

export default {
  id: 'sphere',
  name: 'sphere',
  blurb: 'Dots scattered uniformly over an invisible sphere, turning about the vertical axis. ' +
         'Every dot is the same size and the same brightness whatever its depth, so nothing in the ' +
         'image says which half is in front.',
  tryThis: 'Pick one dot near the left edge and decide, out loud, that it is on the near side. ' +
           'The whole sphere usually swings round to agree with you.',
  controls: [
    { key: 'n', label: 'dots', min: 40, max: 600, step: 10, def: 150 },
    { key: 'period', label: 'period', min: 3, max: 12, step: 0.5, def: 6, unit: 's' },
    { key: 'r', label: 'dot', min: 1, max: 4, step: 0.25, def: 2 }
  ],
  mirrors: true,
  draw(ctx, phase, p, cue, opts) {
    const mirror = !!(opts && opts.mirror);
    const pts = points(Math.round(p.n));
    const m = spinM(0, 'xy', phase * TAU, mirror);
    const rot = rotateAll(pts, m, cache.buf, mirror);
    drawDots(ctx, rot, cue, { radius: p.r, fill: 0.40 });
  }
};
