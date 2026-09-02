// modes.js — free / drill / feed.
//
// Direction convention used everywhere: -1 means you currently see the TOP of
// the object moving leftward (counter-clockwise seen from above); +1 means the
// top is moving rightward (clockwise from above). Keys are the arrow keys, and
// on the canvas the left half is -1 and the right half is +1.

export const LEFT = -1, RIGHT = 1;
export const COL = { '-1': '#6fd8f0', '1': '#f0b878' };
export const ARROW = { '-1': '←', '1': '→' };

// --- free ------------------------------------------------------------------
export function createFree(onChange) {
  let segs = [];        // {dir, t0, t1}
  let cur = null;
  return {
    get segments() { return segs; },
    get current() { return cur; },
    reset() { segs = []; cur = null; onChange && onChange(); },
    press(dir, now) {
      if (cur && cur.dir === dir) return false;
      if (cur) cur.t1 = now;
      cur = { dir: dir, t0: now, t1: now };
      segs.push(cur);
      if (segs.length > 400) segs.shift();
      onChange && onChange();
      return true;
    },
    tick(now) { if (cur) cur.t1 = now; },
    summary() {
      const holds = segs.map(s => s.t1 - s.t0).filter(d => d > 0);
      const flips = Math.max(0, segs.length - 1);
      const total = holds.reduce((a, b) => a + b, 0);
      // the segment still running is not a completed hold
      const done = holds.slice(0, Math.max(0, holds.length - 1));
      const mean = done.length ? done.reduce((a, b) => a + b, 0) / done.length : null;
      return { flips: flips, meanHold: mean, total: total, n: segs.length };
    },
    // rolling window strip: the last `windowMs` of reported percept
    drawStrip(ctx, now, windowMs) {
      const w = ctx.canvas.width, h = ctx.canvas.height;
      const win = windowMs || 90000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#101018';
      ctx.fillRect(0, 0, w, h);
      const t1 = Math.max(now, win);
      const t0 = t1 - win;
      for (const s of segs) {
        const a = Math.max(s.t0, t0), b = Math.min(s.t1, t1);
        if (b <= a) continue;
        const x = (a - t0) / win * w, ww = Math.max(1, (b - a) / win * w);
        ctx.fillStyle = COL[s.dir];
        ctx.fillRect(x, 0, ww, h);
      }
      // gridlines every 10 s
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      for (let t = 0; t <= win; t += 10000) ctx.fillRect(Math.round(t / win * w), 0, 1, h);
    }
  };
}

// --- drill -----------------------------------------------------------------
// phases: idle -> countdown -> gap -> target -> (repeat) -> done
export function createDrill(rounds, onState) {
  let phase = 'idle';
  let until = 0, shownAt = 0, target = 0, round = 0;
  let results = [];
  let nextGap = 0;

  function gap(now) {
    phase = 'gap';
    nextGap = 2000 + Math.random() * 4000;
    until = now + nextGap;
    onState && onState(api);
  }
  function show(now) {
    phase = 'target';
    target = target === LEFT ? RIGHT : LEFT;
    shownAt = now;
    onState && onState(api);
  }

  const api = {
    get phase() { return phase; },
    get target() { return target; },
    get round() { return round; },
    get rounds() { return rounds; },
    get results() { return results; },
    get countdown() { return Math.max(0, Math.ceil((until - api._now) / 1000)); },
    _now: 0,
    start(now) {
      results = []; round = 0;
      target = Math.random() < 0.5 ? LEFT : RIGHT;  // first show() flips this
      phase = 'countdown';
      until = now + 3000;
      onState && onState(api);
    },
    abort() { phase = 'idle'; onState && onState(api); },
    tick(now) {
      api._now = now;
      if (phase === 'countdown' && now >= until) { round = 1; show(now); }
      else if (phase === 'gap' && now >= until) { round += 1; show(now); }
    },
    press(dir, now) {
      if (phase !== 'target') return false;
      const latency = now - shownAt;
      results.push({ target: target, pressed: dir, latency: latency, miss: dir !== target });
      if (round >= rounds) { phase = 'done'; onState && onState(api); }
      else gap(now);
      return true;
    },
    summary() {
      const hits = results.filter(r => !r.miss).map(r => r.latency);
      const s = hits.slice().sort((a, b) => a - b);
      const med = s.length ? (s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2) : null;
      return {
        n: results.length,
        median: med,
        best: s.length ? s[0] : null,
        misses: results.filter(r => r.miss).length
      };
    }
  };
  return api;
}

// --- feed ------------------------------------------------------------------
export function createFeed(ids, dwellMs, onSwitch) {
  let i = 0, until = 0;
  return {
    get index() { return i; },
    get id() { return ids[i]; },
    remaining(now) { return Math.max(0, until - now); },
    start(now) { i = 0; until = now + dwellMs; onSwitch && onSwitch(ids[i], i); },
    tick(now) {
      if (now >= until) { i = (i + 1) % ids.length; until = now + dwellMs; onSwitch && onSwitch(ids[i], i); }
    },
    next(now) { i = (i + 1) % ids.length; until = now + dwellMs; onSwitch && onSwitch(ids[i], i); }
  };
}
