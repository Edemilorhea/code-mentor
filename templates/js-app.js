// ---- app: header, tabs, views ----
var $main = document.getElementById('main'), $toc = document.getElementById('toc');
var ST = { done: ['done', '✅ 已完成'], unverified: ['unverified', '⚠️ 未驗證'], gap: ['gap', '❌ 缺口'] };
var CK = { why: '為什麼', good: '好處', risk: '風險', bug: '問題', what: '改了什麼', how: '怎麼改', syntax: '語法／用法' };
var SRC = D.source || { mode: 'branch' };
var units = [];
(G.scenarios || []).forEach(function (sc) { (sc.stations || []).forEach(function (s) { units.push({ s: s, sc: sc }); }); });
(G.mechanisms || []).forEach(function (m) { units.push({ s: m, mech: true }); });
function refFile(ref) { var r = resolve(ref); return r ? r.file : null; }
// station numbering: 1, 2, 2-a, 2-b ...
function numbering(sc) {
  var top = 0, sub = {}, nums = {}, topNo = {};
  (sc.stations || []).forEach(function (s) {
    if (!s.parent) { top++; topNo[s.id] = top; nums[s.id] = String(top); }
    else { var p = topNo[s.parent] || '?'; sub[s.parent] = (sub[s.parent] || 0) + 1; nums[s.id] = p + '-' + String.fromCharCode(96 + sub[s.parent]); }
  });
  return nums;
}
function refsOf(f) {
  var out = [];
  units.forEach(function (u) {
    if ((u.s.hunks || []).some(function (r) { var x = resolve(r); return x && x.file === f; })) out.push(u);
  });
  return out;
}
function notesFor(list) { return (list || []); }
function allNotesOf(f) {
  var o = [];
  units.forEach(function (u) { (u.s.notes || []).forEach(function (n) { var r = resolve(n.hunk); if (r && r.file === f) o.push(n); }); });
  return o;
}
function schemaHtml(f) {
  if (!f.schema) return '';
  return '<div class="schema">' + f.schema.tables.map(function (t) {
    return '<div><b>' + h(t.name) + '</b> <span class="chip neutral">' + h(t.change) + '</span>' + (t.seed ? ' <span class="meta">種子資料 ' + t.seed + ' 筆</span>' : '')
      + (t.columns.length ? colTable(t) : '') + '</div>';
  }).join('') + '</div>';
}
function colTable(t) {
  return '<table class="cols"><tr><th>欄位</th><th>型別</th><th>Nullable</th><th>MaxLength</th><th>異動</th></tr>' + t.columns.map(function (c) {
    return '<tr><td><code>' + h(c.name) + '</code>' + (t.pks.indexOf(c.name) >= 0 ? ' PK' : '') + '</td><td>' + h(c.type) + '</td><td>' + (c.nullable == null ? '' : c.nullable ? '是' : '否') + '</td><td>' + (c.maxLength == null ? '' : c.maxLength) + '</td><td>' + h(c.change) + (c.from ? '（原 ' + h(c.from) + '）' : '') + '</td></tr>';
  }).join('') + (t.fks.length || t.indexes.length ? '<tr><td colspan="5" class="meta">' + t.fks.map(function (k) { return 'FK ' + h(k.column) + ' → ' + h(k.toTable); }).concat(t.indexes.map(function (x) { return (x.unique ? 'UNIQUE ' : '') + '索引 ' + h(x.name) + ' (' + h(x.columns.join(', ')) + ') ' + h(x.change); })).join('；') + '</td></tr>' : '') + '</table>';
}
function mappingHtml(f) {
  var g = (G.files || {})[f.path] || {};
  if (!(g.mapping || []).length) return '';
  return '<div class="schema"><b>Entity 設定 ↔ Migration 語法</b>' + g.mapping.map(function (m) {
    return '<div class="maprow"><div class="lk"><a href="javascript:void 0" data-see="' + h(m.from) + '">' + h(seeLabel(m.from)) + '</a> ↔ <a href="javascript:void 0" data-see="' + h(m.to) + '">' + h(seeLabel(m.to)) + '</a></div>' + md(m.text) + '</div>';
  }).join('') + '</div>';
}

