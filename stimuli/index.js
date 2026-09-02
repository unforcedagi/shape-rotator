import arrow from './arrow.js';
import chair from './chair.js';
import sphere from './sphere.js';
import cylinder from './cylinder.js';
import cube from './cube.js';
import lissajous from './lissajous.js';
import ring from './ring.js';
import silhouette from './silhouette.js';
import dualAxis from './dual-axis.js';

// The two figurative ones first — the arrow is the loop everybody has already
// seen — then the seven laboratory stimuli, ordered easiest-to-flip to hardest.
export const FIGURATIVE = [arrow, chair];
export const LAB = [sphere, cylinder, cube, lissajous, ring, silhouette, dualAxis];
export const STIMULI = FIGURATIVE.concat(LAB);

export const DEFAULT_ID = 'arrow';

export const BY_ID = Object.fromEntries(STIMULI.map(s => [s.id, s]));

export function get(id) { return BY_ID[id] || BY_ID[DEFAULT_ID]; }

export function defaults(stim) {
  const p = {};
  for (const c of stim.controls) p[c.key] = c.def;
  return p;
}
