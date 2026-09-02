import { TAU, drawCloud } from '../lib/render.js';
import { pose, surfaceArea, fillCloud, memo } from '../lib/cloud.js';
import { RAMP, adapt, palName, PALETTES } from '../lib/palette.js';

// The loop everybody has already seen: a refresh arrow — a ribbon bent into
// most of a ring, with a flat chevron head in the ribbon's own surface —
// turning about the ring's axis, which is tipped about twenty degrees towards
// you so you are looking at it slightly from above.
//
// It is drawn as a few thousand tiny dots scattered over the ribbon's surface,
// same size, no occlusion, additive. Two things come out of that for free and
// neither is faked:
//
//   * at the far left and right of the ellipse the ribbon is edge-on, so a
//     whole arc of it projects into a couple of pixels and runs hot;
//   * the near and far halves of the band separate into two arcs with a hole
//     of black between them, because the band is short compared with the
//     ellipse's minor axis.
//
// The colour is a gradient in SCREEN height — gold at the top of the picture
// through orange to blue at the bottom. That is a function of the projected
// image, so both readings of the loop are painted identically and the
// ambiguity is untouched. Colour by depth would have ended it.

function build(p, N) {
  const R = 1;
  const hb = p.band / 2;                 // half the band's height
  const th = 0.019;                      // half the ribbon's radial thickness
  const Hh = p.head / 2;                 // half the chevron's height at its back
  const arc = p.arc * Math.PI / 180;
  const headArc = Math.min(arc * 0.45, p.headArc * Math.PI / 180);
  const bandArc = arc - headArc;
  const t0 = -arc / 2;                   // so the gap sits opposite the middle
  const th0 = t0 + bandArc;              // where the chevron starts

  // the ribbon runs in the x-z plane; the band's height is along y, which is
  // the rotation axis, so the silhouette of the ring never changes. The angle
  // is negated so the head leads clockwise seen from above, the way round the
  // loop this is copied from goes.
  const at = (a, y, r, out) => { out[0] = r * Math.cos(-a); out[1] = y; out[2] = r * Math.sin(-a); };

  const bandFace = (r) => surfaceArea((u, v, out) => at(t0 + u * bandArc, (v * 2 - 1) * hb, r, out), 120, 6);
  const bandRim = (sy) => surfaceArea((u, v, out) => at(t0 + u * bandArc, sy * hb, R + (v * 2 - 1) * th, out), 120, 3);
  const tailCap = surfaceArea((u, v, out) => at(t0, (u * 2 - 1) * hb, R + (v * 2 - 1) * th, out), 6, 3);

  // the chevron: half-height falls linearly from Hh at the back to nothing at
  // the tip, i.e. a plain triangle with a straight back edge, standing proud
  // of the band above and below.
  const headFace = (r) => surfaceArea((u, a, out) => {
    at(th0 + u * headArc, (a * 2 - 1) * (1 - u) * Hh, r, out);
  }, 48, 24);
  // and its thin rim, which is what draws the crisp outline of the head
  const headRim = (s, out) => {
    let u, b;
    if (s < 1 / 3) { u = 0; b = -1 + s * 6; }
    else if (s < 2 / 3) { const q = (s - 1 / 3) * 3; u = q; b = 1 - q; }
    else { const q = (s - 2 / 3) * 3; u = 1 - q; b = -q; }
    at(th0 + u * headArc, b * (1 - u) * Hh, R, out);
  };

  return fillCloud([
    { patches: [bandFace(R + th), bandFace(R - th)] },
    { patches: [bandRim(1), bandRim(-1), tailCap] },
    { patches: [headFace(R + th), headFace(R - th)] },
    { curve: headRim, weight: 0.20, jitter: th }
  ], N, 0xa11c0f);
}

const cache = memo(4);
function geom(p, N) {
  return cache([p.arc, p.band, p.head, p.headArc, N].join('/'), () => build(p, N));
}

export default {
  id: 'ring-arrow',
  name: 'ring arrow',
  palette: 'dark',
  mirrors: true,
  blurb: 'A refresh arrow: a ribbon bent into three hundred degrees of a ring with a flat chevron head, ' +
         'turning about its own axis, which leans about twenty degrees towards you. Nothing is drawn but ' +
         'a few thousand identical dots scattered over its surface — the bright rims at the left and right ' +
         'are just the places where a whole arc of ribbon lands edge-on and the dots pile up.',
  tryThis: 'Watch the head and decide it is passing along the far side of the ring, above the middle. ' +
           'Then decide the same head is coming towards you along the near side. The picture does not change.',
  controls: [
    { key: 'period', label: 'period', min: 3, max: 16, step: 0.5, def: 8, unit: 's' },
    { key: 'tilt', label: 'tilt', min: 0, max: 40, step: 1, def: 18, unit: '°' },
    { key: 'arc', label: 'arc', min: 200, max: 340, step: 5, def: 305, unit: '°' },
    { key: 'band', label: 'band', min: 0.14, max: 0.5, step: 0.01, def: 0.36 },
    { key: 'head', label: 'head', min: 0.3, max: 1.0, step: 0.02, def: 0.58 },
    { key: 'headArc', label: 'point', min: 25, max: 75, step: 1, def: 48, unit: '°' },
    { key: 'dots', label: 'dots', min: 2000, max: 20000, step: 500, def: 10000 }
  ],
  draw(ctx, phase, p, cue, opts) {
    const detail = (opts && opts.detail) || 1;
    const N = Math.max(1200, Math.round(p.dots * (detail < 1 ? 0.4 : 1)));
    const cl = geom(p, N);
    const mirror = !!(opts && opts.mirror);
    const m = pose(p.tilt, phase * TAU, mirror);
    const name = palName(this, opts);
    const t = p.tilt * Math.PI / 180;
    const hi = Math.sin(t) + Math.cos(t) * (p.band / 2);
    drawCloud(ctx, cl, m, cue, {
      fill: 0.56, size: 1.4, alpha: 0.78, mirror: mirror,
      colors: adapt(RAMP, name), blend: PALETTES[name].blend,
      ramp: { top: hi, bot: -hi }
    });
  }
};
