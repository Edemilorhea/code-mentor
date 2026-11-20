import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Pure row model for diff rendering. Inlined into the HTML template via pairRows.toString(),
// so it must not reference anything outside its own body.
// mode 'sbs': one row per -/+ pair (equal heights by construction); mode 'inline': one row per line.
// Each note is placed exactly once: below its anchor row in its own column (L=old, R=new),
// or above the first row of its range when it has `to`.
// Format-only lines (l.f, set by markFormat) pair among themselves and give rows with fmt = true,
// so a reformatted line never sits next to an unrelated one and the page can fold those rows.
export function pairRows(hunk, notes, mode) {
  const rows = [];
  const mk = (l, r, fmt) => ({ l, r, pair: null, fmt, above: { L: [], R: [] }, below: { L: [], R: [] }, inL: false, inR: false });
  const src = hunk.lines;
  let i = 0;
  while (i < src.length) {
    const x = src[i];
    if (x.t === ' ') { rows.push(mk(x, x, false)); i++; continue; }
    const allDels = [], allAdds = [];
    while (i < src.length && src[i].t === '-') allDels.push(src[i++]);
    while (i < src.length && src[i].t === '+') allAdds.push(src[i++]);
    // split each side into runs of format-only / real lines, then pair runs of the same kind in order;
    // a run without a partner of its kind goes alone, real lines first. Line order on each side never changes.
    const runs = (ls) => ls.reduce((o, l) => { const f = !!l.f, last = o[o.length - 1]; if (last && last.f === f) last.ls.push(l); else o.push({ f, ls: [l] }); return o; }, []);
    const D = runs(allDels), A = runs(allAdds);
    let a = 0, b = 0;
    while (a < D.length || b < A.length) {
      const x = D[a], y = A[b];
      let dels = [], adds = [], fmt;
      if (x && y && x.f === y.f) { dels = x.ls; adds = y.ls; fmt = x.f; a++; b++; } else if (x && (!y || !x.f)) { dels = x.ls; fmt = x.f; a++; } else { adds = y.ls; fmt = y.f; b++; }
      if (mode === 'inline') {
        dels.forEach((d, k) => { const r = mk(d, null, fmt); if (adds[k]) r.pair = [d, adds[k]]; rows.push(r); });
        adds.forEach((n, k) => { const r = mk(null, n, fmt); if (dels[k]) r.pair = [dels[k], n]; rows.push(r); });
      } else {
        for (let k = 0; k < Math.max(dels.length, adds.length); k++) {
          const r = mk(dels[k] || null, adds[k] || null, fmt);
          if (dels[k] && adds[k]) r.pair = [dels[k], adds[k]];
          rows.push(r);
        }
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

// Marks the lines of a hunk whose change is formatting only (l.f = true) and returns how many it marked.
// Formatting = line breaks, indentation and other whitespace outside strings, ' against " around a string,
// a comma before a closing bracket, and a trailing , or ; at the end of the change.
// It compares one change group (a run of -/+ lines) at a time, and marks the first of these that holds:
// both sides are equal after normalization; one whole side equals a leading or trailing run of the other
// (reformat plus real lines); with the same number of lines on both sides, each pair that is equal.
// Pure and inlined into the page like pairRows. Do not call it for indentation-sensitive files.
// quotes: true when ' and " mean the same in this language (JS, TS, CSS). In C# or Java 'a' is a char, so pass false.
export function markFormat(lines, quotes) {
  const W = /[\w$\u0080-\uffff]/;
  // lines -> per line: whitespace outside strings becomes \u0001; with `quotes`, both string quotes become ".
  // Inside a string , and ; become \u0002 and \u0003, so the rules in fin never touch string content.
  // A template literal can span lines: its line break stays as \n.
  const scan = (ls) => {
    let q = '';
    return ls.map((l) => {
      const s = l.s, same = () => quotes && q !== '`';
      let out = '';
      if (q !== '`') q = '';
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q) {
          if (c === '\\' && i + 1 < s.length) { const n = s[++i]; out += same() && (n === "'" || n === '"') ? n : c + n; } else if (c === q) { out += same() ? '"' : c; q = ''; } else out += c === ',' ? '\u0002' : c === ';' ? '\u0003' : c;
        } else if (c === "'" || c === '"' || c === '`') { q = c; out += same() ? '"' : c; } else out += /\s/.test(c) ? '\u0001' : c;
      }
      return q === '`' ? out + '\n' : out;
    });
  };
  // joined lines -> keep one space between two word characters and between two equal operator characters
  // (+ +, - -, / /, & &), drop the other whitespace, drop , before ) ] }, ; before }, and a trailing , or ;
  const fin = (parts) => parts.join('\u0001')
    .replace(/\u0001+/g, (m, i, all) => { const p = all[i - 1] || '', n = all[i + m.length] || ''; return (W.test(p) && W.test(n)) || (p === n && '+-*/&|<>=.:?!%^~'.includes(p) && p) ? ' ' : ''; })
    .replace(/,(?=[)\]}])|;(?=})/g, '').replace(/[,;]+$/, '');
  let marked = 0, i = 0;
  const mark = (ls) => ls.forEach((l) => { l.f = true; marked++; });
  // `whole` (normalized to `text`) against a leading or trailing run of `ls`
  const part = (whole, text, ls, src) => {
    if (!text || ls.length > 300) return false;
    for (let k = 1; k < ls.length; k++) {
      if (fin(src.slice(0, k)) === text) { mark(whole); mark(ls.slice(0, k)); return true; }
      if (fin(src.slice(k)) === text) { mark(whole); mark(ls.slice(k)); return true; }
    }
    return false;
  };
  while (i < lines.length) {
    if (lines[i].t === ' ') { i++; continue; }
    const dels = [], adds = [];
    while (i < lines.length && lines[i].t === '-') dels.push(lines[i++]);
    while (i < lines.length && lines[i].t === '+') adds.push(lines[i++]);
    const d = scan(dels), a = scan(adds), fd = fin(d), fa = fin(a);
    if (fd === fa) { mark(dels); mark(adds); } else if (!part(dels, fd, adds, a) && !part(adds, fa, dels, d) && dels.length === adds.length) {
      dels.forEach((l, k) => { if (fin([d[k]]) === fin([a[k]])) { mark([l]); mark([adds[k]]); } });
    }
  }
  return marked;
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

  // 5. markFormat: quotes, wrapping, indentation, trailing comma are formatting; anything else is not
  const grp = (olds, news) => [...olds.map((s, k) => ({ t: '-', o: k + 1, n: null, s })), ...news.map((s, k) => ({ t: '+', o: null, n: k + 1, s }))];
  const fmt = (olds, news) => markFormat(grp(olds, news), true);
  assert.equal(fmt(["code: 'A',"], ['code: "A",']), 2, 'quotes');
  assert.equal(markFormat(grp(["c = 'A';"], ['c = "A";']), false), 0, 'quotes differ where a single quote is a char');
  assert.equal(fmt(["s = 'it\\'s'"], ['s = "it\'s"']), 2, 'escaped quote');
  assert.equal(fmt(['s = "a,)"'], ['s = "a)"']), 0, 'comma inside a string is content');
  // a template literal spans lines: the space before = is formatting, the indentation of its second line is content
  const tpl = grp(['t  = `a', '  b`'], ['t = `a', 'b`']);
  markFormat(tpl, true);
  assert.deepEqual(tpl.map((l) => !!l.f), [true, false, true, false], 'indentation inside a template literal is content');
  assert.equal(fmt(['a - -b'], ['a--b']), 0, 'space between two minus signs is not formatting');
  assert.equal(fmt(['a+b'], ['a + b']), 2, 'space around an operator');
  assert.equal(fmt(['a / /x/.source'], ['a //x/.source']), 0, 'space between two slashes is not formatting');

  // 5b. same number of lines, one real change in the middle: the other pairs are marked, row order is kept
  const h5 = { lines: grp(["a: 'x',", 'b: 1,', "c: 'z',"], ['a: "x",', 'b: 2,', 'c: "z",']) };
  assert.equal(markFormat(h5.lines, true), 4);
  assert.deepEqual(pairRows(h5, [], 'sbs').map((r) => [r.l.o, r.r.n, r.fmt]), [[1, 1, true], [2, 2, false], [3, 3, true]]);
  // inline: each run shows its old line and then its new line
  assert.deepEqual(pairRows(h5, [], 'inline').map((r) => [(r.l || r.r).o || (r.l || r.r).n, r.fmt]), [[1, true], [1, true], [2, false], [2, false], [3, true], [3, true]]);
  // 5c. real lines before the reformatted one: the real run goes first
  const h5c = { lines: grp(["f('a')"], ['x = 1', 'f("a")']) };
  assert.equal(markFormat(h5c.lines, true), 2);
  assert.deepEqual(pairRows(h5c, [], 'sbs').map((r) => [r.l && r.l.o, r.r && r.r.n, r.fmt]), [[null, 1, false], [1, 2, true]]);
  assert.equal(fmt(['\tf(a, b);'], ['    f(', '        a,', '        b,', '    );']), 5, 'wrap + indent + trailing comma');
  assert.equal(fmt(['  })'], ['  }),']), 2, 'trailing comma at the end');
  assert.equal(fmt([], ['']), 1, 'blank line alone');
  assert.equal(fmt([], ['', 'x = 1']), 0, 'blank line next to a real addition stays');
  assert.equal(fmt(['a b'], ['ab']), 0, 'space between two words is not formatting');
  assert.equal(fmt(['s = "a b"'], ['s = "ab"']), 0, 'whitespace inside a string is not formatting');
  assert.equal(fmt(['f(a, b)'], ['f(ab)']), 0, 'comma between arguments is not formatting');
  assert.equal(fmt(['x = 1'], ['x = 2']), 0, 'value change');

  // 6. reformat plus appended lines: only the reformatted part is marked, and its rows come first with fmt = true
  const h6 = { lines: grp(['E: lazy(() => imp("p").then(({ A }) => ({ default: A }))),'], ['E: lazy(() =>', '    imp("p").then(({ A }) => ({', '        default: A,', '    }))', '),', '},', '{', '    code: "B",']) };
  assert.equal(markFormat(h6.lines, true), 6);
  for (const mode of ['sbs', 'inline']) {
    const r6 = pairRows(h6, [], mode);
    const firstReal = r6.findIndex((r) => !r.fmt);
    assert.ok(firstReal > 0 && r6.slice(firstReal).every((r) => !r.fmt), mode + ': format rows first');
    assert.equal(r6.slice(firstReal).length, 3, mode + ': three real rows');
    assert.ok(r6.slice(firstReal).every((r) => !r.l), mode + ': real rows are pure additions');
  }
  console.log('sbs selftest ok');
}
