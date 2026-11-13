// ---- persisted view state ----
function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage may be blocked */ } }
var VIEW = { mode: lsGet('dg.mode', 'inline') === 'sbs' ? 'sbs' : 'inline' };
(function () {
  var w = parseFloat(lsGet('dg.w', '')), s = parseFloat(lsGet('dg.split', ''));
  if (w >= 640) document.documentElement.style.setProperty('--diff-width', w + 'px');
  setSplit(s >= 0.2 && s <= 0.8 ? s : 0.5, false);
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
var KL = { why: '為什麼', good: '好處', risk: '風險', bug: '問題', info: '說明', what: '改了什麼', how: '怎麼改', syntax: '語法／用法' };

// ---- notes ----
function seeLabel(see) {
  var p = String(see).split(':'), r = resolve(p[0]);
  return (r ? r.file.path.slice(r.file.path.lastIndexOf('/') + 1) : p[0]) + ' L' + (p[1] || '');
}
function noteBlock(n) {
  var range = typeof n.to === 'number' && n.to > n.line ? '<b>' + (n.side === 'old' ? '舊 ' : '') + 'L' + n.line + '–L' + n.to + '</b> ' : '';
  var k = KL[n.kind] ? n.kind : 'info';
  return '<div class="nb nk-' + k + '"><div class="nk">' + (n.step ? '<span class="badge">' + h(n.step) + '</span>' : '') + range + h(KL[k]) + '</div>' + md(n.text)
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
    + '</td><td class="sg">' + (x.t === ' ' ? '' : x.t) + '</td><td class="code' + tint + wrapCls(x) + '">' + cellCode(x, lang, mask, x.t === '-' ? 'wd' : 'wa') + '</td></tr>';
}
function rowSbs(r, lang) {
  var m = pairMasks(r), out = '<tr>';
  if (r.l) {
    var lc = r.l.t === '-' ? 'd' : '';
    out += '<td class="no ' + lc + '">' + r.l.o + '</td><td class="m ' + lc + (r.inL ? ' rg' : '') + wrapCls(r.l) + '" data-o="' + r.l.o + '">' + cellCode(r.l, lang, m && r.l.t === '-' ? m[0] : null, 'wd') + '</td>';
  } else out += '<td class="no e"></td><td class="m e"></td>';
  if (r.r) {
    var rc = r.r.t === '+' ? 'a' : '';
    out += '<td class="no ' + rc + '">' + r.r.n + '</td><td class="m ' + rc + (r.inR ? ' rg' : '') + wrapCls(r.r) + '" data-n="' + r.r.n + '">' + cellCode(r.r, lang, m && r.r.t === '+' ? m[1] : null, 'wa') + '</td>';
  } else out += '<td class="no e"></td><td class="m e"></td>';
  return out + '</tr>';
}
function hunkNoteFilter(ns, f, hk) { return ns.filter(function (n) { return n.hunk === hk.id || n.hunk === f.id || n.hunk === f.path; }); }
function hunkHtml(f, hk, ns, mode, lang) {
  var rows = pairRows(hk, ns, mode), o = ['<tr class="h"><td colspan="4">' + h(hk.header) + '</td></tr>'];
  rows.forEach(function (r) {
    o.push(mode === 'sbs' ? noteRowSbs(r.above.L, r.above.R) : noteRowInline(r.above.L.concat(r.above.R)));
    o.push(mode === 'sbs' ? rowSbs(r, lang) : rowInline(r, lang));
    o.push(mode === 'sbs' ? noteRowSbs(r.below.L, r.below.R) : noteRowInline(r.below.L.concat(r.below.R)));
  });
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
function fillBlock(b, force) {
  var mode = modeOf(b);
  if (!force && b.dataset.done === '1' && b.dataset.rmode === mode) return;
  var f = byId[b.dataset.file], hk = b.dataset.hunk ? hunkById[b.dataset.hunk][1] : null, hs = hk ? [hk] : f.hunks, lang = langOf(f.path), ns = b._notes || [], body = '';
  if (!hs.length) body = '<tr class="h"><td colspan="4">' + (f.binary ? '二進位檔' : '沒有內容變更（僅改名或權限）') + '</td></tr>';
  else {
    var whole = !hk;
    hs.forEach(function (x, i) {
      if (whole) { var g = gapInfo(f, hs, i); if (g) body += gapHtml(b, f, g, i, mode, lang); }
      body += hunkHtml(f, x, hunkNoteFilter(ns, f, x), mode, lang);
    });
    if (whole) { var gl = gapInfo(f, hs, hs.length); if (gl) body += gapHtml(b, f, gl, hs.length, mode, lang); }
  }
  var cg = mode === 'sbs' ? '<colgroup><col style="width:52px"><col class="cm"><col style="width:52px"><col></colgroup>' : '<colgroup><col style="width:52px"><col style="width:52px"><col style="width:20px"><col></colgroup>';
  var bd = b.querySelector('.bd');
  bd.innerHTML = '<table class="df ' + mode + '">' + cg + body + '</table>' + (mode === 'sbs' ? '<div class="sph" title="拖曳調整左右欄寬，雙擊還原"></div>' : '');
  b.dataset.done = '1'; b.dataset.rmode = mode;
  var tg = b.querySelector('.tg');
  tg.textContent = '顯示：' + (mode === 'sbs' ? '並排' : '單欄');
}
var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
  es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); if (e.target.dataset.open === '1') fillBlock(e.target); } });
}, { rootMargin: '600px' }) : null;
var BLOCKS = [];
function mkBlock(ref, notes, opts) {
  var r = resolve(ref); if (!r) return null;
  var f = r.file, g = (D.guideFiles || {})[f.path] || (G.files || {})[f.path] || {}, d = document.createElement('div');
  d.className = 'blk'; d.dataset.file = f.id; d.dataset.hunk = r.hunk ? r.hunk.id : ''; d._notes = notes || []; d._gaps = {}; d._ov = null;
  var open = !(f.generated && !(opts && opts.forceOpen));
  d.dataset.open = open ? '1' : '0';
  var tags = (f.generated ? '<span class="flag">產生檔</span>' : '') + (f.large ? '<span class="flag">大修改</span>' : '');
  d.innerHTML = '<div class="fh"><span class="p">' + h(f.path) + (r.hunk ? ' <span class="st">' + h(r.hunk.id) + '</span>' : '') + '</span><span class="st">' + h(f.status) + '</span><span class="add">+' + f.additions + '</span><span class="del">−' + f.deletions + '</span>' + tags
    + '<span class="sp"></span><a href="#files/' + f.id + '" data-nohead="1">依檔案檢視</a><button type="button" class="tg"></button><button type="button" class="fd">' + (open ? '收合' : '展開') + '</button></div>'
    + (f.generated && (g.explain || g.summary) ? '<div class="explain">' + (g.summary ? '<b>' + inl(g.summary) + '</b>' : '') + md(g.explain) + '</div>' : '')
    + '<div class="bd" style="position:relative"></div><div class="rz" title="拖曳調整所有 diff 寬度，雙擊還原"></div>';
  var fh = d.querySelector('.fh'), bd = d.querySelector('.bd'), fd = d.querySelector('.fd'), tg = d.querySelector('.tg');
  bd.style.display = open ? '' : 'none';
  tg.textContent = '顯示：' + (modeOf(d) === 'sbs' ? '並排' : '單欄');
  // lazy: hand rendering to the viewport observer (expand-all), instead of rendering now
  function setOpen(v, lazy) { d.dataset.open = v ? '1' : '0'; bd.style.display = v ? '' : 'none'; fd.textContent = v ? '收合' : '展開'; if (v) { if (lazy && io) io.observe(d); else fillBlock(d); } }
  d.setOpen = setOpen;
  fh.addEventListener('click', function (e) { var t = e.target; if (t.tagName === 'A' || (t.tagName === 'BUTTON' && t !== fd)) return; setOpen(d.dataset.open !== '1'); });
  tg.addEventListener('click', function () { d._ov = modeOf(d) === 'sbs' ? 'inline' : 'sbs'; if (d.dataset.open !== '1') setOpen(true); else fillBlock(d); });
  bd.addEventListener('click', function (e) { var bt = e.target.closest && e.target.closest('button[data-gap]'); if (bt) gapClick(d, bt); });
  if (open) { if (io) io.observe(d); else fillBlock(d); }
  BLOCKS.push(d);
  return d;
}
// Global toggle: applies to every block and clears per-block overrides.
function setGlobalMode(m) {
  VIEW.mode = m; lsSet('dg.mode', m);
  BLOCKS.forEach(function (b) { b._ov = null; if (b.isConnected && b.dataset.open === '1' && b.dataset.done === '1') fillBlock(b, true); else if (b.querySelector('.tg')) b.querySelector('.tg').textContent = '顯示：' + (m === 'sbs' ? '並排' : '單欄'); });
}

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
