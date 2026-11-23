// ---- persisted view state ----
function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage may be blocked */ } }
// tb: floating toolbar labels, 'full' text or 'compact' symbols
var VIEW = { mode: lsGet('dg.mode', 'inline') === 'sbs' ? 'sbs' : 'inline', full: false, hideFmt: lsGet('dg.hidefmt', '') === '1', tb: lsGet('dg.tb', '') === 'compact' ? 'compact' : 'full' };
(function () {
  var w = parseFloat(lsGet('dg.w', '')), s = parseFloat(lsGet('dg.split', ''));
  if (w >= 640) document.documentElement.style.setProperty('--diff-width', w + 'px');
  setSplit(s >= 0.2 && s <= 0.8 ? s : 0.5, false);
})();
// ---- sidebar + theme toggles (saved per browser) ----
(function () {
  var root = document.documentElement;
  var sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  // icons: sidebar with an arrow pointing where it will go (close = left, open = right); the theme button shows the theme it switches to
  var svg = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; };
  var PANEL = '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>';
  var ICON = {
    close: svg(PANEL + '<path d="M16 9l-3 3 3 3"/>'), open: svg(PANEL + '<path d="M13 9l3 3-3 3"/>'),
    moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')
  };
  function label(b, icon, text) { b.innerHTML = icon; b.title = text; b.setAttribute('aria-label', text); }
  function apply() {
    var theme = lsGet('dg.theme', sys) === 'light' ? 'light' : 'dark', off = lsGet('dg.toc', '') === 'off';
    root.dataset.theme = theme; root.classList.toggle('toc-off', off);
    var b = document.querySelector('[data-ui=theme]'); if (b) label(b, theme === 'light' ? ICON.moon : ICON.sun, theme === 'light' ? '切換成深色' : '切換成淺色');
    b = document.querySelector('[data-ui=toc]'); if (b) label(b, off ? ICON.open : ICON.close, off ? '顯示側欄' : '收合側欄');
  }
  apply();
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-ui]'); if (!t) return;
    var u = t.dataset.ui;
    if (u === 'theme') lsSet('dg.theme', root.dataset.theme === 'light' ? 'dark' : 'light');
    else if (u === 'toc') lsSet('dg.toc', root.classList.contains('toc-off') ? '' : 'off');
    else return;
    apply();
  });
})();
function setSplit(s, save) {
  var st = document.documentElement.style;
  st.setProperty('--split-n', String(s)); st.setProperty('--split', (s * 100) + '%');
  if (save) lsSet('dg.split', String(s));
}

var files = D.files, byId = {}, byPath = {}, hunkById = {};
files.forEach(function (f) { byId[f.id] = f; byPath[f.path] = f; f.hunks.forEach(function (x) { hunkById[x.id] = [f, x]; }); });
function resolve(ref) {
  if (hunkById[ref]) return { file: hunkById[ref][0], hunk: hunkById[ref][1] };
  var f = byId[ref] || byPath[ref]; return f ? { file: f } : null;
}
// ---- format-only changes: marked once per page load (markFormat, lib/sbs.mjs), removed from view when VIEW.hideFmt ----
// Only languages where whitespace outside strings has no meaning. FMT_Q: ' and " are the same string quote.
var FMT_Q = /\.(m?[jt]sx?|cjs|mts|cts|css|scss|less)$/i, FMT_N = /\.(cs|java|kt|go|rs|c|h|cc|cpp|hpp|swift|php|jsonc?)$/i;
var FMT_TOTAL = 0;
files.forEach(function (f) {
  f._fmt = 0;
  if (f.generated || f.binary || !(FMT_Q.test(f.path) || FMT_N.test(f.path))) return;
  f.hunks.forEach(function (x) { f._fmt += markFormat(x.lines, FMT_Q.test(f.path)); });
  FMT_TOTAL += f._fmt;
});
var KL = { why: '為什麼', good: '好處', risk: '風險', bug: '問題', info: '說明', what: '改了什麼', how: '怎麼改', syntax: '語法／用法' };

