import { TAU, drawCloud } from '../lib/render.js';
import { pose, cloud, rng, memo } from '../lib/cloud.js';
import { adapt, palName, PALETTES } from '../lib/palette.js';

// A sphere covered in bright green dots, each one drawn as a short streak
// along the direction it is actually moving on the screen. The outline never
// changes — it is a circle whatever the sphere does — so the only thing in the
// picture is the flow, and the flow is the same flow either way round.
//
// The streaks are worth being careful about, because a length that varied with
// depth would be a cue. It does not: the streak is drawn along the point's
// SCREEN velocity, which is a property of the projected motion. Work it
// through and the mirrored sphere turning the other way gives, for every dot,
// exactly the same screen velocity vector. So the streaks are the same
// streaks, to the bit — they are motion blur, not a depth cue.

function build(n) {
  const rnd = rng(0x5eed77 ^ n);
  const cl = cloud(n);
  for (let i = 0; i < n; i++) {
    const y = rnd() * 2 - 1;
    const a = rnd() * TAU;
    const r = Math.sqrt(1 - y * y);
    cl.xyz[i * 3] = r * Math.cos(a);
    cl.xyz[i * 3 + 1] = y;
    cl.xyz[i * 3 + 2] = r * Math.sin(a);
    cl.col[i] = (rnd() < 0.30) ? 1 : 0;
  }
  return cl;
}

const cache = memo(4);
function geom(n) { return cache(String(n), () => build(n)); }

const COLORS = ['#2fe070', '#9ff5b8'];

export default {
  id: 'orb',
  name: 'orb',
  palette: 'dark',
  mirrors: true,
  blurb: 'A sphere of bright green dots, each smeared into a short streak along the way it is moving ' +
         'on the screen. The silhouette is a circle and stays a circle, so there is nothing to read ' +
         'but the flow — and the flow is identical whichever way you decide the sphere is turning.',
  tryThis: 'Look at the middle, where the streaks are longest. Those dots are either racing across ' +
           'the front or across the back. Choose, and the whole ball turns to match.',
  controls: [
    { key: 'period', label: 'period', min: 3, max: 14, step: 0.5, def: 6, unit: 's' },
    { key: 'tilt', label: 'tilt', min: 0, max: 40, step: 1, def: 8, unit: '°' },
    { key: 'dots', label: 'dots', min: 2000, max: 20000, step: 500, def: 7000 },
    { key: 'streak', label: 'streak', min: 0, max: 0.06, step: 0.002, def: 0.026 }
  ],
  draw(ctx, phase, p, cue, opts) {
    const detail = (opts && opts.detail) || 1;
    const cl = geom(Math.max(1500, Math.round(p.dots * (detail < 1 ? 0.4 : 1))));
    const mirror = !!(opts && opts.mirror);
    const m = pose(p.tilt, phase * TAU, mirror);
    const name = palName(this, opts);
    const t = p.tilt * Math.PI / 180;
    // the axis the object is actually turning about, and which way round
    const axis = [0, Math.cos(t), (mirror ? -1 : 1) * Math.sin(t)];
    drawCloud(ctx, cl, m, cue, {
      fill: 0.42, size: 1.35, alpha: 0.55, mirror: mirror,
      colors: adapt(COLORS, name), blend: PALETTES[name].blend,
      streak: p.streak, axis: axis, dir: mirror ? -1 : 1
    });
  }
};
