import { TAU, drawDots } from '../lib/render.js';

const buf = [];

export default {
  id: 'ring',
  name: 'ring',
  blurb: 'Dots running round a single circular track that is tilted away from you, so it projects to ' +
         'an ellipse. Nothing distinguishes the near arc from the far one: the same picture is a hoop ' +
         'tipped towards you with the dots going one way, or tipped away with them going the other.',
  tryThis: 'Look at the top of the ellipse. Call it the near edge, and the dots there run one way; ' +
           'call it the far edge and the same dots run the other. Cover the bottom half if it sticks.',
  controls: [
    { key: 'n', label: 'dots', min: 12, max: 60, step: 1, def: 32 },
    { key: 'period', label: 'period', min: 3, max: 12, step: 0.5, def: 5, unit: 's' },
    { key: 'tilt', label: 'tilt', min: 10, max: 85, step: 1, def: 60, unit: '°' },
    { key: 'r', label: 'dot', min: 1, max: 5, step: 0.25, def: 2.5 }
  ],
  mirrors: true,
  draw(ctx, phase, p, cue, opts) {
    // the ring's rotation is a phase advance along its own circle, so its
    // depth-mirrored twin turning the other way is just the same circle with z
    // negated at the same phase
    const mz = (opts && opts.mirror) ? -1 : 1;
    const n = Math.round(p.n);
    const t = p.tilt * Math.PI / 180;
    const st = Math.sin(t), ct = Math.cos(t);
    buf.length = n;
    for (let i = 0; i < n; i++) {
      const a = (i / n + phase) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      // ring in the horizontal plane, then tipped about the screen-x axis
      buf[i] = [ca * 0.96, -sa * st * 0.96, mz * sa * ct * 0.96];
    }
    drawDots(ctx, buf, cue, { radius: p.r, fill: 0.42 });
  }
};
