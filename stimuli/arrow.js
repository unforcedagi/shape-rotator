import { TAU, axisFrom, rotMatrix, applyM, drawMesh } from '../lib/render.js';
import { box, pyramidX, bake, transform } from '../lib/mesh.js';

// The one from the timeline: a chunky solid arrow — square shaft, pyramid head —
// turning about the vertical axis and drawn as a flat fill with no shading.
// It is worth saying why this one is airtight rather than merely convincing.
// The arrow is mirror-symmetric about its own z = 0 plane, so depth-mirroring it
// gives back the SAME arrow, not a different object. Orthographic projection
// discards z. Therefore "this arrow turning left" and "this arrow turning right"
// are not two rival models of the picture; they produce the identical picture,
// pixel for pixel, forever. There is nothing to be right about.

function build(headSize, headLen) {
  const shaftEnd = 0.95 - headLen;
  const tris = box([(-0.95 + shaftEnd) / 2, 0, 0], [(shaftEnd + 0.95) / 2, 0.17, 0.17])
    .concat(pyramidX(shaftEnd, 0.95, headSize, 0, 0));
  return bake(tris);
}

let cache = null;
function mesh(headSize, headLen) {
  const key = headSize + '/' + headLen;
  if (!cache || cache.key !== key) cache = { key, m: build(headSize, headLen) };
  return cache.m;
}

export default {
  id: 'arrow',
  name: 'arrow',
  blurb: 'A solid arrow — square shaft, pyramid head — turning about the vertical axis, filled flat ' +
         'with no shading and no outline. The arrow is its own mirror image in depth, so the two ' +
         'readings are not rival guesses about one picture: they are the same picture.',
  tryThis: 'Watch the head. When it swings across the middle, decide it is passing in front of the ' +
           'shaft — then decide it is passing behind. That is the whole illusion, and both are true.',
  controls: [
    { key: 'period', label: 'period', min: 2, max: 12, step: 0.5, def: 4, unit: 's' },
    { key: 'head', label: 'head', min: 0.25, max: 0.55, step: 0.01, def: 0.40 },
    { key: 'len', label: 'point', min: 0.3, max: 1.0, step: 0.05, def: 0.60 }
  ],
  draw(ctx, phase, p, cue) {
    const M = mesh(p.head, p.len);
    const m = rotMatrix(axisFrom(0), phase * TAU);
    const tris = transform(M, m, applyM);
    drawMesh(ctx, tris, cue, { fill: 0.50, color: '#dfe9f5', dark: '#39414f', lit: '#ffffff' });
  }
};
