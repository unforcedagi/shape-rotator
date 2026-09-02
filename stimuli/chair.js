import { TAU, drawCloud } from '../lib/render.js';
import { pose, barPatches, panelPatch, fillCloud, memo } from '../lib/cloud.js';
import { adapt, palName, PALETTES } from '../lib/palette.js';

// A plain wooden chair, every member of it a chunky square-section bar drawn
// as a speckled tube of white dots, with the seat and the back panel filled in
// sparsely and dimly so they read as surfaces without hiding anything behind
// them. Fifteen degrees from above, seven seconds a turn.
//
// A chair is the hardest case in the set and that is the point. The depth
// mirror of a chair is a perfectly ordinary chair facing the other way, so
// there is nothing incoherent about either reading — but you know what a chair
// is, and knowing is exactly what makes the percept stick.

const HW = 0.42, HD = 0.38;          // half width, half depth
const B = 0.036;                     // half the thickness of every bar
const FLOOR = -1.0, SEAT = -0.14, TOP = 1.0;
const LX = HW - B, LZ = HD - B;      // where the leg centrelines run

function build(N, panels) {
  const bars = [];
  const bar = (a, b) => bars.push.apply(bars, barPatches(a, b, B, 20));

  for (const sx of [-1, 1]) {
    bar([sx * LX, FLOOR, LZ], [sx * LX, SEAT, LZ]);          // front legs
    bar([sx * LX, FLOOR, -LZ], [sx * LX, TOP, -LZ]);         // back legs, on up as the stiles
  }
  // the frame under the seat
  const sy = SEAT - B * 1.6;
  bar([-LX, sy, LZ], [LX, sy, LZ]);
  bar([-LX, sy, -LZ], [LX, sy, -LZ]);
  bar([-LX, sy, -LZ], [-LX, sy, LZ]);
  bar([LX, sy, -LZ], [LX, sy, LZ]);
  // the back: a top rail and a rail under the panel
  bar([-LX, TOP - B, -LZ], [LX, TOP - B, -LZ]);
  bar([-LX, 0.30, -LZ], [LX, 0.30, -LZ]);
  // stretchers, low down, at two heights so the near ones cross the far ones
  bar([-LX, -0.66, -LZ], [-LX, -0.66, LZ]);
  bar([LX, -0.66, -LZ], [LX, -0.66, LZ]);
  bar([-LX, -0.78, LZ], [LX, -0.78, LZ]);
  bar([-LX, -0.78, -LZ], [LX, -0.78, -LZ]);

  const seat = panelPatch([-LX, SEAT, -LZ], [2 * LX, 0, 0], [0, 0, 2 * LZ]);
  const back = panelPatch([-LX, 0.33, -LZ], [2 * LX, 0, 0], [0, 0.63, 0]);

  return fillCloud([
    { patches: bars, col: 0 },
    { patches: [seat, back], col: 1, share: panels }
  ], N, 0xc4a12b);
}

const cache = memo(4);
function geom(N, panels) {
  return cache(N + '/' + panels, () => build(N, panels));
}

const COLORS = ['#f4f7fc', '#b07c4e'];

export default {
  id: 'chair',
  name: 'chair',
  palette: 'dark',
  mirrors: true,
  blurb: 'A wooden chair with every frame member drawn as a chunky bar of white speckle, and the seat ' +
         'and back filled with sparse dim dots. No occlusion: the far legs come through the near ones, ' +
         'so nothing in the picture says which pair is in front.',
  tryThis: 'Decide the seat is tipping towards you and hold it there. Then decide you are looking at the ' +
           'back of the chair instead. Familiar objects fight back much harder than dots do.',
  controls: [
    { key: 'period', label: 'period', min: 3, max: 16, step: 0.5, def: 7, unit: 's' },
    { key: 'tilt', label: 'tilt', min: 0, max: 40, step: 1, def: 15, unit: '°' },
    { key: 'panels', label: 'panels', min: 0, max: 0.6, step: 0.02, def: 0.22 },
    { key: 'dots', label: 'dots', min: 2000, max: 20000, step: 500, def: 9000 }
  ],
  draw(ctx, phase, p, cue, opts) {
    const detail = (opts && opts.detail) || 1;
    const N = Math.max(1500, Math.round(p.dots * (detail < 1 ? 0.4 : 1)));
    const cl = geom(N, p.panels);
    const mirror = !!(opts && opts.mirror);
    const m = pose(p.tilt, phase * TAU, mirror);
    const name = palName(this, opts);
    drawCloud(ctx, cl, m, cue, {
      fill: 0.42, size: 1.35, alpha: 0.7, mirror: mirror,
      colors: adapt(COLORS, name), blend: PALETTES[name].blend
    });
  }
};
