# Reverse Reverse

**the shape rotator test — can you see it both ways?**

Live: <https://reversereverse.app> (also <https://unforcedagi.github.io/shape-rotator/>)

A dozen-odd looping animations that are *genuinely* ambiguous about which way
they are turning, plus a place to practise steering the percept on purpose: a
cue dial that puts the depth information back so you can see the true
direction, a fade button that takes it away again over eight seconds, and a
timed drill.

No framework, no bundler, no npm dependency at runtime. Plain HTML, ES modules
and canvas 2D. No analytics, no accounts, no network calls; the only state that
survives a reload is a single `localStorage` key you can delete from the app
page.

---

## Why the illusions actually work

Structure-from-motion is ambiguous when — and only when — the image carries no
depth information. Then a shape `S` rotating about the vertical axis at `+ω`
and the depth-mirrored shape `D·S` (every `z` negated) rotating at `−ω` project
to **pixel-identical** images, forever, because orthographic projection `P`
drops `z` and therefore `P·D = P`. That is an exact algebraic degeneracy, not a
near miss. There is nothing in the picture to be right about.

So the renderer is deliberately impoverished. The rules, all in
[`lib/render.js`](lib/render.js):

* **Orthographic projection.** `(x, y, z) → (x, y)`. No perspective divide.
* **Uniform dots.** At `cue = 0` every dot has the same radius and the same
  alpha, and the cloud is drawn as one fill per colour bucket, so there is no
  per-dot size or brightness that could leak depth.
* **Uniform wires.** One path, one `lineWidth`, one stroke.
* **True silhouettes.** The solid meshes are drawn as the nonzero-winding
  *union* of every triangle, filled flat. No outline, no interior edge, no
  shading, no z-sort (with one flat colour the sort order is unobservable).
* **No occlusion, no fog, no shadow.**

The `cue` dial in `[0, 1]` adds real depth information back in proportion to
`cue`, and every term is written so that `cue = 0` is exactly its identity:

| cue term | formula | at `cue = 0` |
|---|---|---|
| perspective | `s = 1 / (1 − cue·k·z)`, `k = 0.42` | `s = 1` |
| dot size | `r = r₀·(1 + cue·z·0.48)` | `r = r₀` |
| brightness | `a = 1 − cue·0.58·(1 − z)/2` | `a = 1` |
| wire | width and alpha vary with segment mean `z` | flat |
| mesh | flat lambert mixed in by `cue`, back faces culled | flat fill |

### Seamless loops

Every stimulus is a pure function of `phase ∈ [0, 1)`. Nothing accumulates a
delta; the app computes `phase = (t / period + PHASE0) mod 1`. So the frame at
phase 0 is *byte-identical* to the frame at phase 1 and a recording of one
period joins to itself with no seam. This is checked, not asserted — the
Playwright pass screenshots each stimulus at phase 0 and phase 1 and compares
the PNG buffers.

---

## Dot clouds, and the colour rule

The figurative loops are not filled solids. Each one is a few thousand tiny
dots sampled **uniformly by area** over the object's surface
([`lib/cloud.js`](lib/cloud.js)), drawn at one size with no occlusion and no
z-sort, additively on black. Two things then happen without being asked for:

* where the surface turns edge-on to you, a whole band of it projects into a
  couple of pixels and the dots stack, so the silhouette lights its own rim;
* where the surface faces you the dots spread out and it goes dim.

That is the entire shading model. It is also why the rims in the ring arrow run
hot orange at the left and right of the ellipse: those are places in the
*picture* where dots pile up, not places in the object.

**Colour never encodes depth.** Two rules are allowed and both are safe:

1. **Colour attached to the object** — the tetrahedron's pink corner is pink in
   both readings, so the mirrored solid paints the same pixels.
2. **Colour as a function of the projected image** — the ring arrow's gold →
   orange → blue ramp is keyed to a dot's height *on the screen*. Both readings
   put the dot at the same place on the screen, so both get the same colour. It
   is a gradient painted over the picture and it carries no more information
   about rotation direction than a coloured filter on your monitor.

Colouring by `z` would have been a real depth cue and would have ended the
illusion. It is not used anywhere.

Three palettes — `dark` (the default), `paper` (ink on off-white, used by the
coil), `mono` (all colour thrown away, which is the honest control) — live in
[`lib/palette.js`](lib/palette.js) and can be forced site-wide with `?p=mono`.

## The set

The figurative ones first, then the seven laboratory stimuli in order of how
easily they flip.

| id | what it is |
|---|---|
| `ring-arrow` | A refresh arrow: a ribbon bent into 305° of a ring with a flat chevron head, spinning about the ring's own axis, which leans ~16° towards you. The landing loop. |
| `chair` | A wooden chair, every member a chunky bar of white speckle. The mirror of a chair is still a chair facing the other way — recognisable objects are stickier, which is the point. |
| `tetra` | Regular tetrahedron on the axis through its apex: coloured edges, a lattice of pale dots on each face, nothing filled. |
| `banana` | A curved tapered tube on end, turning about its long axis: crescent, straight bar, crescent. |
| `arrow` | Solid arrow, square shaft and pyramid head. An arrow is mirror-symmetric about its own vertical plane, so its depth-mirror is *the same arrow*. |
| `sphere` | Random dots uniform on a sphere (`y ~ U(−1,1)`, azimuth uniform). The lab classic. |
| `cylinder` | Dots on a transparent cylinder — the Treue / Bradley standard. |
| `cube` | Necker cube in motion, twelve equal edges, axis tilted ~20° so faces cross. |
| `lissajous` | Closed 3D Lissajous curve as one uniform wire; reverses at the crossings. |
| `ring` | 12–60 dots running round one tilted circular track. |
| `silhouette` | Lathe-turned vessel with a spout, filled flat on paper-white. The spinning-dancer principle. |
| `dual-axis` | Tennis-ball-seam curve on an axis that leans out of the screen. See the caveat below. |

