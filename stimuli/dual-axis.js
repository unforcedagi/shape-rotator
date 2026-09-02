import { TAU, axisFrom, rotMatrix, rotateAll, drawWire } from '../lib/render.js';

// The "seam of a tennis ball" curve:
//   x = A cos u + B cos 3u,  y = A sin u - B sin 3u,  z = C sin 2u
// It has an S4 (rotary-reflection) symmetry about its own z axis: substituting
// u -> u + pi/2 gives exactly (-y, x, -z). Since orthographic projection throws
// away z, that says something useful — the depth-mirrored copy of this curve is
// the SAME curve turned a quarter turn. So when your percept flips, the object
// does not become a different object; only the axis it is turning about moves.
// Here the rotation axis is tilted out of the screen plane by `tilt`, so the two
// readings are "an axis leaning towards me" and "an axis leaning away", which is
// as close as this build gets to Frank Force's dual-axis illusion. See README.

const N = 520;
let cache = null;
function curve(b, c) {
  const key = b + '/' + c;
  if (cache && cache.key === key) return cache.pts;
  const A = 0.70;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const u = i / N * TAU;
    pts.push([
      A * Math.cos(u) + b * Math.cos(3 * u),
      A * Math.sin(u) - b * Math.sin(3 * u),
      c * Math.sin(2 * u)
    ]);
  }
  cache = { key, pts, buf: pts.map(() => [0, 0, 0]) };
  return pts;
}

export default {
  id: 'dual-axis',
  name: 'dual-axis knot',
  blurb: 'A tennis-ball-seam curve drawn as one wire of constant width, turning about an axis that ' +
         'leans out of the screen. The curve is its own depth-mirror rotated a quarter turn, so a ' +
         'reversal does not change the shape — it moves the axis. The hardest one here.',
  tryThis: 'Do not try to see a direction. Try to see the axis: a stick through the middle leaning ' +
           'towards you, then the same stick leaning away. The spin follows the stick.',
  controls: [
    { key: 'period', label: 'period', min: 3, max: 14, step: 0.5, def: 8, unit: 's' },
    { key: 'tilt', label: 'axis lean', min: 0, max: 70, step: 1, def: 40, unit: '°' },
    { key: 'b', label: 'seam', min: 0.05, max: 0.45, step: 0.01, def: 0.28 },
    { key: 'c', label: 'depth', min: 0.2, max: 1.0, step: 0.05, def: 0.62 },
    { key: 'w', label: 'stroke', min: 1, max: 6, step: 0.25, def: 2.5 }
  ],
  draw(ctx, phase, p, cue) {
    const pts = curve(p.b, p.c);
    const m = rotMatrix(axisFrom(p.tilt, 'yz'), phase * TAU);
    const rot = rotateAll(pts, m, cache.buf);
    drawWire(ctx, rot, cue, { width: p.w, closed: true, fill: 0.44 });
  }
};