// ---- notes ----
function seeLabel(see) {
  var p = String(see).split(':'), r = resolve(p[0]);
  return (r ? r.file.path.slice(r.file.path.lastIndexOf('/') + 1) : p[0]) + ' L' + (p[1] || '');
}
function noteBlock(n) {
  var range = typeof n.to === 'number' && n.to > n.line ? '<b>' + (n.side === 'old' ? '舊 ' : '') + 'L' + n.line + '–L' + n.to + '</b> ' : '';
  var k = KL[n.kind] ? n.kind : 'info';
  var rl = 'L' + n.line + (typeof n.to === 'number' && n.to > n.line ? '–' + n.to : '') + (n.side === 'old' ? '（舊）' : '');
  return '<div class="nb nk-' + k + (n.tier === 'detail' ? ' tier-d' : '') + '"><div class="nk">' + (n.step ? '<span class="badge">' + h(n.step) + '</span>' : '') + range + h(KL[k]) + (n.tier === 'detail' ? '<span class="td">細部</span>' : '')
    + '<button type="button" class="nq" data-q="' + h(rl) + '" title="複製一段文字，貼回對話，請 AI 重寫這則說明">看不懂</button></div>' + md(n.text)
    + (n.see ? '<a class="xref" href="javascript:void 0" data-see="' + h(n.see) + '">→ ' + h(seeLabel(n.see)) + '</a>' : '') + '</div>';
}
function noteRowInline(list) {
  return list.length ? '<tr class="nrow"><td colspan="4" class="nt">' + list.map(noteBlock).join('') + '</td></tr>' : '';
}
function noteRowSbs(L, R) {
  if (!L.length && !R.length) return '';
  return '<tr class="nrow"><td colspan="2" class="nt' + (L.length ? '' : ' f') + '">' + L.map(noteBlock).join('') + '</td><td colspan="2" class="nt' + (R.length ? '' : ' f') + '">' + R.map(noteBlock).join('') + '</td></tr>';
}

// ---- rows ----
function cellCode(l, lang, mask, wcls) { return codeHtml(l.s, lang, mask, wcls); }
function wrapCls(l) { return l && l.s.length > 400 ? ' wrap' : ''; }
function pairMasks(r) {
  if (!r.pair) return null;
  if (r.pair._m === undefined) r.pair._m = wordDiff(r.pair[0].s, r.pair[1].s);
  return r.pair._m;
}
function rowInline(r, lang) {
  var x = r.l || r.r, m = pairMasks(r), cls = x.t === '+' ? 'a' : x.t === '-' ? 'd' : '';
  var mask = m ? (x.t === '-' ? m[0] : m[1]) : null, tint = (r.inL || r.inR) ? ' rg' : '';
  return '<tr class="' + cls + '" data-o="' + (x.o == null ? '' : x.o) + '" data-n="' + (x.n == null ? '' : x.n) + '"><td class="no">' + (x.o == null ? '' : x.o) + '</td><td class="no">' + (x.n == null ? '' : x.n)
    + '</td><td class="sg">' + (x.t === ' ' ? '' : x.t) + '</td><td class="code' + tint + wrapCls(x) + '"><span class="sx">' + cellCode(x, lang, mask, x.t === '-' ? 'wd' : 'wa') + '</span></td></tr>';
}
function rowSbs(r, lang) {
  var m = pairMasks(r), out = '<tr>';
  if (r.l) {
    var lc = r.l.t === '-' ? 'd' : '';
    out += '<td class="no ' + lc + '">' + r.l.o + '</td><td class="m ' + lc + (r.inL ? ' rg' : '') + wrapCls(r.l) + '" data-o="' + r.l.o + '"><span class="sx">' + cellCode(r.l, lang, m && r.l.t === '-' ? m[0] : null, 'wd') + '</span></td>';
  } else out += '<td class="no e"></td><td class="m e"></td>';
  if (r.r) {
    var rc = r.r.t === '+' ? 'a' : '';
    out += '<td class="no ' + rc + '">' + r.r.n + '</td><td class="m ' + rc + (r.inR ? ' rg' : '') + wrapCls(r.r) + '" data-n="' + r.r.n + '"><span class="sx">' + cellCode(r.r, lang, m && r.r.t === '+' ? m[1] : null, 'wa') + '</span></td>';
  } else out += '<td class="no e"></td><td class="m e"></td>';
  return out + '</tr>';
}
function hunkNoteFilter(ns, f, hk) { return ns.filter(function (n) { return n.hunk === hk.id || n.hunk === f.id || n.hunk === f.path; }); }
// ---- focus view: keep only rows near annotated lines, fold the rest ----
var CTX = 3;
function hasLineNotes(ns) { return ns.some(function (n) { return typeof n.line === 'number'; }); }
function coreRanges(ns) {
  var s = { o: [], n: [] };
  ns.forEach(function (n) {
    if (typeof n.line !== 'number') return;
    var end = typeof n.to === 'number' && n.to > n.line ? n.to : n.line;
    (n.side === 'old' ? s.o : s.n).push([n.line - CTX, end + CTX]);
  });
  return s;
}
function inRanges(v, rs) { if (v == null) return false; for (var i = 0; i < rs.length; i++) if (v >= rs[i][0] && v <= rs[i][1]) return true; return false; }
function rowKept(r, cr) {
  if (r.above.L.length || r.above.R.length || r.below.L.length || r.below.R.length) return true;
  return inRanges(r.l && r.l.o, cr.o) || inRanges(r.r && r.r.n, cr.n);
}
function hasNote(r) { return !!(r.above.L.length || r.above.R.length || r.below.L.length || r.below.R.length); }
// a format-only row can be hidden unless a note sits on it or covers it
function fmtRow(r) { return r.fmt && !r.inL && !r.inR && !hasNote(r); }
// b: block (for unfolded state); focus: fold rows outside annotated ranges;
// hideFmt: remove format-only rows, and the whole hunk (header included) when nothing else is left to read
function hunkHtml(f, hk, ns, mode, lang, b, focus, hideFmt) {
  var rows = pairRows(hk, ns, mode), o = ['<tr class="h"><td colspan="4">' + h(hk.header) + '</td></tr>'];
  if (hideFmt) {
    rows = rows.filter(function (r) { return !fmtRow(r); });
    if (!rows.some(function (r) { return r.l !== r.r || hasNote(r); })) return '';
  }
  var cr = focus ? coreRanges(ns) : null, i = 0;
  function emit(r) {
    o.push(mode === 'sbs' ? noteRowSbs(r.above.L, r.above.R) : noteRowInline(r.above.L.concat(r.above.R)));
    o.push(mode === 'sbs' ? rowSbs(r, lang) : rowInline(r, lang));
    o.push(mode === 'sbs' ? noteRowSbs(r.below.L, r.below.R) : noteRowInline(r.below.L.concat(r.below.R)));
  }
  while (i < rows.length) {
    if (!cr || rowKept(rows[i], cr)) { emit(rows[i++]); continue; }
    var j = i; while (j < rows.length && !rowKept(rows[j], cr)) j++;
    var key = hk.id + ':' + i;
    if (b._unfold[key]) { o.push('<tr class="gap"><td colspan="4"><button type="button" class="un" data-refold="' + h(key) + '">⋮ 收合這 ' + (j - i) + ' 行</button></td></tr>'); rows.slice(i, j).forEach(emit); }
    else o.push('<tr class="gap"><td colspan="4"><button type="button" data-fold="' + h(key) + '">⋯ 略過 ' + (j - i) + ' 行（不在註解範圍），點開</button></td></tr>');
    i = j;
  }
  return o.join('');
}