// ---- views ----
function head() {
  var adds = 0, dels = 0; files.forEach(function (f) { adds += f.additions; dels += f.deletions; });
  var mr = SRC.mr, what = SRC.mode === 'mr' ? 'MR !' + mr.iid : SRC.mode === 'range' ? D.target : D.target;
  var s = '<header class="top prose"><div class="eyebrow">Code 導讀</div><h1>' + h(G.title || (mr && mr.title) || 'Code 導讀') + '</h1>';
  s += '<div class="meta">基準 <code>' + h(D.base) + '</code>（merge-base <code>' + h(D.baseline) + '</code>）→ ' + h(what) + '　分支 <code>' + h(D.branch) + '</code>　' + h(D.date) + (D.uncommitted ? '　含未 commit 變更' : '') + '</div>';
  if (mr) s += '<div class="meta">' + (mr.url ? '<a href="' + h(mr.url) + '">' + h(mr.title || ('!' + mr.iid)) + '</a>' : h(mr.title || '')) + (mr.author ? '　作者 ' + h(mr.author) : '') + (mr.target ? '　目標 <code>' + h(mr.target) + '</code>' : '') + '</div>';
  if (mr && mr.description) s += '<details class="commits"><summary>MR 說明</summary>' + md(mr.description) + '</details>';
  if (G.summary) s += '<div class="lead">' + inl(G.summary) + '</div>';
  s += '<div class="keyline"><span><b>' + files.length + '</b> 個檔案</span><span class="add">+' + adds + '</span><span class="del">−' + dels + '</span>' + (G.intent ? '<span>意圖：' + h(G.intent) + '</span>' : '') + ((D.ignored || []).length ? '<span title="' + h(D.ignored.join('\n')) + '">已排除 ' + D.ignored.length + ' 個 .gitignore 檔案</span>' : '') + '</div>';
  if ((D.commits || []).length) s += '<details class="commits"><summary>' + D.commits.length + ' 個 commit</summary><ul>' + D.commits.map(function (c) { return '<li><code>' + h(c.hash) + '</code> ' + h(c.subject) + '</li>'; }).join('') + '</ul></details>';
  s += '<div class="hbar"><span class="meta">全域顯示</span><span class="seg" id="gseg"><button type="button" data-m="inline">單欄</button><button type="button" data-m="sbs">並排</button></span><button type="button" data-all="close">全部收合</button><button type="button" data-all="open">全部展開</button></div></header>';
  s += '<div class="tabbar"><nav class="tabs"><a href="#scenario" data-t="scenario">依情境</a><a href="#files" data-t="files">依檔案</a><a href="#mech" data-t="mech">機制／架構</a></nav></div><div class="content" id="content"></div>';
  return s;
}
function syncSeg() { Array.prototype.forEach.call(document.querySelectorAll('#gseg button'), function (b) { b.setAttribute('aria-pressed', b.dataset.m === VIEW.mode ? 'true' : 'false'); }); }
function stationCard(u, nums, sc) {
  var s = u.s, d = document.createElement('section'), num = nums ? nums[s.id] : '';
  d.className = 'card'; d.id = (u.mech ? 'm-' : 's-') + s.id;
  var st = ST[s.status];
  var t = '<div class="prose"><h3>' + (num ? '<span class="num">' + h(num) + '</span>' : '') + (s.change ? '<span class="tag ' + h(s.change) + '">' + h(s.change) + '</span>' : '') + h(s.title || s.id) + (st ? '<span class="chip ' + st[0] + '">' + st[1] + '</span>' : '') + '</h3>';
  if (s.intuition) t += '<div class="intuition"><div class="ct">直覺</div>' + md(s.intuition) + '</div>';
  if (u.mech) { if (s.problem) t += '<div class="three"><div><b>問題</b> <span class="v">' + inl(s.problem) + '</span></div></div>'; if (s.text) t += md(s.text); }
  else t += '<div class="three">' + (s.situation ? '<div><b>情境</b> <span class="v">' + inl(s.situation) + '</span></div>' : '') + (s.purpose ? '<div><b>為了完成</b> <span class="v">' + inl(s.purpose) + '</span></div>' : '') + (s.did ? '<div><b>我做了</b> <span class="v">' + inl(s.did) + '</span></div>' : '') + '</div>';
  (s.callouts || []).forEach(function (c) { var k = CK[c.kind] ? c.kind : 'why'; t += '<div class="callout ' + k + '"><div class="ct">' + h(CK[k]) + (c.title ? '・' + h(c.title) : '') + '</div>' + md(c.text) + '</div>'; });
  t += '</div>'; d.innerHTML = t;
  if (u.mech && s.svg) { var fg = document.createElement('div'); fg.className = 'er'; fg.innerHTML = s.svg; d.appendChild(fg); }
  var cnt = {};
  (s.hunks || []).forEach(function (ref) { var b = mkBlock(ref, s.notes || []); if (b) d.appendChild(b); cnt[ref] = 1; });
  return d;
}
function viewScenario() {
  var c = document.createDocumentFragment(), toc = '';
  (G.scenarios || []).forEach(function (sc) {
    var nums = numbering(sc);
    var t = document.createElement('h2'); t.className = 'sc-title'; t.id = 'sc-' + sc.id; t.textContent = (sc.title || sc.id) + (sc.actor ? '（' + sc.actor + '）' : ''); c.appendChild(t);
    toc += '<div class="grp">' + h(sc.title || sc.id) + '</div>';
    (sc.stations || []).forEach(function (s) {
      c.appendChild(stationCard({ s: s }, nums, sc));
      toc += '<a class="' + (s.parent ? 'sub' : '') + '" href="#s-' + h(s.id) + '" data-jump="s-' + h(s.id) + '">' + h(nums[s.id]) + '. ' + h(s.title || s.id) + '</a>';
    });
  });
  if (!(G.scenarios || []).some(function (s) { return (s.stations || []).length; })) { var e = document.createElement('p'); e.className = 'empty'; e.textContent = '尚未定義情境站。'; c.appendChild(e); }
  return { node: c, toc: toc };
}
function viewMech() {
  var c = document.createDocumentFragment(), toc = '';
  if (G.erSvg) {
    var d = document.createElement('section'); d.className = 'card'; d.id = 'm-er';
    d.innerHTML = '<div class="prose"><h3>資料表變更（由 migration 推出）</h3></div><div class="er">' + G.erSvg + '</div>' + G.erTables.map(function (t) { return '<div class="prose"><b>' + h(t.name) + '</b> <span class="chip neutral">' + h(t.change) + '</span>' + colTable(t) + '</div>'; }).join('');
    c.appendChild(d); toc += '<a href="#m-er" data-jump="m-er">資料表變更</a>';
  }
  (G.mechanisms || []).forEach(function (m) { c.appendChild(stationCard({ s: m, mech: true })); toc += '<a href="#m-' + h(m.id) + '" data-jump="m-' + h(m.id) + '">' + h(m.title || m.id) + '</a>'; });
  if (!c.childNodes.length) { var e = document.createElement('p'); e.className = 'empty'; e.textContent = '沒有機制／架構說明。'; c.appendChild(e); }
  return { node: c, toc: toc };
}
var FSORT = lsGet('dg.fsort', 'path');
function viewFiles() {
  var c = document.createDocumentFragment(), toc = '';
  FWRAPS.length = 0;
  var tools = document.createElement('div'); tools.className = 'tools';
  tools.innerHTML = '排序：<select id="fsort"><option value="path">依路徑</option><option value="size">依大小</option></select>';
  c.appendChild(tools);
  var list = files.slice();
  if (FSORT === 'size') list.sort(function (a, b) { return (b.additions + b.deletions) - (a.additions + a.deletions); });
  else list.sort(function (a, b) { return a.path < b.path ? -1 : 1; });
  var max = Math.max.apply(null, [1].concat(files.map(function (f) { return f.additions + f.deletions; }))), lastDir = null;
  list.forEach(function (f) {
    var dir = FSORT === 'size' ? null : (f.path.indexOf('/') >= 0 ? f.path.slice(0, f.path.lastIndexOf('/')) : '(root)');
    if (dir !== null && dir !== lastDir) {
      var dh = document.createElement('div'); dh.className = 'dir'; dh.textContent = dir; c.appendChild(dh); lastDir = dir;
      toc += '<div class="grp" title="' + h(dir) + '">' + h(dir.split('/').slice(-2).join('/')) + '</div>';
    } else if (dir === null && !toc) toc = '<div class="grp">檔案</div>';
    toc += '<a href="#files/' + h(f.id) + '" data-file="' + h(f.id) + '" title="' + h(f.path) + '">' + h(f.path.slice(f.path.lastIndexOf('/') + 1)) + '</a>';
    var refs = refsOf(f), g = (G.files || {})[f.path] || {};
    var wrap = document.createElement('div'); wrap.id = 'file-' + f.id;
    var tot = f.additions + f.deletions, w = Math.max(6, Math.round(90 * tot / max)), aw = tot ? Math.round(100 * f.additions / tot) : 0;
    var flags = (f.generated ? '<span class="flag">產生檔</span>' : '') + (f.large ? '<span class="flag">大修改</span>' : '') + (!refs.length && !g.skip ? '<span class="flag">未提及</span>' : '') + (g.skip ? '<span class="flag">略過</span>' : '');
    var row = document.createElement('div'); row.className = 'frow';
    row.innerHTML = '<span class="nm">' + h(FSORT === 'size' ? f.path : f.path.slice(f.path.lastIndexOf('/') + 1)) + '</span><span class="meta">' + h(f.status) + '</span><span class="add">+' + f.additions + '</span><span class="del">−' + f.deletions + '</span><span class="bar" style="width:' + w + 'px"><span style="width:100%"><i class="a" style="width:' + aw + '%"></i><i class="d" style="width:' + (100 - aw) + '%"></i></span></span>' + flags
      + '<span class="refs">' + refs.map(function (u) { return '<a href="#' + (u.mech ? 'mech' : 'scenario') + '" data-jump="' + (u.mech ? 'm-' : 's-') + h(u.s.id) + '">' + h(u.s.title || u.s.id) + '</a>'; }).join('') + '</span>' + (g.summary ? '<span class="meta" style="flex-basis:100%">' + inl(g.summary) + '</span>' : '');
    wrap.appendChild(row);
    var holder = document.createElement('div'); wrap.appendChild(holder);
    row.addEventListener('click', function (e) { if (e.target.tagName === 'A') return; openFile(wrap, f); });
    wrap._open = function () { return openFile(wrap, f, true); };
    wrap._f = f; FWRAPS.push(wrap);
    c.appendChild(wrap);
  });
  return { node: c, toc: toc };
}
var FWRAPS = [];
function openFile(wrap, f, keepOpen, lazy) {
  var holder = wrap.lastChild;
  if (holder.firstChild) { if (keepOpen) return holder.firstChild; holder.innerHTML = ''; return null; }
  var g = (G.files || {})[f.path] || {};
  var b = mkBlock(f.id, allNotesOf(f), { forceOpen: true });
  b.dataset.open = '1';
  var pre = document.createElement('div');
  pre.innerHTML = schemaHtml(f) + mappingHtml(f);
  b.querySelector('.fh').insertAdjacentHTML('afterend', pre.innerHTML);
  holder.appendChild(b); b.querySelector('.fd').textContent = '收合';
  if (lazy && io) io.observe(b); else fillBlock(b, true);
  return b;
}

