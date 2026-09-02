// stats.js — everything the site remembers, kept in this browser only.
// No accounts, no server, no analytics. One localStorage key, and a button
// on the app page that deletes it.

const KEY = 'shape-rotator/v1';
let mem = null;          // fallback when localStorage is unavailable

function blank() { return { drill: {}, free: {} }; }

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const o = JSON.parse(raw);
    return (o && typeof o === 'object') ? Object.assign(blank(), o) : blank();
  } catch (e) {
    return mem || blank();
  }
}

function write(o) {
  mem = o;
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* private mode: keep in memory */ }
}

export function all() { return read(); }

export function clearAll() {
  mem = blank();
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

export function median(xs) {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// --- drill -----------------------------------------------------------------
export function recordDrillSet(stimId, set) {
  const o = read();
  const list = o.drill[stimId] || (o.drill[stimId] = []);
  list.push(set);
  if (list.length > 50) list.splice(0, list.length - 50);
  write(o);
  return list;
}

export function drillHistory(stimId) { return read().drill[stimId] || []; }

export function drillBest(stimId) {
  const h = drillHistory(stimId).map(s => s.best).filter(x => typeof x === 'number');
  return h.length ? Math.min.apply(null, h) : null;
}

// --- free ------------------------------------------------------------------
export function recordFree(stimId, rec) {
  const o = read();
  const cur = o.free[stimId] || { seconds: 0, flips: 0, sessions: 0 };
  cur.seconds += rec.seconds || 0;
  cur.flips += rec.flips || 0;
  cur.sessions += 1;
  o.free[stimId] = cur;
  write(o);
  return cur;
}

export function freeTotals(stimId) {
  return read().free[stimId] || { seconds: 0, flips: 0, sessions: 0 };
}

export function fmtMs(ms) {
  if (ms == null) return '—';
  return (ms / 1000).toFixed(2) + 's';
}
