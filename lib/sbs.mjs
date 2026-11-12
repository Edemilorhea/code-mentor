import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Pure row model for diff rendering. Inlined into the HTML template via pairRows.toString(),
// so it must not reference anything outside its own body.
// mode 'sbs': one row per -/+ pair (equal heights by construction); mode 'inline': one row per line.
// Each note is placed exactly once: below its anchor row in its own column (L=old, R=new),
// or above the first row of its range when it has `to`.
export function pairRows(hunk, notes, mode) {
  const rows = [];
  const mk = (l, r) => ({ l, r, pair: null, above: { L: [], R: [] }, below: { L: [], R: [] }, inL: false, inR: false });
  const src = hunk.lines;
  let i = 0;
  while (i < src.length) {
    const x = src[i];
    if (x.t === ' ') { rows.push(mk(x, x)); i++; continue; }
    const dels = [], adds = [];
    while (i < src.length && src[i].t === '-') dels.push(src[i++]);
    while (i < src.length && src[i].t === '+') adds.push(src[i++]);
    if (mode === 'inline') {
      dels.forEach((d, k) => { const r = mk(d, null); if (adds[k]) r.pair = [d, adds[k]]; rows.push(r); });
      adds.forEach((a, k) => { const r = mk(null, a); if (dels[k]) r.pair = [dels[k], a]; rows.push(r); });
    } else {
      for (let k = 0; k < Math.max(dels.length, adds.length); k++) {
        const r = mk(dels[k] || null, adds[k] || null);
        if (dels[k] && adds[k]) r.pair = [dels[k], adds[k]];
        rows.push(r);
      }
    }
  }
  const at = (r, n) => (n.side === 'old' ? !!(r.l && r.l.o === n.line) : !!(r.r && r.r.n === n.line));
  (notes || []).forEach((n) => {
    const idx = rows.findIndex((r) => at(r, n));
    if (idx < 0) return;
    const col = n.side === 'old' ? 'L' : 'R';
    if (typeof n.to === 'number' && n.to > n.line) {
      const key = col === 'L' ? 'o' : 'n', cell = col === 'L' ? 'l' : 'r';
      rows.forEach((r) => {
        const c = r[cell];
        if (c && c[key] != null && c[key] >= n.line && c[key] <= n.to) r['in' + col] = true;
      });
      rows[idx].above[col].push(n);
    } else rows[idx].below[col].push(n);
  });
  return rows;
}

// node lib/sbs.mjs --selftest
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--selftest')) {
  const ctx = (o, n) => ({ t: ' ', o, n, s: 'c' });
  const del = (o) => ({ t: '-', o, n: null, s: 'd' });
  const add = (n) => ({ t: '+', o: null, n, s: 'a' });
  const count = (rows) => rows.reduce((a, r) => a + ['above', 'below'].reduce((b, k) => b + r[k].L.length + r[k].R.length, 0), 0);

  // 1. context-line note appears exactly once (both modes)
  const h1 = { lines: [ctx(70, 79), ctx(71, 80)] };
  const n1 = { hunk: 'f1#1', line: 79, side: 'new', text: 'x' };
  for (const mode of ['sbs', 'inline']) {
    const rows = pairRows(h1, [n1], mode);
    assert.equal(count(rows), 1, mode);
    assert.equal(rows[0].below.R.length, 1);
    assert.equal(rows[0].below.L.length, 0);
  }
  const rowsOld = pairRows(h1, [{ line: 70, side: 'old', text: 'y' }], 'sbs');
  assert.equal(count(rowsOld), 1);
  assert.equal(rowsOld[0].below.L.length, 1);

  // 2. new-side note inside an unequal run: right column only, pairing not shifted
  const h2 = { lines: [ctx(83, 97), ...[84, 85, 86, 87].map(del), ...Array.from({ length: 11 }, (_, k) => add(98 + k)), ctx(88, 109)] };
  const n2 = { line: 100, side: 'new', text: 'z' };
  const plain = pairRows(h2, [], 'sbs');
  const withNote = pairRows(h2, [n2], 'sbs');
  assert.equal(withNote.length, plain.length);
  assert.equal(withNote.length, 1 + 11 + 1);
  withNote.forEach((r, k) => { assert.equal(r.l, plain[k].l); assert.equal(r.r, plain[k].r); });
  const hit = withNote.findIndex((r) => r.below.R.length);
  assert.equal(withNote[hit].r.n, 100);
  assert.equal(withNote[hit].below.L.length, 0);
  assert.equal(count(withNote), 1);
  assert.equal(withNote[5].l, null); // rows past the 4 deletions have an empty left filler

  // 3. old- and new-side notes on the same row share that one row
  const both = pairRows(h2, [{ line: 85, side: 'old', text: 'a' }, { line: 99, side: 'new', text: 'b' }], 'sbs');
  const row = both.find((r) => r.l && r.l.o === 85);
  assert.equal(row.r.n, 99);
  assert.equal(row.below.L.length, 1);
  assert.equal(row.below.R.length, 1);
  assert.equal(count(both), 2);

  // 4. range note: header above first row of its side, tint on covered rows only
  const rg = pairRows(h2, [{ line: 99, to: 101, side: 'new', text: 'r' }], 'sbs');
  assert.equal(rg.filter((r) => r.above.R.length).length, 1);
  assert.equal(rg.filter((r) => r.inR).length, 3);
  assert.equal(rg.filter((r) => r.inL).length, 0);
  console.log('sbs selftest ok');
}
