// palette.js — three global looks, and one height ramp.
//
// `dark` is the look of the loops this site is copying: dots on true black,
// drawn additively so that wherever the projection piles them up the colour
// runs hot and the silhouette lights itself. `paper` is black ink on
// off-white, for the coil. `mono` throws all the colour away, which is the
// honest control: if a loop only reads because of its colours, mono will say
// so.
//
// A NOTE ON THE HEIGHT RAMP, because it is the one place this site could
// cheat without noticing. The ramp is applied to the dot's height ON THE
// SCREEN — a function of the projected image and nothing else. The two
// readings of an ambiguous loop produce the same projected image, so they
// produce the same colours, pixel for pixel. Colour by *depth* would be a
// real cue and would end the illusion; colour by screen height is a gradient
// painted over the picture, and carries exactly as much information about
// rotation direction as a coloured filter taped to your monitor: none.

const RAMP_STOPS = [
  [0.00, '#fdf4cc'],
  [0.20, '#f6de95'],
  [0.38, '#efc067'],
  [0.47, '#e88a3c'],
  [0.53, '#dc4426'],
  [0.58, '#ae3068'],
  [0.64, '#4a37c6'],
  [0.72, '#3550dc'],
  [1.00, '#2a44c8']
];

function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb2hex(c) {
  return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function buildRamp(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    let k = 0;
    while (k < RAMP_STOPS.length - 2 && RAMP_STOPS[k + 1][0] < t) k++;
    const [t0, c0] = RAMP_STOPS[k], [t1, c1] = RAMP_STOPS[k + 1];
    const w = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
    const a = hex2rgb(c0), b = hex2rgb(c1);
    out.push(rgb2hex([a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w]));
  }
  return out;
}

// 24 buckets: enough that the gradient looks continuous at dot scale, few
// enough that a whole frame is two dozen fills.
export const RAMP = buildRamp(24);

export const PALETTES = {
  dark:  { bg: '#000000', ink: '#e9f0fa', blend: 'lighter',     dim: '#7f8a9b' },
  paper: { bg: '#f4f1e8', ink: '#141410', blend: 'source-over', dim: '#6b675c' },
  mono:  { bg: '#08090f', ink: '#e9f0fa', blend: 'lighter',     dim: '#7f8a9b' }
};

export const PALETTE_NAMES = ['dark', 'paper', 'mono'];

export function palName(stim, opts) {
  const o = opts && opts.palette;
  if (o && PALETTES[o]) return o;
  return (stim && stim.palette) || 'dark';
}

export function pal(stim, opts) { return PALETTES[palName(stim, opts)]; }

export function bgOf(stim, opts) { return pal(stim, opts).bg; }

// Take a stimulus's own colour list and bend it to the chosen palette:
// `dark` leaves it alone, `mono` collapses it to the ink colour, `paper`
// darkens every colour so it reads as ink on the light ground.
export function adapt(colors, name) {
  if (name === 'mono') return colors.map(() => PALETTES.mono.ink);
  if (name === 'paper') {
    return colors.map(c => {
      const [r, g, b] = hex2rgb(c);
      const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // keep a trace of the hue, pull the value right down
      const k = 0.16 + 0.30 * (1 - L);
      return rgb2hex([r * k * 0.9, g * k * 0.9, b * k * 0.9]);
    });
  }
  return colors;
}
