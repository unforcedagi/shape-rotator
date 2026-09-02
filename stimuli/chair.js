import { TAU, axisFrom, rotMatrix, applyM, drawMesh } from '../lib/render.js';
import { box, bake, transform } from '../lib/mesh.js';

// Six boxes: a seat, a back and four legs. A chair is mirror-symmetric about
// the plane through its own front-back axis, so the depth-mirrored chair is
// still a perfectly ordinary chair facing the other way — which is exactly the
// condition for the rotation direction to be undecidable. Familiar objects are
// harder than dot clouds, because you know what a chair is and your visual
// system would very much like to tell you which way it is facing.

function build(back, legs) {
  const t = []
    .concat(box([0, 0, 0], [0.36, 0.05, 0.36]))                       // seat
    .concat(box([0, 0.05 + back / 2, -0.31], [0.36, back / 2, 0.05])); // back
  const L = 0.44;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    t.push.apply(t, box([sx * 0.30, -0.05 - L / 2, sz * 0.30], [legs, L / 2, legs]));
  }
  return bake(t);
}

let cache = null;
function mesh(back, legs) {
  const key = back + '/' + legs;
  if (!cache || cache.key !== key) cache = { key, m: build(back, legs) };
  return cache.m;
}

export default {
  id: 'chair',
  name: 'chair',
  blurb: 'Six boxes: a seat, a back and four legs, filled flat and turning about the vertical axis. ' +
         'The mirror of a chair is still a chair, just facing the other way — so the picture cannot ' +
         'tell you which, and neither can your knowledge of chairs.',
  tryThis: 'Decide the back of the chair is the near edge, and hold it. Recognisable objects fight ' +
           'back harder than dots do: it will try to snap to whichever reading you had a moment ago.',
  controls: [
    { key: 'period', label: 'period', min: 3, max: 14, step: 0.5, def: 7, unit: 's' },
    { key: 'back', label: 'back', min: 0.3, max: 1.0, step: 0.05, def: 0.75 },
    { key: 'legs', label: 'legs', min: 0.03, max: 0.12, step: 0.005, def: 0.055 }
  ],
  draw(ctx, phase, p, cue) {
    const M = mesh(p.back, p.legs);
    const m = rotMatrix(axisFrom(0), phase * TAU);
    const tris = transform(M, m, applyM);
    drawMesh(ctx, tris, cue, { fill: 0.46, color: '#dfe9f5', dark: '#39414f', lit: '#ffffff' });
  }
};