// ---- expandable context (needs file.content = full new file) ----
var STEP = 20;
function counts(hk) {
  var no = 0, nn = 0; hk.lines.forEach(function (l) { if (l.t !== '+') no++; if (l.t !== '-') nn++; });
  return { o: no, n: nn };
}
function effStart(hk) { var c = counts(hk); return { o: c.o ? hk.oldStart : hk.oldStart + 1, n: c.n ? hk.newStart : hk.newStart + 1 }; }
function effEnd(hk) { var c = counts(hk); return { o: c.o ? hk.oldStart + c.o - 1 : hk.oldStart, n: c.n ? hk.newStart + c.n - 1 : hk.newStart }; }
function gapInfo(f, hs, i) {
  if (!f.content || f.status === 'added' || !hs.length) return null;
  var start, end, off;
  if (i === 0) { start = 1; var s0 = effStart(hs[0]); end = s0.n - 1; off = s0.n - s0.o; }
  else if (i === hs.length) { var e = effEnd(hs[i - 1]); start = e.n + 1; end = f.content.length; off = e.n - e.o; }
  else { var a = effEnd(hs[i - 1]), b = effStart(hs[i]); start = a.n + 1; end = b.n - 1; off = b.n - b.o; }
  if (end < start) return null;
  return { start: start, end: end, off: off, hasPrev: i > 0, hasNext: i < hs.length };
}
function ctxLine(g, n, f) { return { t: ' ', o: n - g.off, n: n, s: f.content[n - 1] == null ? '' : f.content[n - 1] }; }
function ctxRows(g, from, to, f, mode, lang) {
  var o = [];
  for (var n = from; n <= to; n++) { var x = ctxLine(g, n, f), r = { l: x, r: x, pair: null, inL: false, inR: false }; o.push(mode === 'sbs' ? rowSbs(r, lang) : rowInline(r, lang)); }
  return o.join('');
}
function gapHtml(b, f, g, i, mode, lang) {
  var st = (b._gaps[i] = b._gaps[i] || { t: 0, b: 0 }), total = g.end - g.start + 1, hidden = total - st.t - st.b, o = [];
  if (st.t) o.push(ctxRows(g, g.start, g.start + st.t - 1, f, mode, lang));
  if (hidden > 0 || st.t || st.b) {
    var btn = '', bt = function (act, txt, cls) { return '<button type="button"' + (cls ? ' class="' + cls + '"' : '') + ' data-gap="' + i + '" data-act="' + act + '">' + txt + '</button>'; };
    if (hidden > 0) {
      if (g.hasPrev) btn += bt('down', '↓ 展開 ' + Math.min(STEP, hidden) + ' 行');
      if (g.hasNext) btn += bt('up', '↑ 展開 ' + Math.min(STEP, hidden) + ' 行');
      btn += bt('all', '展開全部 ' + hidden + ' 行');
    }
    if (st.t > 0) btn += bt('undown', '↑ 收合 ' + Math.min(STEP, st.t) + ' 行', 'un');
    if (st.b > 0) btn += bt('unup', '↓ 收合 ' + Math.min(STEP, st.b) + ' 行', 'un');
    if (st.t + st.b > 0) btn += bt('none', '收合全部 ' + (st.t + st.b) + ' 行', 'un');
    o.push('<tr class="gap"><td colspan="4">' + btn + '</td></tr>');
  }
  if (st.b) o.push(ctxRows(g, g.end - st.b + 1, g.end, f, mode, lang));
  return o.join('');
}
function gapClick(b, btn) {
  var i = +btn.dataset.gap, f = byId[b.dataset.file], hs = f.hunks, g = gapInfo(f, hs, i);
  if (!g) return;
  var st = b._gaps[i] = b._gaps[i] || { t: 0, b: 0 }, hidden = Math.max(0, g.end - g.start + 1 - st.t - st.b), act = btn.dataset.act;
  if (act === 'all') st.t += hidden;
  else if (act === 'down') st.t += Math.min(STEP, hidden);
  else if (act === 'up') st.b += Math.min(STEP, hidden);
  else if (act === 'undown') st.t = Math.max(0, st.t - STEP);
  else if (act === 'unup') st.b = Math.max(0, st.b - STEP);
  else if (act === 'none') { st.t = 0; st.b = 0; }
  else return;
  fillBlock(b, true);
}