// ---- jump (see / mapping): expand file in files tab, highlight the right side's cell ----
function jumpTo(see) {
  var m = /^(.+):(\d+)$/.exec(see); if (!m) return;
  var r = resolve(m[1]); if (!r) return;
  location.hash = '#files/' + r.file.id + '/' + m[2] + (r.hunk ? '/' + r.hunk.id : '');
}
function doJump(fid, line, hid) {
  var wrap = document.getElementById('file-' + fid); if (!wrap) return;
  var b = wrap._open(); if (!b) return;
  fillBlock(b, false);
  if (!line) { wrap.scrollIntoView({ block: 'start' }); return; }
  var sel = function (a) { return b.querySelector('td[data-' + a + '="' + line + '"]'); };
  var hk = hid && hunkById[hid] ? hunkById[hid][1] : null, side = 'n';
  if (hk && !hk.lines.some(function (l) { return l.n === +line; })) side = 'o';
  var el = sel(side) || sel(side === 'n' ? 'o' : 'n');
  var tr = b.querySelector('tr[data-' + side + '="' + line + '"]');
  if (!el && !tr) return;
  var target = el || tr; target.classList.add('hit'); if (tr) tr.classList.add('hit');
  target.scrollIntoView({ block: 'center' });
  setTimeout(function () { target.classList.remove('hit'); if (tr) tr.classList.remove('hit'); }, 2500);
}

