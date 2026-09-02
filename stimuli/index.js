import ringArrow from './ring-arrow.js';
import chair from './chair.js';
import tetra from './tetra.js';
import banana from './banana.js';
import arrow from './arrow.js';
import sphere from './sphere.js';
import cylinder from './cylinder.js';
import cube from './cube.js';
import lissajous from './lissajous.js';
import ring from './ring.js';
import silhouette from './silhouette.js';
import dualAxis from './dual-axis.js';

// The figurative set first — dot clouds, in the style of the loops that go
// round on the timeline, with the ring arrow (the one everybody has seen) at
// the front — then the seven laboratory stimuli, easiest-to-flip to hardest.
export const FIGURATIVE = [ringArrow, chair, tetra, banana, arrow];
export const LAB = [sphere, cylinder, cube, lissajous, ring, silhouette, dualAxis];
export const STIMULI = FIGURATIVE.concat(LAB);

export const DEFAULT_ID = 'ring-arrow';

export const BY_ID = Object.fromEntries(STIMULI.map(s => [s.id, s]));

export function get(id) { return BY_ID[id] || BY_ID[DEFAULT_ID]; }

export function defaults(stim) {
  const p = {};
  for (const c of stim.controls) p[c.key] = c.def;
  return p;
}