### Honest caveat on `dual-axis`

This is **not** a reproduction of Frank Force's 2019 *Dual Axis Illusion*, in
which one loop reads as spinning about a vertical axis and about a horizontal
one. It is shipped as a tilted-axis knot, and the dual-axis read is a stretch
goal that was not reached. Why the obvious constructions do not get there:

* The depth-mirror of a rotation about the vertical axis is a rotation about
  the *same* axis, reversed: `D·Ry(φ)·D⁻¹ = Ry(−φ)`. Making the shape special
  does not change that, so both percepts share an axis.
* Conjugating to a horizontal axis costs an image-plane rotation:
  `P·Rx(−φ)·M·S = Rot2D(90°)·[P·Ry(φ)·Rz(−90°)M·S]`. The two animations are
  the same up to a 90° turn of the *picture*, which is not the same picture.
* A second genuine axis therefore needs the curve's projected point set to admit
  a *reparametrised* second rigid solution — the correspondence between frames
  is free for an unlabelled curve in a way it is not for labelled dots. I did
  not find such a curve inside the time budget.

What is shipped is still worth having. The curve
`x = A cos u + B cos 3u, y = A sin u − B sin 3u, z = C sin 2u`
has an S4 rotary-reflection symmetry about its own `z` axis: `u → u + π/2`
gives exactly `(−y, x, −z)`. So its depth-mirror is the same curve turned a
quarter turn — when your percept flips, the object does not become a different
object. With the rotation axis leaned into depth the two readings are "an axis
tilted towards me" and "an axis tilted away", which is a real second axis, just
not the famous one.

---

## Layout

```
index.html            landing: the nine cards with live mini previews,
                      modes, techniques, essay, references
app.html?s=arrow&mode=free    the practice app (state in the query string)
stimuli/*.js          one module per stimulus + index.js registry
lib/render.js         projection, rotation, the cue dial, the primitives
lib/cloud.js          area-weighted surface sampling, the pose matrix, the
                      tube / bar / panel builders the figurative set is made of
lib/palette.js        the three palettes and the screen-height colour ramp
lib/mesh.js           box / pyramid / bake helpers for the solid stimuli
lib/modes.js          free / drill / feed logic
lib/stats.js          the one localStorage key
```

## Modes

* **free** — watch, and press `←` / `→` (or tap the left / right half of the
  canvas) every time what you see changes. The strip under the canvas draws
  your reported percept over a 90 s window, with flip count and mean hold.
  `space` pauses, `f` fades the cue.
* **drill** — 3-2-1, then a big arrow appears after a random 2–6 s gap. Flip
  your percept to match it and press that key. Ten rounds; median latency,
  best, misses, and a per-stimulus history in `localStorage`.
* **feed** — the whole set, fifteen seconds each, no controls. The arrow keys
  still record.

`prefers-reduced-motion: reduce` stops everything and shows a notice with a
"play anyway" button, on both pages.

---

## Adding a stimulus

Write `stimuli/<id>.js` with a default export:

```js
export default {
  id: 'thing',
  name: 'thing',
  blurb: 'Two or three sentences on what the loop is.',
  tryThis: 'One sentence on what to try.',
  bg: '#0b0b10',                 // optional: own canvas background
  controls: [                    // each becomes a slider
    { key: 'period', label: 'period', min: 3, max: 12, step: 0.5, def: 6, unit: 's' }
  ],
  draw(ctx, phase, p, cue, opts) { /* ... */ }
};
```

Then add it to `stimuli/index.js`. Rules the rest of the site relies on:

1. `draw` must be a pure function of `phase` — same phase, same pixels. Cache
   any generated geometry keyed on the structural params.
2. `period` must be one of your controls; the app reads it to set the loop.
3. At `cue = 0` use the flat path of whichever primitive you draw with
   (`drawDots`, `drawWire`, `drawSegments`, `drawMesh` — they all branch on
   `cue <= 0` and emit a single uniform fill or stroke). If you add depth
   information at `cue = 0` you have broken the site's one promise.
4. `opts.detail` (0–1) is passed by the landing-page previews; use it to build
   a cheaper mesh or a smaller cloud if yours is expensive.
5. `opts.palette` may name a palette to force; `opts.mirror` asks for the
   depth-mirrored object turning the other way. Build the pose with
   `pose(tilt, angle, mirror)` from `lib/cloud.js` and hand `mirror` on to the
   drawing primitive, and the two come out pixel-identical for free.

## Verifying

```sh
python3 -m http.server 8731
node pw/shots.js          # screenshots + loop-identity + console check
```

## References

* Wallach, H. & O'Connell, D. N. (1953). *The kinetic depth effect.* J. Exp.
  Psychol. 45(4), 205–217.
* Treue, S., Husain, M. & Andersen, R. A. (1991). *Human perception of
  structure from motion.* Vision Research 31(1), 59–75.
* Kayahara, N. (2003). *The spinning dancer.*
* Force, F. (2019). *Dual Axis Illusion*, Best Illusion of the Year Contest —
  <https://illusionoftheyear.com/2019/12/dual-axis-illusion/>
* Bach, M. *Structure-from-motion / kinetic depth effect* —
  <https://michaelbach.de/ot/mot-sfm/>
* Pastukhov, A., Vonau, V., Stonkute, S. & Braun, J. (2012). *The role of
  attention in ambiguous reversals of structure-from-motion.* PLOS ONE 7(6):
  e37734 —
  <https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0037734>

Same family as <https://unforcedagi.github.io/sketches/>.