// ---- block ----
function modeOf(b) { return b._ov || VIEW.mode; }
// long lines: side-by-side wraps by default (like GitLab), single column scrolls; the toolbar overrides per block
function wrapOf(b) { return b._wrap != null ? b._wrap : modeOf(b) === 'sbs'; }
function fullOf(b) { return b._fv != null ? b._fv : VIEW.full; }
function fvLabel(b) {
  var f = byId[b.dataset.file];
  return fullOf(b) ? '只看重點' : '看完整檔案' + (f.content || f.status === 'added' ? '' : '（僅 diff）');
}
function fillBlock(b, force) {
  var mode = modeOf(b), full = fullOf(b), key = mode + (full ? ':full' : '') + (VIEW.hideFmt ? ':nofmt' : '') + ':' + (typeof LAYER === 'string' ? LAYER : '');
  if (!force && b.dataset.done === '1' && b.dataset.rmode === key) return;
  var f = byId[b.dataset.file], hk = b.dataset.hunk && !full ? hunkById[b.dataset.hunk][1] : null, hs = hk ? [hk] : f.hunks, lang = langOf(f.path), ns = b._notes || [], body = '';
  // a station's notes may target other files: only this file's own line notes switch on focus mode
  var focus = !full && hasLineNotes(ns.filter(function (n) { var hb = hunkById[n.hunk]; return n.hunk === f.id || n.hunk === f.path || (hb && hb[0] === f); }));
  if (!hs.length) body = '<tr class="h"><td colspan="4">' + (f.binary ? '二進位檔' : '沒有內容變更（僅改名或權限）') + '</td></tr>';
  else {
    // full: whole file (all hunks + every gap line); focus: annotated rows only, no gap bars
    var whole = !hk && !focus;
    var gap = function (i) {
      var g = gapInfo(f, hs, i); if (!g) return '';
      return full ? ctxRows(g, g.start, g.end, f, mode, lang) : gapHtml(b, f, g, i, mode, lang);
    };
    hs.forEach(function (x, i) {
      if (whole) body += gap(i);
      // the whole-file view shows every line of the file, so it never hides format-only rows
      body += hunkHtml(f, x, hunkNoteFilter(ns, f, x), mode, lang, b, focus, !full && VIEW.hideFmt);
    });
    if (whole) body += gap(hs.length);
  }
  var cg = mode === 'sbs' ? '<colgroup><col style="width:52px"><col class="cm"><col style="width:52px"><col></colgroup>' : '<colgroup><col style="width:52px"><col style="width:52px"><col style="width:20px"><col></colgroup>';
  var bd = b.querySelector('.bd');
  bd.innerHTML = '<table class="df ' + mode + '">' + cg + body + '</table>' + (mode === 'sbs' ? '<div class="sph" title="拖曳調整左右欄寬，雙擊還原"></div>' : '')
    + '<div class="sxb ' + mode + '"><div class="sxl"><i></i></div>' + (mode === 'sbs' ? '<div class="sxr"><i></i></div>' : '') + '</div>';
  b.dataset.done = '1'; b.dataset.rmode = key; b.classList.toggle('wrapall', wrapOf(b));
  b.style.removeProperty('--sxl'); b.style.removeProperty('--sxr');
  sxWatch(b, bd.firstChild);
  var tg = b.querySelector('.tg');
  tg.textContent = '顯示：' + (mode === 'sbs' ? '並排' : '單欄');
  b.querySelector('.fv').textContent = fvLabel(b);
}
// ---- no-wrap long lines: code cells clip; each code column (one in single column, left + right side by side) gets its own
// scrollbar, stuck above the screen bottom, that shifts that column's text sideways (--sxl / --sxr on the block) ----
var SX = [['.sxl', 'td.code,td.m[data-o]', '--sxl'], ['.sxr', 'td.m[data-n]', '--sxr']];
function sxFit(b) {
  var bd = b.querySelector('.bd'), bar = bd && bd.querySelector('.sxb'); if (!bar) return;
  if (b.dataset.open !== '1' || b.classList.contains('wrapall')) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  var br = bd.getBoundingClientRect(), any = false;
  SX.forEach(function (s) {
    var sc = bar.querySelector(s[0]); if (!sc) return;
    var cells = bd.querySelectorAll(s[1]), w = 0, ref = null;
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].classList.contains('wrap')) continue; // >400-char lines always wrap
      ref = ref || cells[i];
      var x = cells[i].firstChild; if (x && x.offsetWidth > w) w = x.offsetWidth;
    }
    var over = !!ref && w + 16 > ref.clientWidth + 1;
    sc.style.display = over ? '' : 'none'; any = any || over;
    if (over) { var r = ref.getBoundingClientRect(); sc.style.left = (r.left - br.left) + 'px'; sc.style.width = r.width + 'px'; sc.firstChild.style.width = (w + 16) + 'px'; }
    b.style.setProperty(s[2], over ? -sc.scrollLeft + 'px' : '0px');
  });
  if (!any) bar.style.display = 'none';
}
// re-fit when the column widths change (window, diff width, split drag) or the text size changes
function sxWatch(b, tbl) {
  if (!('ResizeObserver' in window)) { sxFit(b); return; }
  b._sxo = b._sxo || new ResizeObserver(function () { sxFit(b); });
  b._sxo.disconnect(); b._sxo.observe(tbl);
  SX.forEach(function (s) { var c = tbl.querySelector(s[1]); if (c) b._sxo.observe(c); });
}
var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
  es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); if (e.target.dataset.open === '1') fillBlock(e.target); } });
}, { rootMargin: '600px' }) : null;
var BLOCKS = [];
// per-file code font size (px) set from the toolbar; survives re-render/route changes, not page reload
var FS = {};
// page-wide sizes from the settings panel: CODEFS = default code px (a file's own size overrides it), UI = interface text scale
var CODEFS = Math.min(24, Math.max(10, parseInt(lsGet('dg.codefs', ''), 10) || 14));
var UI = Math.min(1.4, Math.max(0.9, parseFloat(lsGet('dg.ui', '')) || 1));
function applySizes() { var st = document.documentElement.style; st.setProperty('--fs-code', CODEFS + 'px'); st.setProperty('--ui', String(UI)); }
applySizes();
function fsOf(b) { return FS[b.dataset.file] || CODEFS; }
// all code at once: drops every per-file size so the new default applies everywhere
function setCodeFs(v) {
  CODEFS = Math.min(24, Math.max(10, v)); lsSet('dg.codefs', CODEFS === 14 ? '' : String(CODEFS));
  Object.keys(FS).forEach(function (k) { delete FS[k]; });
  BLOCKS.forEach(function (b) { b.style.removeProperty('--fs-code'); });
  applySizes(); window.dispatchEvent(new Event('resize'));
}
function setUi(v) { UI = Math.round(Math.min(1.4, Math.max(0.9, v)) * 100) / 100; lsSet('dg.ui', UI === 1 ? '' : String(UI)); applySizes(); }
function mkBlock(ref, notes, opts) {
  var r = resolve(ref); if (!r) return null;
  var f = r.file, g = (D.guideFiles || {})[f.path] || (G.files || {})[f.path] || {}, d = document.createElement('div');
  d.className = 'blk'; d.dataset.file = f.id; d.dataset.hunk = r.hunk ? r.hunk.id : ''; d._notes = notes || []; d._gaps = {}; d._ov = null; d._fv = null; d._unfold = {};
  var open = !(f.generated && !(opts && opts.forceOpen));
  d.dataset.open = open ? '1' : '0';
  var tags = (f.generated ? '<span class="flag">產生檔</span>' : '') + (f.large ? '<span class="flag">大修改</span>' : '') + (f._fmt && f._fmt === f.additions + f.deletions ? '<span class="flag">僅格式化</span>' : '');
  d.innerHTML = '<div class="fh"><span class="p">' + h(f.path) + (r.hunk ? ' <span class="st">' + h(r.hunk.id) + '</span>' : '') + '</span><span class="st">' + h(f.status) + '</span><span class="add">+' + f.additions + '</span><span class="del">−' + f.deletions + '</span>' + tags
    + '<span class="sp"></span><a href="#files/' + f.id + '" data-nohead="1">依檔案檢視</a><button type="button" class="tg"></button><button type="button" class="fv"></button><button type="button" class="fd">' + (open ? '收合' : '展開') + '</button></div>'
    + (f.generated && (g.explain || g.summary) ? '<div class="explain">' + (g.summary ? '<b>' + inl(g.summary) + '</b>' : '') + md(g.explain) + '</div>' : '')
    + '<div class="bd" style="position:relative"></div><div class="rz" title="拖曳調整所有 diff 寬度，雙擊還原"></div>';
  var fh = d.querySelector('.fh'), bd = d.querySelector('.bd'), fd = d.querySelector('.fd'), tg = d.querySelector('.tg');
  bd.style.display = open ? '' : 'none';
  tg.textContent = '顯示：' + (modeOf(d) === 'sbs' ? '並排' : '單欄');
  var fv = d.querySelector('.fv'); fv.textContent = fvLabel(d);
  // a block that gets shorter while its top is above the screen would leave the reader far below it:
  // bring its header back to the top of the screen
  function keepTop(fn) {
    fn();
    var r = d.getBoundingClientRect(), tabs = document.querySelector('.tabbar'), off = (tabs ? tabs.offsetHeight : 0) + 8;
    if (r.top < off) window.scrollBy(0, r.top - off);
  }
  d.keepTop = keepTop;
  fv.addEventListener('click', function () {
    var shrink = fullOf(d) && d.dataset.open === '1';
    d._fv = !fullOf(d); d._unfold = {};
    if (d.dataset.open !== '1') setOpen(true); else if (shrink) keepTop(function () { fillBlock(d); }); else fillBlock(d);
  });
  // lazy: hand rendering to the viewport observer (expand-all), instead of rendering now
  function setOpen(v, lazy) { d.dataset.open = v ? '1' : '0'; bd.style.display = v ? '' : 'none'; fd.textContent = v ? '收合' : '展開'; if (v) { if (lazy && io) io.observe(d); else fillBlock(d); } }
  d.setOpen = setOpen;
  fh.addEventListener('click', function (e) {
    var t = e.target; if (t.tagName === 'A' || (t.tagName === 'BUTTON' && t !== fd)) return;
    if (d.dataset.open === '1') keepTop(function () { setOpen(false); }); else setOpen(true);
  });
  tg.addEventListener('click', function () { d._ov = modeOf(d) === 'sbs' ? 'inline' : 'sbs'; if (d.dataset.open !== '1') setOpen(true); else fillBlock(d); });
  // the column scrollbars move their column's text; a sideways wheel / trackpad swipe over code drives that column's scrollbar
  bd.addEventListener('scroll', function (e) {
    var t = e.target, s = t.classList && (t.classList.contains('sxl') ? '--sxl' : t.classList.contains('sxr') ? '--sxr' : '');
    if (s) d.style.setProperty(s, -t.scrollLeft + 'px');
  }, true);
  bd.addEventListener('wheel', function (e) {
    var dx = e.deltaX || (e.shiftKey ? e.deltaY : 0), td = dx && !d.classList.contains('wrapall') && e.target.closest && e.target.closest('td.code,td.m');
    if (!td) return;
    var sc = bd.querySelector(td.hasAttribute('data-n') ? '.sxr' : '.sxl');
    if (!sc || sc.style.display === 'none' || sc.scrollWidth <= sc.clientWidth) return;
    var x0 = sc.scrollLeft; sc.scrollLeft += dx;
    if (sc.scrollLeft !== x0) e.preventDefault();
  }, { passive: false });
  bd.addEventListener('click', function (e) {
    var bt = e.target.closest && e.target.closest('button[data-gap],button[data-fold],button[data-refold]'); if (!bt) return;
    if (bt.dataset.fold) { d._unfold[bt.dataset.fold] = 1; fillBlock(d, true); }
    else if (bt.dataset.refold) { delete d._unfold[bt.dataset.refold]; fillBlock(d, true); }
    else gapClick(d, bt);
  });
  if (FS[f.id]) d.style.setProperty('--fs-code', FS[f.id] + 'px');
  applyFmtHide(d);
  if (open) { if (io) io.observe(d); else fillBlock(d); }
  BLOCKS.push(d);
  return d;
}
// Global toggle: applies to every block and clears per-block overrides.
function setGlobalMode(m) {
  VIEW.mode = m; lsSet('dg.mode', m);
  BLOCKS.forEach(function (b) { b._ov = null; if (b.isConnected && b.dataset.open === '1' && b.dataset.done === '1') fillBlock(b, true); else if (b.querySelector('.tg')) b.querySelector('.tg').textContent = '顯示：' + (m === 'sbs' ? '並排' : '單欄'); });
}
// Global focus/full: clears per-block overrides; re-renders open blocks lazily as they scroll into view.
function setGlobalFull(v) {
  VIEW.full = v;
  BLOCKS.forEach(function (b) {
    b._fv = null; b._unfold = {}; b.querySelector('.fv').textContent = fvLabel(b);
    if (b.isConnected && b.dataset.open === '1' && b.dataset.done === '1') { b.dataset.done = '0'; if (io) io.observe(b); else fillBlock(b, true); }
  });
}
// A block holds nothing but formatting: every changed line it shows is format-only and no note of the block sits in this file.
function fmtOnlyBlock(b) {
  var f = byId[b.dataset.file], hk = b.dataset.hunk ? hunkById[b.dataset.hunk][1] : null;
  if (!f._fmt) return false;
  if ((b._notes || []).some(function (n) { var hb = hunkById[n.hunk]; return n.hunk === f.id || n.hunk === f.path || (hb && hb[0] === f); })) return false;
  if (!hk) return f._fmt === f.additions + f.deletions;
  return hk.lines.every(function (l) { return l.t === ' ' || l.f; });
}
// with "hide format-only changes" on, a block that holds nothing else disappears from the page
function applyFmtHide(b) { b.style.display = VIEW.hideFmt && fmtOnlyBlock(b) ? 'none' : ''; }
// Global "hide format-only changes" checkbox (rendered in the page header only when FMT_TOTAL > 0).
function setGlobalFmt(v) {
  VIEW.hideFmt = v; lsSet('dg.hidefmt', v ? '1' : '');
  BLOCKS.forEach(function (b) {
    b._unfold = {}; applyFmtHide(b);
    if (b.isConnected && b.dataset.open === '1' && b.dataset.done === '1') { b.dataset.done = '0'; if (io) io.observe(b); else fillBlock(b, true); }
  });
}
document.addEventListener('change', function (e) { if (e.target && e.target.id === 'fmtck') setGlobalFmt(e.target.checked); });

