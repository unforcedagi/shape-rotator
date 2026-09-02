import { TAU, makeRng, spinM, rotateAll, drawDots } from '../lib/render.js';

let cache = null;
function points(n, h) {
  if (cache && cache.n === n && cache.h === h) return cache.pts;
  const rnd = makeRng(0xc71cf0 ^ n);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const y = (rnd() * 2 - 1) * h;
    pts.push([Math.cos(a), y, Math.sin(a)]);
  }
  cache = { n, h, pts, buf: pts.map(() => [0, 0, 0]) };
  return pts;
}

export default {
  id: 'cylinder',
  name: 'cylinder',
  blurb: 'The laboratory standard: dots on the surface of a transparent cylinder spinning about its ' +
         'own vertical axis. In projection the dots sweep left and right in a band, and each dot is ' +
         'either on the near wall or the far wall — the image never says which.',
  tryThis: 'Watch the dots at the very edges, where they slow down and turn around. Decide the ones ' +
           'crossing the middle fastest are the near ones; then decide they are the far ones.',
  controls: [
    { key: 'n', label: 'dots', min: 40, max: 600, step: 10, def: 180 },
    { key: 'period', label: 'period', min: 3, max: 12, step: 0.5, def: 6, unit: 's' },
    { key: 'h', label: 'height', min: 0.4, max: 1.1, step: 0.05, def: 0.8 },
    { key: 'r', label: 'dot', min: 1, max: 4, step: 0.25, def: 2 }
  ],
  mirrors: true,
  draw(ctx, phase, p, cue, opts) {
    const mirror = !!(opts && opts.mirror);
    const pts = points(Math.round(p.n), p.h);
    const m = spinM(0, 'xy', phase * TAU, mirror);
    const rot = rotateAll(pts, m, cache.buf, mirror);
    drawDots(ctx, rot, cue, { radius: p.r, fill: 0.40 });
  }
};