// ---- router ----
var view = null, cur = null;
function render() {
  var hs = (location.hash || '#scenario').slice(1).split('/'), tab = hs[0] === 'files' || hs[0] === 'mech' ? hs[0] : 'scenario';
  if (cur !== tab) {
    BLOCKS.length = 0;
    var v = tab === 'files' ? viewFiles() : tab === 'mech' ? viewMech() : viewScenario();
    var ct = document.getElementById('content'); ct.innerHTML = ''; ct.appendChild(v.node);
    $toc.innerHTML = v.toc; cur = tab;
    Array.prototype.forEach.call(document.querySelectorAll('.tabs a'), function (a) { a.classList.toggle('on', a.dataset.t === tab); });
    var fs = document.getElementById('fsort'); if (fs) { fs.value = FSORT; fs.onchange = function () { FSORT = fs.value; lsSet('dg.fsort', FSORT); cur = null; render(); }; }
  }
  if (tab === 'files' && hs[1]) doJump(hs[1], hs[2], hs[3]);
  else if (!hs[1] && hs[0] && !/^(scenario|files|mech)$/.test(hs[0])) { var el = document.getElementById(hs[0]); if (el) el.scrollIntoView(); }
}
// Global collapse / expand. Expand confirms first and renders lazily (viewport observer).
function toggleAll(open) {
  var targets = cur === 'files'
    ? FWRAPS.filter(function (w) { return !!w.lastChild.firstChild !== open; })
    : BLOCKS.filter(function (b) { return b.isConnected && (b.dataset.open === '1') !== open; });
  if (open) {
    var seen = {}, nf = 0, big = 0, lines = 0;
    targets.forEach(function (x) {
      var f = x._f || byId[x.dataset.file]; if (seen[f.id]) return; seen[f.id] = 1;
      nf++; if (f.large || f.generated) big++; lines += f.additions + f.deletions;
    });
    if (!nf) return;
    if (!window.confirm('要展開 ' + nf + ' 個檔案區塊嗎？其中 ' + big + ' 個是大修改或產生檔，合計約 ' + lines + ' 行變更。全部展開可能讓頁面變慢。')) return;
  }
  targets.forEach(function (x) {
    if (cur === 'files') { if (open) openFile(x, x._f, false, true); else x.lastChild.innerHTML = ''; }
    else x.setOpen(open, open);
  });
}
document.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target.closest('[data-see],[data-jump],[data-all],#gseg button') : null; if (!t) return;
  if (t.dataset.all) toggleAll(t.dataset.all === 'open');
  else if (t.dataset.see) { e.preventDefault(); jumpTo(t.dataset.see); }
  else if (t.dataset.jump) {
    var id = t.dataset.jump, want = /^m-/.test(id) && id !== 'm-er' || id === 'm-er' ? 'mech' : 'scenario';
    if (t.closest('.dg-toc') || t.closest('.refs')) {
      e.preventDefault();
      var tab = cur === 'files' && t.closest('.refs') ? want : cur;
      if (tab !== cur) { location.hash = '#' + tab; setTimeout(function () { var el = document.getElementById(id); if (el) el.scrollIntoView(); }, 0); }
      else { var el = document.getElementById(id); if (el) el.scrollIntoView(); }
    }
  } else if (t.dataset.m) { setGlobalMode(t.dataset.m); syncSeg(); }
});
$main.innerHTML = head(); syncSeg();
window.addEventListener('hashchange', render);
render();
if (io === null) BLOCKS.forEach(function (b) { fillBlock(b); });
