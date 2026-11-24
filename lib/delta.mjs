// Re-collect support: what changed since the previous diff.json, and moving guide.json's references to the new diff.
import { markFormat } from './sbs.mjs';

// Same lists as templates/js-diff.js: languages where whitespace outside strings has no meaning.
const FMT_Q = /\.(m?[jt]sx?|cjs|mts|cts|css|scss|less)$/i, FMT_N = /\.(cs|java|kt|go|rs|c|h|cc|cpp|hpp|swift|php|jsonc?)$/i;

const body = (f) => JSON.stringify(f.hunks.map((h) => h.lines.map((l) => l.t + l.s)));
// changed lines without the format-only ones; null when the file type is not scanned
function core(f) {
  if (f.generated || f.binary || !(FMT_Q.test(f.path) || FMT_N.test(f.path))) return null;
  const hs = f.hunks.map((h) => h.lines.map((l) => ({ t: l.t, s: l.s })));
  hs.forEach((ls) => markFormat(ls, FMT_Q.test(f.path)));
  return JSON.stringify(hs.map((ls) => ls.filter((l) => l.t !== ' ' && !l.f).map((l) => l.t + l.s)));
}
// per old hunk: its old/new line ranges and how far each side moved
const shifts = (o, f) => o.hunks.map((h, k) => {
  const no = h.lines.filter((l) => l.t !== '+').length, nn = h.lines.filter((l) => l.t !== '-').length;
  return { k: k + 1, o: [h.oldStart, h.oldStart + no], n: [h.newStart, h.newStart + nn], dO: f.hunks[k].oldStart - h.oldStart, dN: f.hunks[k].newStart - h.newStart };
});

// Files matched by path (fNN is only a position). Lists:
// moved: same lines, only line numbers differ (rebase, base change): references are shifted automatically.
// format: the difference is format-only lines. changed: real content differs. removed / added: by path.
export function diffDelta(prev, next) {
  const old = new Map(prev.files.map((f) => [f.path, f]));
  const now = new Set(next.files.map((f) => f.path));
  const d = { added: [], changed: [], format: [], moved: [], removed: [], map: {} };
  for (const f of next.files) {
    const o = old.get(f.path);
    if (!o) { d.added.push(f.path); continue; }
    d.map[o.id] = { id: f.id };
    if (body(o) === body(f)) {
      if (o.hunks.some((h, k) => h.header !== f.hunks[k].header)) { d.moved.push(f.path); d.map[o.id].shift = shifts(o, f); }
      continue;
    }
    const c = core(o);
    (c !== null && c === core(f) ? d.format : d.changed).push(f.path);
  }
  for (const o of prev.files) if (!now.has(o.path)) { d.removed.push(o.path); d.map[o.id] = { gone: true }; }
  return d;
}

// Moves a line number by the hunk that holds it (hunk k when given, else the first hunk whose range holds it).
function shiftLine(sh, k, side, line) {
  const r = side === 'old' ? 'o' : 'n', dk = side === 'old' ? 'dO' : 'dN';
  const h = sh.find((x) => (k ? x.k === k : line >= x[r][0] && line < x[r][1]));
  return h ? line + h[dk] : line;
}

// Rewrites the references in guide.json: "fN", "fN#k", "fN:line", "fN#k:line" (hunks, hunk, see, mapping from/to,
// skipHunks), plus note/step line and to when the file only moved. Text, titles and station ids are never touched.
// Changed file: only the id moves; a stale #k or line makes check fail, which marks the station to rewrite.
// Removed file: "gone:<old ref>", which check reports as unknown. Returns how many values changed.
export function remapGuide(guide, map) {
  let moved = 0;
  const RE = /^(f\d+)(#(\d+))?(?::(\d+))?$/;
  const fix = (s) => {
    const m = RE.exec(s); if (!m || !map[m[1]]) return s;
    const t = map[m[1]];
    const line = m[4] && t.shift ? shiftLine(t.shift, m[3] && +m[3], 'new', +m[4]) : m[4];
    const r = t.gone ? 'gone:' + s : t.id + (m[2] || '') + (m[4] ? ':' + line : '');
    if (r !== s) moved++;
    return r;
  };
  // file / ref: spines[].steps[], example[], failure[]
  const REF = new Set(['hunks', 'hunk', 'see', 'from', 'to', 'skipHunks', 'file', 'ref']);
  const walk = (v) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    // a note or logic step on a file that only moved: shift line / to before the hunk id is renamed
    if (typeof v.hunk === 'string' && typeof v.line === 'number') {
      const m = RE.exec(v.hunk), t = m && map[m[1]];
      if (t?.shift) {
        const k = m[3] && +m[3];
        const nl = shiftLine(t.shift, k, v.side, v.line);
        if (typeof v.to === 'number') v.to = shiftLine(t.shift, k, v.side, v.to);
        if (nl !== v.line) { v.line = nl; moved++; }
      }
    }
    for (const k of Object.keys(v)) {
      if (!REF.has(k)) walk(v[k]);
      else if (typeof v[k] === 'string') v[k] = fix(v[k]);
      else if (Array.isArray(v[k])) v[k] = v[k].map((x) => (typeof x === 'string' ? fix(x) : x));
    }
  };
  walk(guide);
  return moved;
}
