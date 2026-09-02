import { TAU, drawCloud } from '../lib/render.js';
import { pose, fillCloud, memo } from '../lib/cloud.js';
import { palName, PALETTES } from '../lib/palette.js';

// A helix, drawn as if with a fat grainy marker: dense particles jittered
// inside a small tube around the centreline, black on off-white. This is the
// one that goes round on TikTok with "are you able to reverse the spin with
// your mind?" written over it, and it is the hardest of the figurative set,
// because a coil has a handedness and your visual system has opinions about
// which way a spring is wound.
//
// Worth saying plainly: a helix is chiral, so unlike the chair or the arrow
// its depth-mirror is NOT the same object — it is the opposite-handed coil.
// The two readings are "a right-handed coil turning this way" and "a
// left-handed coil turning that way", and both are perfectly ordinary springs.
// The picture still cannot tell them apart; it just cannot tell you which
// spring you are looking at either.

const R = 1, H = 2.9;

function build(N, turns, thick) {
  const path = (u, out) => {
    const a = u * turns * TAU;
    out[0] = R * Math.cos(a);
    out[1] = (u - 0.5) * H;
    out[2] = R * Math.sin(a);
  };
  return fillCloud([{ curve: path, weight: 1, jitter: thick, col: 0 }], N, 0x0c01ed);
}

const cache = memo(4);
function geom(N, turns, thick) {
  return cache(N + '/' + turns + '/' + thick, () => build(N, turns, thick));
}

export default {
  id: 'coil',
  name: 'coil',
  palette: 'paper',
  mirrors: true,
  blurb: 'A drawn spring: eight turns of a helix laid down as a fat grainy stroke of black particles ' +
         'on paper, leaning a little towards you so the loops project as open ellipses rather than ' +
         'flat lines. Every loop crosses every other one and none of them is in front.',
  tryThis: 'Take the topmost ellipse on its own and decide the near half is the lower edge. Then the ' +
           'upper. Whichever you choose, the rest of the spring falls into line under it.',
  controls: [
    { key: 'period', label: 'period', min: 3, max: 16, step: 0.5, def: 7, unit: 's' },
    { key: 'tilt', label: 'tilt', min: 4, max: 40, step: 1, def: 15, unit: '°' },
    { key: 'turns', label: 'turns', min: 4, max: 12, step: 0.2, def: 7.6 },
    { key: 'thick', label: 'stroke', min: 0.015, max: 0.09, step: 0.005, def: 0.038 },
    { key: 'dots', label: 'dots', min: 3000, max: 30000, step: 500, def: 16000 }
  ],
  draw(ctx, phase, p, cue, opts) {
    const detail = (opts && opts.detail) || 1;
    const N = Math.max(2500, Math.round(p.dots * (detail < 1 ? 0.35 : 1)));
    const cl = geom(N, p.turns, p.thick);
    const mirror = !!(opts && opts.mirror);
    const m = pose(p.tilt, phase * TAU, mirror);
    const name = palName(this, opts);
    const P = PALETTES[name];
    drawCloud(ctx, cl, m, cue, {
      fill: 0.31, size: 2.6, alpha: 0.85, mirror: mirror,
      colors: [P.ink], blend: P.blend
    });
  }
};
