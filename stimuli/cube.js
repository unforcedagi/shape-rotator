import { TAU, axisFrom, rotMatrix, applyM, drawSegments } from '../lib/render.js';

const V = [];
for (let i = 0; i < 8; i++) {
  V.push([(i & 1 ? 1 : -1) * 0.62, (i & 2 ? 1 : -1) * 0.62, (i & 4 ? 1 : -1) * 0.62]);
}
const E = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
const buf = V.map(() => [0, 0, 0]);
const segs = E.map(() => [null, null]);

export default {
  id: 'cube',
  name: 'cube',
  blurb: 'A Necker cube set in motion. All twelve edges are drawn at exactly the same weight and ' +
         'brightness with no hidden-line removal, so which corner is nearest is undecided — and the ' +
         'axis is tilted a little off vertical so the faces cross each other as it turns.',
  tryThis: 'Fix on the nearest vertical edge and force it to become the far one. The whole cube ' +
           'turns inside out and reverses at the same moment.',
  controls: [
    { key: 'period', label: 'period', min: 3, max: 12, step: 0.5, def: 7, unit: 's' },
    { key: 'tilt', label: 'tilt', min: 0, max: 45, step: 1, def: 20, unit: '°' },
    { key: 'w', label: 'stroke', min: 1, max: 5, step: 0.25, def: 2 }
  ],
  draw(ctx, phase, p, cue) {
    const m = rotMatrix(axisFrom(p.tilt, 'xy'), phase * TAU);
    for (let i = 0; i < 8; i++) applyM(m, V[i], buf[i]);
    for (let i = 0; i < E.length; i++) { segs[i][0] = buf[E[i][0]]; segs[i][1] = buf[E[i][1]]; }
    drawSegments(ctx, segs, cue, { width: p.w, fill: 0.42 });
  }
};