// ---- drag: shared width, split ----
(function () {
  var docEl = document.documentElement;
  function drag(e, onMove, onEnd) {
    e.preventDefault(); var t = e.target; try { t.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    function mv(ev) { onMove(ev); }
    function up(ev) { t.removeEventListener('pointermove', mv); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', up); onEnd(ev); }
    t.addEventListener('pointermove', mv); t.addEventListener('pointerup', up); t.addEventListener('pointercancel', up);
  }
  document.addEventListener('pointerdown', function (e) {
    var rz = e.target.closest && e.target.closest('.blk>.rz');
    if (rz) {
      var blk = rz.parentNode, x0 = e.clientX, w0 = blk.getBoundingClientRect().width;
      blk.classList.add('rzing');
      drag(e, function (ev) { var w = Math.max(640, Math.min(window.innerWidth - 8, w0 + ev.clientX - x0)); docEl.style.setProperty('--diff-width', w + 'px'); },
        function () { blk.classList.remove('rzing'); lsSet('dg.w', String(parseFloat(getComputedStyle(blk).width))); });
      return;
    }
    var sp = e.target.closest && e.target.closest('.sph');
    if (sp) {
      var bd = sp.parentNode;
      drag(e, function (ev) { var rc = bd.getBoundingClientRect(); setSplit(Math.max(0.2, Math.min(0.8, (ev.clientX - rc.left - 52) / (rc.width - 104))), false); },
        function () { lsSet('dg.split', getComputedStyle(docEl).getPropertyValue('--split-n').trim()); });
    }
  });
  document.addEventListener('dblclick', function (e) {
    if (e.target.closest && e.target.closest('.blk>.rz')) { docEl.style.removeProperty('--diff-width'); lsSet('dg.w', ''); }
    else if (e.target.closest && e.target.closest('.sph')) { setSplit(0.5, true); }
  });
})();

// ---- floating toolbar: controls the block nearest the viewport's vertical center ----
(function () {
  var tb = document.getElementById('dtb'); if (!tb) return;
  var cur = null, raf = 0;
  function q(s) { return tb.querySelector(s); }
  function midY() { return window.innerHeight / 2; }
  function pick() {
    var y = midY(), best = null, bd = Infinity;
    BLOCKS.forEach(function (b) {
      if (!b.isConnected || !b.offsetParent) return;
      var r = b.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) return;
      var d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (d < bd) { bd = d; best = b; }
    });
    return best;
  }
  // nearest gap/fold row above (dir<0) or below (dir>0) the center line that still has something to expand
  function gapRow(b, dir) {
    if (!b || b.dataset.open !== '1') return null;
    var y = midY(), rows = b.querySelectorAll('tr.gap'), hit = null;
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i].querySelector('button[data-fold],button[data-act=all]')) continue;
      var r = rows[i].getBoundingClientRect(), c = r.top + r.height / 2;
      if (dir < 0 && c < y) hit = rows[i];
      if (dir > 0 && c >= y) return rows[i];
    }
    return hit;
  }
  // nearest row (to the center line) that can fold something back
  var UN = 'button[data-act=undown],button[data-act=unup],button[data-refold]';
  function unRow(b) {
    if (!b || b.dataset.open !== '1') return null;
    var y = midY(), rows = b.querySelectorAll('tr.gap'), best = null, bd = Infinity;
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i].querySelector(UN)) continue;
      var r = rows[i].getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - y);
      if (d < bd) { bd = d; best = rows[i]; }
    }
    return best;
  }
  function collapse(all) {
    if (all) { var c0 = cur; c0.keepTop(function () { c0._gaps = {}; c0._unfold = {}; fillBlock(c0, true); }); return update(); }
    var row = unRow(cur); if (!row) return;
    row.querySelector(UN).click(); update();
  }
  function expand(dir, all) {
    var row = gapRow(cur, dir); if (!row) return;
    // GitLab convention: "up" reveals the lines nearest the following hunk, "down" those after the previous one
    var acts = all ? ['all'] : dir < 0 ? ['up', 'down', 'all'] : ['down', 'up', 'all'], btn = row.querySelector('button[data-fold]');
    for (var i = 0; !btn && i < acts.length; i++) btn = row.querySelector('button[data-act=' + acts[i] + ']');
    if (!btn) return;
    var h0 = cur.offsetHeight;
    btn.click();
    if (dir < 0) window.scrollBy(0, cur.offsetHeight - h0); // keep the line being read in place
    update();
  }
  function update() {
    raf = 0;
    var b = pick();
    if (b !== cur) { if (cur) cur.classList.remove('cur'); cur = b; if (cur) cur.classList.add('cur'); }
    tb.hidden = !cur; if (!cur) return;
    var f = byId[cur.dataset.file], open = cur.dataset.open === '1', C = VIEW.tb === 'compact';
    tb.classList.toggle('compact', C);
    // the whole file name, plus the folders that tell same-named files apart (FLABEL, js-app.js)
    var fl = typeof FLABEL !== 'undefined' && FLABEL[f.id];
    q('.nm').textContent = fl ? (fl.dir ? fl.dir + '/' : '') + fl.name : f.path; q('.nm').title = f.path;
    // full text, or a symbol in compact mode; the tooltip always carries the full meaning
    var lab = function (a, full, short) { var el = q('[data-tb=' + a + ']'); if (el.dataset.tip == null) el.dataset.tip = el.title || ''; el.textContent = C ? short : full; el.title = el.dataset.tip || full; };
    lab('open', open ? '收合檔案' : '展開檔案', open ? '▾' : '▸');
    lab('mode', modeOf(cur) === 'sbs' ? '改單欄' : '改並排', modeOf(cur) === 'sbs' ? '▤' : '◫');
    lab('full', fullOf(cur) ? '只看重點' : '看完整', fullOf(cur) ? '◎' : '▣');
    lab('wrap', wrapOf(cur) ? '不換行' : '自動換行', wrapOf(cur) ? '→' : '↩');
    lab('u20', '↑20', '↑'); lab('uall', '↑全部', '⇈'); lab('d20', '↓20', '↓'); lab('dall', '↓全部', '⇊');
    lab('c20', '收回20', '−'); lab('call', '全部收回', '⊖');
    var up = !!gapRow(cur, -1), dn = !!gapRow(cur, 1);
    q('[data-tb=u20]').disabled = q('[data-tb=uall]').disabled = !up;
    q('[data-tb=d20]').disabled = q('[data-tb=dall]').disabled = !dn;
    var un = !!unRow(cur);
    q('[data-tb=c20]').disabled = !un;
    q('[data-tb=call]').disabled = !(un || Object.keys(cur._unfold || {}).length);
    q('[data-tb=fsv]').textContent = fsOf(cur) + 'px';
  }
  function setFs(v) {
    var id = cur.dataset.file;
    if (v === CODEFS) delete FS[id]; else FS[id] = v;
    // the same file can appear in several stations: resize every block of this file
    BLOCKS.forEach(function (b) { if (b.dataset.file === id) { if (v === CODEFS) b.style.removeProperty('--fs-code'); else b.style.setProperty('--fs-code', v + 'px'); } });
  }
  function later() { if (!raf) raf = requestAnimationFrame(update); }
  tb.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tb]'); if (!t || !cur) return;
    var a = t.dataset.tb;
    if (a === 'open') { var c0 = cur; if (c0.dataset.open === '1') c0.keepTop(function () { c0.setOpen(false); }); else c0.setOpen(true); }
    else if (a === 'mode') cur.querySelector('.tg').click();
    else if (a === 'full') cur.querySelector('.fv').click();
    else if (a === 'wrap') { cur._wrap = !wrapOf(cur); cur.classList.toggle('wrapall', cur._wrap); sxFit(cur); }
    else if (a === 'fsv') setFs(CODEFS);
    else if (a === 'fs-' || a === 'fs+') setFs(Math.min(24, Math.max(10, fsOf(cur) + (a === 'fs+' ? 1 : -1))));
    else if (a === 'u20' || a === 'uall') return expand(-1, a === 'uall');
    else if (a === 'd20' || a === 'dall') return expand(1, a === 'dall');
    else if (a === 'c20' || a === 'call') return collapse(a === 'call');
    update();
  });
  window.addEventListener('scroll', later, { passive: true });
  window.addEventListener('resize', later);
  window.addEventListener('hashchange', function () { setTimeout(later, 50); });
  document.addEventListener('click', function () { setTimeout(later, 0); });
  setTimeout(later, 100);
})();
