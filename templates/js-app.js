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
  var depth = G.depth || '導讀', dinfo = (G.depthInfo || {})[depth] || '';
  var s = '<header class="top prose"><div class="eyebrow">Code Mentor</div><h1>' + h(G.title || (mr && mr.title) || 'Code Mentor') + '</h1>';
  s += '<div class="meta">基準 <code>' + h(D.base) + '</code>（merge-base <code>' + h(D.baseline) + '</code>）→ ' + h(what) + '　分支 <code>' + h(D.branch) + '</code>　' + h(D.date) + (D.uncommitted ? '　含未 commit 變更' : '') + '</div>';
  if (mr) s += '<div class="meta">' + (mr.url ? '<a href="' + h(mr.url) + '">' + h(mr.title || ('!' + mr.iid)) + '</a>' : h(mr.title || '')) + (mr.author ? '　作者 ' + h(mr.author) : '') + (mr.target ? '　目標 <code>' + h(mr.target) + '</code>' : '') + '</div>';
  if (mr && mr.description) s += '<details class="commits"><summary>MR 說明</summary>' + md(mr.description) + '</details>';
  if (G.summary) s += '<div class="lead">' + inl(G.summary) + '</div>';
  s += '<div class="keyline"><span><b>' + files.length + '</b> 個檔案</span><span class="add">+' + adds + '</span><span class="del">−' + dels + '</span>' + (G.intent ? '<span>意圖：' + h(G.intent) + '</span>' : '') + ((D.ignored || []).length ? '<span title="' + h(D.ignored.join('\n')) + '">已排除 ' + D.ignored.length + ' 個 .gitignore 檔案</span>' : '') + '</div>';
  if ((D.commits || []).length) s += '<details class="commits"><summary>' + D.commits.length + ' 個 commit</summary><ul>' + D.commits.map(function (c) { return '<li><code>' + h(c.hash) + '</code> ' + h(c.subject) + '</li>'; }).join('') + '</ul></details>';
  s += '</header>';
  s += '<div class="tabbar"><nav class="tabs">' + (HAS_OV ? '<a href="#overview" data-t="overview">功能總覽</a>' : '') + (HAS_SP ? '<a href="#spine" data-t="spine">主線</a>' : '') + '<a href="#scenario" data-t="scenario">依情境</a><a href="#files" data-t="files">依檔案</a><a href="#mech" data-t="mech">機制／架構</a>' + ((G.logic || []).length ? '<a href="#logic" data-t="logic">邏輯導讀</a>' : '') + '</nav><span class="depth-badge" data-depth="' + h(depth) + '" title="' + h(dinfo) + '">' + h(depth) + '</span></div><div class="content" id="content"></div>';
  return s;
}
// ---- display settings panel (button at the bottom of the sidebar) ----
// text width: 'fill' = prose as wide as the diffs, 'read' = a readable measure
var TEXTW = lsGet('dg.textw', '') === 'read' ? 'read' : 'fill';
function applyTextW() { document.documentElement.classList.toggle('text-fill', TEXTW === 'fill'); }
applyTextW();
function sw(id, on, text, tip) {
  return '<label class="sw"' + (tip ? ' title="' + h(tip) + '"' : '') + '><span class="tx">' + text + '</span><input type="checkbox" role="switch" id="' + id + '"' + (on ? ' checked' : '') + '><i aria-hidden="true"></i></label>';
}
// a − value + stepper; clicking the value resets it
function sz(k, text, val, tip) {
  return '<div class="sz" title="' + h(tip) + '"><span>' + text + '</span><span class="ctl"><button type="button" data-sz="' + k + '" data-d="-1" aria-label="' + text + '變小">−</button><button type="button" class="v" data-sz="' + k + '" data-d="0" title="點一下還原">' + val + '</button><button type="button" data-sz="' + k + '" data-d="1" aria-label="' + text + '變大">+</button></span></div>';
}
document.addEventListener('click', function (e) {
  var t = e.target.closest && e.target.closest('[data-sz]'); if (!t) return;
  var d = +t.dataset.d;
  if (t.dataset.sz === 'ui') setUi(d ? UI + d * 0.05 : 1); else setCodeFs(d ? CODEFS + d : 14);
  document.getElementById('dpnl').innerHTML = panelHtml();
});
// the 預設收合 list stays open across panel re-renders while the page is open
var FR_OPEN = false;
document.addEventListener('toggle', function (e) { if (e.target.classList && e.target.classList.contains('frd')) FR_OPEN = e.target.open; }, true);
function panelHtml() {
  return '<div class="ph">Diff</div>'
    + sw('set-sbs', VIEW.mode === 'sbs', '並排顯示', '關閉時為單欄')
    + sw('set-full', VIEW.full, '顯示完整檔案', '關閉時只顯示註解附近的重點')
    + (FMT_TOTAL ? sw('fmtck', VIEW.hideFmt, '隱藏格式化差異 <span class="n">' + FMT_TOTAL + ' 行</span>', '只改了換行、縮排、空白、單雙引號或結尾逗號的行不顯示；整段或整個檔案都是格式化時一起隱藏。有註解的地方不隱藏。') : '')
    // one row that opens the 12 role switches; the summary names what is folded now
    + '<details class="frd"' + (FR_OPEN ? ' open' : '') + '><summary title="選哪幾類檔案一開始就收合；切換時畫面上的同類檔案也馬上收合或展開。記在這個瀏覽器。"><span class="tx">預設收合</span><span class="n">' + h(Object.keys(FOLD_ROLES).join('、') || '無') + '</span></summary>'
    + ROLES.map(function (r, i) { return sw('set-fr-' + i, !!FOLD_ROLES[r[0]], '<span class="rt" style="--c:' + r[1] + '">' + h(r[0]) + '</span>', '打開：這類檔案馬上收合，以後開報告也收合；關閉：馬上展開'); }).join('') + '</details>'
    + '<div class="ph">文字大小</div>'
    + sz('ui', '介面文字', Math.round(UI * 100) + '%', '標題、說明、側欄、按鈕；不含程式碼')
    + sz('code', '所有程式碼', CODEFS + 'px', '一次調整所有 diff 的字級；工具列的 A− A+ 只調整單一檔案')
    + '<div class="ph">版面</div>'
    + sw('set-tb', VIEW.tb === 'compact', '精簡工具列', '底部浮動工具列只顯示符號，滑鼠停留看說明')
    + sw('set-textw', TEXTW === 'fill', '文字填滿寬度', '關閉時內容置中，最寬 1240px')
    + '<div class="pb"><button type="button" data-all="close">全部收合</button><button type="button" data-all="open">全部展開</button></div>';
}
function syncSeg() { var p = document.getElementById('dpnl'); if (p && !p.hidden) p.innerHTML = panelHtml(); }
function setPanel(open) {
  var p = document.getElementById('dpnl'), b = document.querySelector('[data-ui=set]'); if (!p) return;
  if (open) p.innerHTML = panelHtml();
  p.hidden = !open; b.setAttribute('aria-expanded', open ? 'true' : 'false');
}
document.addEventListener('click', function (e) {
  var t = e.target, set = document.getElementById('dset'); if (!set) return;
  if (t.closest && t.closest('[data-ui=set]')) setPanel(document.getElementById('dpnl').hidden);
  else if (!set.contains(t)) setPanel(false);
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setPanel(false); });
document.addEventListener('change', function (e) {
  var t = e.target, v = t.checked;
  if (t.id === 'set-sbs') setGlobalMode(v ? 'sbs' : 'inline');
  else if (t.id === 'set-full') {
    if (v && !window.confirm('所有已展開的區塊都會改成顯示完整檔案，長檔案會讓頁面變長、變慢。要繼續嗎？')) { t.checked = false; return; }
    setGlobalFull(v);
  } else if (t.id === 'set-tb') { VIEW.tb = v ? 'compact' : 'full'; lsSet('dg.tb', v ? 'compact' : ''); window.dispatchEvent(new Event('resize')); }
  else if (/^set-fr-\d+$/.test(t.id)) { var rk = ROLES[+t.id.slice(7)][0]; setFoldRole(rk, v); setRoleOpen(rk, !v); var fn = t.closest('details').querySelector('summary .n'); fn.textContent = Object.keys(FOLD_ROLES).join('、') || '無'; }
  else if (t.id === 'set-textw') { TEXTW = v ? 'fill' : 'read'; lsSet('dg.textw', v ? '' : 'read'); applyTextW(); }
});

// ---- file labels: the file name, plus as many parent folders as it takes to tell same-named files apart ----
var FLABEL = (function () {
  var out = {}, segs = {}, depth = {};
  files.forEach(function (f) { segs[f.id] = f.path.split('/'); depth[f.id] = 1; });
  for (var round = 0; round < 50; round++) {
    var seen = {}, clash = false;
    files.forEach(function (f) { var k = segs[f.id].slice(-depth[f.id]).join('/'); (seen[k] = seen[k] || []).push(f); });
    Object.keys(seen).forEach(function (k) {
      if (seen[k].length < 2) return;
      seen[k].forEach(function (f) { if (depth[f.id] < segs[f.id].length) { depth[f.id]++; clash = true; } });
    });
    if (!clash) break;
  }
  files.forEach(function (f) { var s = segs[f.id], d = depth[f.id]; out[f.id] = { dir: s.slice(-d, -1).join('/'), name: s[s.length - 1] }; });
  return out;
})();
function fileLabel(f) { var l = FLABEL[f.id]; return (l.dir ? '<span class="pd">' + h(l.dir) + '/</span>' : '') + h(l.name); }
// folder vs file: a folder heading has a folder icon, a dim parent path and its own name in bold;
// a file under it has a file icon and only its name (the heading already says where it is)
var IC_DIR = '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 3.5h4l1.5 1.5h7.5v8h-13z"/></svg>';
var IC_FILE = '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 1.5h6l3 3v10h-9z M9.5 1.5v3h3"/></svg>';
function fileName(f) { return IC_FILE + '<span class="fn">' + h(f.path.slice(f.path.lastIndexOf('/') + 1)) + '</span>'; }
function stationCard(u, nums, sc) {
  var s = u.s, d = document.createElement('section'), num = nums ? nums[s.id] : '';
  d.className = 'card'; d.id = (u.mech ? 'm-' : 's-') + s.id;
  var st = ST[s.status];
  var t = '<div class="prose"><h3>' + (num ? '<span class="num">' + h(num) + '</span>' : '') + (s.change ? '<span class="tag ' + h(s.change) + '">' + h(s.change) + '</span>' : '') + h(s.title || s.id) + (st ? '<span class="chip ' + st[0] + '">' + st[1] + '</span>' : '') + '</h3>';
  if (s.intuition) t += '<div class="intuition"><div class="ct">直覺</div>' + md(s.intuition) + '</div>';
  if (u.mech) { if (s.problem) t += '<div class="three"><div><b>問題</b> <span class="v">' + inl(s.problem) + '</span></div></div>'; if (s.text) t += md(s.text); }
  else {
    // one line stays inline next to its label; multi-line text (lists, paragraphs) renders as markdown-lite
    var v3 = function (x) { return /\n/.test(x) ? '<div class="v">' + md(x) + '</div>' : '<span class="v">' + inl(x) + '</span>'; };
    t += '<div class="three">' + (s.situation ? '<div><b>情境</b> ' + v3(s.situation) + '</div>' : '') + (s.purpose ? '<div><b>為了完成</b> ' + v3(s.purpose) + '</div>' : '') + (s.did ? '<div><b>我做了</b> ' + v3(s.did) + '</div>' : '') + '</div>';
  }
  if (s.chain) t += '<div class="chain"><div class="ct">呼叫鏈</div><pre>' + h(String(s.chain).replace(/\s+$/, '')) + '</pre></div>';
  (s.callouts || []).forEach(function (c) { var k = CK[c.kind] ? c.kind : 'why'; t += '<div class="callout ' + k + '"><div class="ct">' + h(CK[k]) + (c.title ? '・' + h(c.title) : '') + '</div>' + md(c.text) + '</div>'; });
  t += '</div>'; d.innerHTML = t;
  if (u.mech && (s.svg || s.diagramFile)) { var fg = document.createElement('div'); fg.innerHTML = (s.svg ? erBox(s.svg) : '') + dfileLink(s); d.appendChild(fg); }
  // in a layer view a station only shows that layer's code; mechanisms always show all of theirs
  var notes = visibleNotes(s.notes);
  (s.hunks || []).forEach(function (ref) {
    if (!u.mech && !refInLayer(ref)) return;
    var b = mkBlock(ref, notes); if (b) d.appendChild(b);
  });
  return d;
}
// does a station have any code in the current layer?
function stationInLayer(s) { return LAYER === '整體' || (s.hunks || []).some(refInLayer); }
function viewScenario() {
  var c = document.createDocumentFragment(), toc = '';
  var hint = layerHint(); if (hint) c.appendChild(hint);
  (G.scenarios || []).forEach(function (sc) {
    var nums = numbering(sc), shown = (sc.stations || []).filter(stationInLayer);
    if (!shown.length) return;
    var t = document.createElement('h2'); t.className = 'sc-title'; t.id = 'sc-' + sc.id; t.textContent = (sc.title || sc.id) + (sc.actor ? '（' + sc.actor + '）' : ''); c.appendChild(t);
    toc += '<div class="grp">' + h(sc.title || sc.id) + '</div>';
    shown.forEach(function (s) {
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
    d.innerHTML = '<div class="prose"><h3>資料表變更（由 migration 推出）</h3></div>' + erBox(G.erSvg) + G.erTables.map(function (t) { return '<div class="prose"><b>' + h(t.name) + '</b> <span class="chip neutral">' + h(t.change) + '</span>' + colTable(t) + '</div>'; }).join('');
    c.appendChild(d); toc += '<a href="#m-er" data-jump="m-er">資料表變更</a>';
  }
  (G.mechanisms || []).forEach(function (m) { c.appendChild(stationCard({ s: m, mech: true })); toc += '<a href="#m-' + h(m.id) + '" data-jump="m-' + h(m.id) + '">' + h(m.title || m.id) + '</a>'; });
  if (!c.childNodes.length) { var e = document.createElement('p'); e.className = 'empty'; e.textContent = '沒有機制／架構說明。'; c.appendChild(e); }
  return { node: c, toc: toc };
}
// ---- 功能總覽: what the branch does and why, no code ----
var HAS_OV = (G.features || []).length > 0;
function stationRef(id) {
  var out = null;
  (G.scenarios || []).forEach(function (sc) { (sc.stations || []).forEach(function (s) { if (s.id === id) out = { s: s, num: numbering(sc)[id] }; }); });
  return out;
}
function viewOverview() {
  var c = document.createDocumentFragment(), toc = '<div class="grp">功能</div>';
  var top = document.createElement('section'); top.className = 'card'; top.id = 'ov-top';
  // summary already shows in the header above the tabs; only the need is added here
  if (G.need) { top.innerHTML = '<div class="prose"><h3>需求</h3>' + md(G.need) + '</div>'; c.appendChild(top); }
  (G.features || []).forEach(function (f, i) {
    var d = document.createElement('section'); d.className = 'card feat'; d.id = 'ov-f' + (i + 1);
    var st = ST[f.status];
    var links = (f.stations || []).map(function (id) { var r = stationRef(id); return r ? '<a href="#scenario" data-goto="s-' + h(id) + '"><span class="num">' + h(r.num) + '</span>' + h(r.s.title || id) + '</a>' : ''; }).filter(Boolean).join('　');
    // the feature's spine comes first: read the whole path, then a station
    var sp = f.spine && spineRef(f.spine);
    if (sp) links = '<a href="#spine" data-gosp="p-' + h(sp.s.id) + '"><span class="num">主線</span>' + h(sp.s.title || sp.s.id) + '</a>' + (links ? '　' + links : '');
    d.innerHTML = '<div class="prose"><h3><span class="num">' + (i + 1) + '</span>' + h(f.title || '') + (st ? '<span class="chip ' + st[0] + '">' + st[1] + '</span>' : '') + '</h3><div class="three">'
      + (f.what ? '<div><b>能做什麼</b> <span class="v">' + inl(f.what) + '</span></div>' : '')
      + (f.why ? '<div><b>為什麼</b> <span class="v">' + inl(f.why) + '</span></div>' : '')
      + (links ? '<div><b>看 code</b> <span class="v">' + links + '</span></div>' : '') + '</div></div>';
    c.appendChild(d); toc += '<a href="#ov-f' + (i + 1) + '" data-jump="ov-f' + (i + 1) + '">' + (i + 1) + '. ' + h(f.title || '') + '</a>';
  });
  var list = function (title, xs) { return (xs || []).length ? '<div><b>' + title + '</b><ul>' + xs.map(function (x) { return '<li>' + inl(x) + '</li>'; }).join('') + '</ul></div>' : ''; };
  var rest = list('這次不做', G.outOfScope) + list('還不確定', G.unknowns);
  if (rest) { var e = document.createElement('section'); e.className = 'card'; e.id = 'ov-rest'; e.innerHTML = '<div class="prose"><h3>沒做的、不確定的</h3>' + rest + '</div>'; c.appendChild(e); toc += '<a href="#ov-rest" data-jump="ov-rest">沒做的、不確定的</a>'; }
  // the reading order, stated where the reader starts
  if (HAS_SP) { var rd = document.createElement('p'); rd.className = 'callout how'; rd.innerHTML = '<b>建議閱讀順序</b>：功能總覽 → <a href="#spine">主線</a>（每條約 5 分鐘，先看整條路）→ 依情境的站（需要細節時才往下讀）。'; c.insertBefore(rd, c.firstChild); }
  return { node: c, toc: toc };
}
// ---- 主線: one per user action that writes data, from the button to the tables ----
var HAS_SP = (G.spines || []).length > 0;
function spineRef(id) { var out = null; (G.spines || []).forEach(function (s, i) { if (s.id === id) out = { s: s, n: i + 1 }; }); return out; }
// evidence of a claim: a link to the code line, or an "unverified" chip
function srcCell(x) {
  if (x.ref) return '<a href="javascript:void 0" data-see="' + h(x.ref) + '" class="src">' + h(x.ref) + '</a>';
  return x.unverified ? '<span class="chip unverified">未驗證</span>' : '';
}
// A built-in diagram, shrunk to fit; the 原始大小 button shows it 1:1 with a horizontal scrollbar.
// The button is removed after render when the diagram already fits (fitErs).
function erBox(svg) { return '<div class="er"><button type="button" class="rawbtn" data-raw="1" title="切換原始大小（可橫向捲動）／縮小到版面寬">原始大小</button>' + svg + '</div>'; }
function fitErs() {
  Array.prototype.forEach.call(document.querySelectorAll('.er'), function (e) {
    var sv = e.querySelector('svg'), b = e.querySelector('.rawbtn');
    if (sv && b && +sv.getAttribute('width') <= e.clientWidth) b.remove();
  });
}
// the detailed diagram (drawn with diagram-design, saved under diagrams/)
function dfileLink(s) {
  return s.diagramFile && diagLink(s.diagramFile) ? '<p class="dfile"><a href="' + h(s.diagramFile) + '" target="_blank" rel="noopener">開啟完整圖 ↗</a></p>' : '';
}
function viewSpine() {
  var c = document.createDocumentFragment(), toc = '';
  (G.spines || []).forEach(function (s, i) {
    var d = document.createElement('section'); d.className = 'card spine'; d.id = 'p-' + s.id;
    var t = '<div class="prose"><h3><span class="num">' + (i + 1) + '</span>' + h(s.title || s.id) + '</h3>' + (s.text ? md(s.text) : '');
    if (s.svg || s.diagramFile) t += '<div class="ct">流程圖</div>' + (s.svg ? erBox(s.svg) : '') + dfileLink(s);
    var steps = s.steps || [];
    if (steps.length) {
      t += '<div class="ct">步驟</div><table class="sp-t"><thead><tr><th>#</th><th>檔案</th><th>做什麼</th><th>寫入</th><th>出處</th></tr></thead><tbody>'
        + steps.map(function (st, k) {
          var r = st.file && refFile(st.file), fname = r ? r.path.slice(r.path.lastIndexOf('/') + 1) : (st.file || '');
          var sr = st.station && stationRef(st.station);
          return '<tr><td class="n">' + (k + 1) + '</td><td>' + (r ? '<a href="#files/' + h(r.id) + '" title="' + h(r.path) + '"><code>' + h(fname) + '</code></a>' : h(fname))
            + (st.module ? '<div class="mod">' + h(st.module) + '</div>' : '') + '</td><td>' + inl(st.does || '')
            + (sr ? ' <a href="#scenario" data-goto="s-' + h(st.station) + '" class="go">→ 站 ' + h(sr.num) + '</a>' : '') + '</td><td>'
            + (st.writes ? '<b class="wr">⇒ ' + h(st.writes) + '</b>' : '') + '</td><td>' + srcCell(st) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    if ((s.example || []).length) {
      t += '<div class="ct">一筆範例資料</div>' + (s.exampleCase ? '<p>' + inl(s.exampleCase) + '</p>' : '') + '<table class="sp-t"><thead><tr><th>表</th><th>新增／修改</th><th>這一列</th><th>串到</th><th>出處</th></tr></thead><tbody>'
        + s.example.map(function (r) { return '<tr><td><code>' + h(r.table) + '</code></td><td>' + h(r.op || '') + '</td><td>' + inl(r.row || '') + '</td><td>' + inl(r.link || '') + '</td><td>' + srcCell(r) + '</td></tr>'; }).join('') + '</tbody></table>';
    }
    if ((s.failure || []).length) {
      t += '<div class="ct">失敗路徑</div><table class="sp-t"><thead><tr><th>哪一步失敗</th><th>會留下什麼</th><th>怎麼補救</th><th>出處</th></tr></thead><tbody>'
        + s.failure.map(function (f) { return '<tr><td>' + inl(f.when || '') + '</td><td>' + inl(f.leaves || '') + '</td><td>' + inl(f.fix || '') + '</td><td>' + srcCell(f) + '</td></tr>'; }).join('') + '</tbody></table>';
    }
    if (s.recall) t += '<details class="recall"><summary><b>重述題</b>：' + inl(s.recall) + '</summary>' + (s.recallAnswer ? md(s.recallAnswer) : '<p>回到上面的步驟表與範例資料對答案。</p>') + '</details>';
    d.innerHTML = t + '</div>';
    c.appendChild(d); toc += '<a href="#p-' + h(s.id) + '" data-jump="p-' + h(s.id) + '">' + (i + 1) + '. ' + h(s.title || s.id) + '</a>';
  });
  return { node: c, toc: toc };
}
var lgOff = null; // detaches the logic tab's scroll/resize listeners when the view is rebuilt
function viewLogic() {
  var c = document.createDocumentFragment(), toc = '', secs = G.logic || [], stepEls = [];
  if (!secs.length) { var e = document.createElement('p'); e.className = 'empty'; e.textContent = '沒有邏輯導讀。'; c.appendChild(e); return { node: c, toc: toc }; }
  var sc0 = (G.scenarios || [])[0], hd = document.createElement('p'); hd.className = 'meta';
  hd.innerHTML = '跟著情境：' + (G.summary ? inl(G.summary) : h(sc0 ? (sc0.title || sc0.id) : '')); c.appendChild(hd);
  secs.forEach(function (sec) {
    var own = null, ownSc = null;
    (G.scenarios || []).forEach(function (sc) { (sc.stations || []).forEach(function (s) { if (s.id === sec.station) { own = s; ownSc = sc; } }); });
    var d = document.createElement('section'); d.className = 'card'; d.id = 'l-' + sec.id;
    var pre = own ? '<a href="#scenario" data-goto="s-' + h(own.id) + '" title="跳到依情境的這一站"><span class="num">' + h(numbering(ownSc)[own.id]) + '</span>' + h(own.title || own.id) + '</a>　' : '';
    var row = function (k, v) { return v ? '<div><b>' + k + '</b> <span class="v">' + inl(v) + '</span></div>' : ''; };
    var t = '<div class="prose"><h3>' + pre + h(sec.question || sec.id) + '</h3><div class="three">' + row('情境', sec.situation) + row('輸入', sec.input) + '</div></div>';
    d.innerHTML = t;
    var side = document.createElement('div'), left = document.createElement('div'), panel = document.createElement('div');
    side.className = 'lg-side'; left.className = 'lg-steps'; panel.className = 'lg-stick'; side.appendChild(left); side.appendChild(panel);
    var group = [];
    (sec.steps || []).forEach(function (st, i) {
      var box = document.createElement('div'); box.className = 'lg-step';
      box.innerHTML = '<h4><span class="num">' + (i + 1) + '</span>' + h(st.title || '') + '<span class="lg-pin">已固定・再點解除</span></h4>' + md(st.text || '') + '<div class="lg-slot"></div>';
      left.appendChild(box);
      var b = mkBlock(st.hunk, [{ hunk: st.hunk, line: st.line, to: st.to, side: st.side, kind: st.kind, text: st.title || '', step: i + 1 }]);
      if (b) panel.appendChild(b);
      group.push({ box: box, b: b });
    });
    if (group.length) d.appendChild(side);
    group.sec = d; group.pin = -1;
    // click pins a step: scrolling no longer switches it, so the diff on the right can be read; click again to release
    group.forEach(function (s, i) {
      s.box.addEventListener('click', function (e) {
        if (mq.matches || e.target.closest('a') || String(window.getSelection())) return;
        group.pin = group.pin === i ? -1 : i; pickStep();
      });
    });
    var tail = '<div class="prose"><div class="three">' + row('結果', sec.result) + row('交給誰', sec.handoff) + row('失敗時', sec.failure) + '</div></div>';
    d.insertAdjacentHTML('beforeend', tail);
    c.appendChild(d); stepEls.push(group);
    toc += '<a href="#l-' + h(sec.id) + '" data-jump="l-' + h(sec.id) + '">' + h(sec.question || sec.id) + '</a>';
  });
  var mq = window.matchMedia('(max-width:900px)'), raf = 0;
  // room below the last section so its last step can still reach the trigger line
  var pad = document.createElement('div'); pad.className = 'lg-end'; c.appendChild(pad);
  function layout() {
    stepEls.forEach(function (g) { g.forEach(function (s) {
      if (!s.b) return;
      var dest = mq.matches ? s.box.lastChild : s.b._panel; if (s.b.parentNode !== dest) dest.appendChild(s.b);
    }); });
    pickStep();
  }
  // active step = the last one whose top has passed a line at 1/3 of the viewport (a pinned step wins);
  // a pin is released once its section leaves the viewport
  function pickStep() {
    raf = 0; var vh = window.innerHeight, y = vh / 3;
    stepEls.forEach(function (g) {
      if (g.pin >= 0) { var sr = g.sec.getBoundingClientRect(); if (sr.bottom < 0 || sr.top > vh) g.pin = -1; }
      var best = 0;
      if (g.pin >= 0) best = g.pin;
      else g.forEach(function (s, i) { if (s.box.getBoundingClientRect().top <= y) best = i; });
      g.forEach(function (s, i) {
        s.box.classList.toggle('is-active', i === best); s.box.classList.toggle('is-pinned', i === g.pin);
        if (s.b) s.b.style.display = mq.matches || i === best ? '' : 'none';
      });
    });
  }
  stepEls.forEach(function (g) { g.forEach(function (s) { if (s.b) s.b._panel = s.b.parentNode; }); });
  function onScroll() { if (!raf) raf = requestAnimationFrame(pickStep); }
  window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
  if (mq.addEventListener) mq.addEventListener('change', layout);
  lgOff = function () { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (mq.removeEventListener) mq.removeEventListener('change', layout); lgOff = null; };
  setTimeout(layout, 0); // after the node is attached, so rects are real
  return { node: c, toc: toc };
}
var FSORT = lsGet('dg.fsort', 'kind');
var KINDS = ['前端', '後端', '資料模型', '其他'];
// '資料庫' is the pre-0.1.116 name of '資料模型'
function normKind(k) { return k === '資料庫' ? '資料模型' : k; }
function globRe(g) { return new RegExp('^' + g.toLowerCase().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\/?/g, '\u0001').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0001/g, '.*') + '$'); }
var KIND_RULES = [];
Object.keys(G.kinds || {}).forEach(function (k) { var nk = normKind(k); if (KINDS.indexOf(nk) >= 0) (G.kinds[k] || []).forEach(function (g) { KIND_RULES.push([globRe(g), nk]); }); });
var KCACHE = {};
function kindOf(p) { return KCACHE[p] || (KCACHE[p] = kindOf0(p)); }
// order: files[path].kind > guide.kinds globs > built-in path/extension guess
function kindOf0(p) {
  var fk = normKind(((G.files || {})[p] || {}).kind); if (KINDS.indexOf(fk) >= 0) return fk;
  var lp = p.toLowerCase(), ext = lp.slice(lp.lastIndexOf('.') + 1);
  for (var i = 0; i < KIND_RULES.length; i++) if (KIND_RULES[i][0].test(lp)) return KIND_RULES[i][1];
  // data model: only explicit names, no loose "model"/"configuration" substrings (useModelForm.ts, ServiceConfiguration.cs)
  if (/\.(models?|schema|types)\.(ts|tsx|js|mjs|cjs)$/.test(lp) || /(^|\/)(models|dtos|entities)\//.test(lp) || /(dto|views|entity)\.cs$/.test(lp)
    || /(^|\/)configurations\/[^/]*configuration\.cs$/.test(lp)) return '資料模型';
  if (/(^|\/)migrations?\//.test(lp) || /modelsnapshot|dbcontext/.test(lp) || /^(sql|edmx|dbml|prisma)$/.test(ext) || /(^|\/)prisma\//.test(lp)) return '資料模型';
  if (/^(js|mjs|cjs|ts)$/.test(ext) && /(^|\/)(server|backend|api|routes|controllers|middlewares?|functions)\//.test(lp)) return '後端';
  if (/^(js|jsx|mjs|cjs|ts|tsx|vue|svelte|css|scss|sass|less|html|htm|cshtml|razor|svg|png|jpe?g|gif|ico|woff2?)$/.test(ext)) return '前端';
  if (/^(cs|vb|fs|csproj|sln|java|kt|scala|go|py|php|rb|rs|c|cpp|h)$/.test(ext)) return '後端';
  return '其他';
}
function dirOf(p) { return p.indexOf('/') >= 0 ? p.slice(0, p.lastIndexOf('/')) : '(root)'; }

// ---- layer views: 整體／前端／後端／資料模型 ----
// a data-model file also belongs to the side its extension says (front-end model files show under 前端)
function sideOf(p) { return /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/i.test(p) ? '前端' : '後端'; }
function inLayer(p, layer) {
  var k = kindOf(p);
  if (layer === '整體') return true;
  if (layer === '資料模型') return k === '資料模型';
  return k === layer || (k === '資料模型' && sideOf(p) === layer);
}
function refInLayer(ref) { var f = refFile(ref); return !!f && inLayer(f.path, LAYER); }
var LAYER_N = {};
['前端', '後端', '資料模型'].forEach(function (l) { LAYER_N[l] = files.filter(function (f) { return inLayer(f.path, l); }).length; });
var HAS_DETAIL = units.some(function (u) { return (u.s.notes || []).some(function (n) { return n.tier === 'detail'; }); });
var LAYERS = ['整體'].concat(G.depth === '概覽' ? [] : ['前端', '後端', '資料模型'].filter(function (l) { return LAYER_N[l]; }));
var LAYER = lsGet('dg.layer', '整體');
if (LAYERS.indexOf(LAYER) < 0) LAYER = '整體'; // a value saved by another report that this one does not have
// 整體 shows core notes only; a layer view adds the detail notes
function visibleNotes(list) { return (list || []).filter(function (n) { return LAYER !== '整體' || (n.tier || 'core') === 'core'; }); }
function layerSelect() {
  if (LAYERS.length < 2) return '';
  return '<label class="layer" title="整體：全部檔案、核心說明。前端／後端／資料模型：只看那一部分，加上細部說明"><select id="layer">'
    + LAYERS.map(function (l) { return '<option value="' + l + '"' + (l === LAYER ? ' selected' : '') + '>' + l + (l === '整體' ? '' : '（' + LAYER_N[l] + ' 檔）') + '</option>'; }).join('') + '</select></label>';
}
function layerHint() {
  if (LAYER === '整體' || HAS_DETAIL) return null;
  var p = document.createElement('p'); p.className = 'layer-hint';
  p.textContent = '這份報告沒有細部說明，重新產生後才有。目前只顯示「' + LAYER + '」的檔案與核心說明。';
  return p;
}
function setLayer(l) {
  LAYER = LAYERS.indexOf(l) >= 0 ? l : '整體'; lsSet('dg.layer', LAYER === '整體' ? '' : LAYER);
  var s = document.getElementById('layer'); if (s) s.value = LAYER;
  cur = null; render();
}
document.addEventListener('change', function (e) { if (e.target.id === 'layer') { setLayer(e.target.value); window.scrollTo(0, 0); } });
// a link to something the current layer hides: go back to 整體 first
function showAll() { if (LAYER === '整體') return false; setLayer('整體'); return true; }

// ---- 看不懂: copy a pointer to the note so the reader can paste it back into the chat ----
function noteRef(btn) {
  var card = btn.closest('.card'), blk = btn.closest('.blk'), nb = btn.closest('.nb');
  var where = '', f = blk && byId[blk.dataset.file];
  if (card && /^s-/.test(card.id)) {
    var sid = card.id.slice(2), st = null, sc0 = null;
    (G.scenarios || []).forEach(function (sc) { (sc.stations || []).forEach(function (s) { if (s.id === sid) { st = s; sc0 = sc; } }); });
    if (st) where = '第 ' + numbering(sc0)[sid] + ' 站「' + (st.title || sid) + '」';
  } else if (card && /^m-/.test(card.id)) where = '機制「' + ((G.mechanisms || []).filter(function (m) { return 'm-' + m.id === card.id; })[0] || {}).title + '」';
  else if (card && /^l-/.test(card.id)) where = '邏輯導讀「' + ((G.logic || []).filter(function (l) { return 'l-' + l.id === card.id; })[0] || {}).question + '」';
  else where = '依檔案';
  var txt = nb ? nb.cloneNode(true) : null; if (txt) { Array.prototype.forEach.call(txt.querySelectorAll('.nk,.xref'), function (x) { x.remove(); }); }
  var gist = txt ? txt.textContent.replace(/\s+/g, ' ').trim() : '';
  if (gist.length > 28) gist = gist.slice(0, 28) + '…';
  return '看不懂：' + where + ' ' + (f ? f.path.slice(f.path.lastIndexOf('/') + 1) : '') + ' ' + btn.dataset.q + (gist ? '（' + gist + '）' : '');
}
function copyText(s, done) {
  function legacy() {
    var ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); done(ok);
  }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(s).then(function () { done(true); }, legacy); else legacy();
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('.nq'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  var s = noteRef(b);
  copyText(s, function (ok) {
    var old = b.textContent; b.textContent = ok ? '已複製，貼回對話即可' : '複製失敗'; b.classList.add('ok');
    if (!ok) window.prompt('複製這段文字，貼回對話：', s);
    setTimeout(function () { b.textContent = old; b.classList.remove('ok'); }, 2200);
  });
});
function viewFiles() {
  var c = document.createDocumentFragment(), toc = '';
  FWRAPS.length = 0;
  var tools = document.createElement('div'); tools.className = 'tools';
  tools.innerHTML = '排序：<select id="fsort"><option value="kind">依類別</option><option value="path">依路徑</option><option value="size">依大小</option></select>';
  c.appendChild(tools);
  var hint = layerHint(); if (hint) c.appendChild(hint);
  var list = files.filter(function (f) { return inLayer(f.path, LAYER); });
  var key = function (f) { return (FSORT === 'kind' ? KINDS.indexOf(kindOf(f.path)) + '\u0000' : '') + dirOf(f.path) + '\u0000' + f.path; };
  if (FSORT === 'size') list.sort(function (a, b) { return (b.additions + b.deletions) - (a.additions + a.deletions); });
  else list.sort(function (a, b) { return key(a) < key(b) ? -1 : 1; }); // sort by dir first so each group stays contiguous
  var max = Math.max.apply(null, [1].concat(files.map(function (f) { return f.additions + f.deletions; })));
  // one file row (main list) + its sidebar link
  function fileRow(f) {
    var refs = refsOf(f), g = (G.files || {})[f.path] || {};
    var wrap = document.createElement('div'); wrap.id = 'file-' + f.id;
    var tot = f.additions + f.deletions, w = Math.max(6, Math.round(90 * tot / max)), aw = tot ? Math.round(100 * f.additions / tot) : 0;
    var flags = (f.generated ? '<span class="flag">產生檔</span>' : '') + (f.large ? '<span class="flag">大修改</span>' : '') + (!refs.length && !g.skip ? '<span class="flag">未提及</span>' : '') + (g.skip ? '<span class="flag">略過</span>' : '');
    var row = document.createElement('div'); row.className = 'frow';
    row.innerHTML = '<span class="rt" style="--c:' + ROLE_C[roleOf(f)] + '">' + h(roleOf(f)) + '</span><span class="nm">' + (FSORT === 'size' ? h(f.path) : fileName(f)) + '</span><span class="meta">' + h(f.status) + '</span><span class="add">+' + f.additions + '</span><span class="del">−' + f.deletions + '</span><span class="bar" style="width:' + w + 'px"><span style="width:100%"><i class="a" style="width:' + aw + '%"></i><i class="d" style="width:' + (100 - aw) + '%"></i></span></span>' + flags
      + '<span class="refs">' + refs.map(function (u) { return '<a href="#' + (u.mech ? 'mech' : 'scenario') + '" data-jump="' + (u.mech ? 'm-' : 's-') + h(u.s.id) + '">' + h(u.s.title || u.s.id) + '</a>'; }).join('') + '</span>' + (g.summary ? '<span class="meta" style="flex-basis:100%">' + inl(g.summary) + '</span>' : '');
    wrap.appendChild(row);
    var holder = document.createElement('div'); wrap.appendChild(holder);
    row.addEventListener('click', function (e) { if (e.target.tagName === 'A') return; openFile(wrap, f); });
    wrap._open = function () { return openFile(wrap, f, true); };
    wrap._f = f; FWRAPS.push(wrap);
    var tree = FSORT !== 'size';
    return { node: wrap, toc: '<a href="#files/' + h(f.id) + '" data-file="' + h(f.id) + '" title="' + h(f.path) + '"' + (tree ? ' class="fl">' + fileName(f) : '>' + fileLabel(f)) + '</a>' };
  }
  // a folder: caret + folder icon + name + file count; its children sit under it, indented. Clicking the header
  // folds it in both the list and the sidebar (FOLD keeps the state across re-renders)
  function dirNode(n, key, parent) {
    var shut = !!FOLD[key], hd = '<span class="cr" aria-hidden="true">▾</span>' + IC_DIR + '<span class="dt">' + h(n.name).replace(/\//g, '/<wbr>') + '</span><span class="cnt">' + n.count + '</span>';
    var d = document.createElement('div'); d.className = 'tdir' + (shut ? ' shut' : ''); d.dataset.dk = key;
    d.innerHTML = '<div class="dir" role="button" tabindex="0" title="' + h(n.path) + '">' + hd + '</div><div class="tkids"></div>';
    var t = '<div class="tdir' + (shut ? ' shut' : '') + '" data-dk="' + h(key) + '"><div class="gdir" role="button" tabindex="0" title="' + h(n.path) + '">' + hd + '</div><div class="tkids">';
    var kids = d.lastChild;
    Object.keys(n.dirs).sort().forEach(function (k) { t += dirNode(n.dirs[k], key + '/' + k, kids); });
    n.files.forEach(function (f) { var r = fileRow(f); kids.appendChild(r.node); t += r.toc; });
    parent.appendChild(d);
    return t + '</div></div>';
  }
  // folders of `fs` as a tree; a folder holding only one folder and no file merges with it ("src/modules")
  function tree(fs, prefix, parent) {
    var root = { name: '', path: '', dirs: {}, files: [], count: 0 };
    fs.forEach(function (f) {
      var seg = f.path.split('/'), n = root; n.count++;
      for (var i = 0; i < seg.length - 1; i++) {
        n = n.dirs[seg[i]] = n.dirs[seg[i]] || { name: seg[i], path: seg.slice(0, i + 1).join('/'), dirs: {}, files: [], count: 0 };
        n.count++;
      }
      n.files.push(f);
    });
    (function squash(n) {
      Object.keys(n.dirs).forEach(function (k) {
        var c0 = n.dirs[k], ks;
        while (!c0.files.length && (ks = Object.keys(c0.dirs)).length === 1) { var c1 = c0.dirs[ks[0]]; c1.name = c0.name + '/' + c1.name; c0 = c1; }
        delete n.dirs[k]; n.dirs[c0.name] = c0; squash(c0);
      });
    })(root);
    var t = '';
    root.files.forEach(function (f) { var r = fileRow(f); parent.appendChild(r.node); t += r.toc; }); // repo-root files first, no folder
    Object.keys(root.dirs).sort().forEach(function (k) { t += dirNode(root.dirs[k], prefix + k, parent); });
    return t;
  }
  if (FSORT === 'size') {
    toc = '<div class="grp">檔案</div>';
    list.forEach(function (f) { var r = fileRow(f); c.appendChild(r.node); toc += r.toc; });
  } else if (FSORT === 'kind') {
    KINDS.forEach(function (k) {
      var fs = list.filter(function (f) { return kindOf(f.path) === k; }); if (!fs.length) return;
      var kh = document.createElement('h3'); kh.className = 'kind'; kh.textContent = k + '（' + fs.length + '）'; c.appendChild(kh);
      toc += '<div class="grp kind">' + h(k) + '（' + fs.length + '）</div>' + tree(fs, k + ':', c);
    });
  } else toc = tree(list, ':', c);
  return { node: c, toc: toc };
}
// folded folders, by "<kind>:<folder path>"; kept while the page is open
var FOLD = {};
function setFold(key, shut) {
  if (shut) FOLD[key] = 1; else delete FOLD[key];
  Array.prototype.forEach.call(document.querySelectorAll('.tdir'), function (d) { if (d.dataset.dk === key) d.classList.toggle('shut', shut); });
  spySoon();
}
function foldClick(e) {
  var hd = e.target.closest && e.target.closest('.tdir>.dir,.tdir>.gdir'); if (!hd) return;
  if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  var d = hd.parentNode; setFold(d.dataset.dk, !d.classList.contains('shut'));
}
document.addEventListener('click', foldClick);
document.addEventListener('keydown', foldClick);
// a jump to a file inside folded folders opens them first
function unfoldTo(el) {
  for (var d = el.parentNode; d && d.classList; d = d.parentNode) if (d.classList.contains('tdir') && d.classList.contains('shut')) setFold(d.dataset.dk, false);
}
var FWRAPS = [];
function openFile(wrap, f, keepOpen, lazy) {
  var holder = wrap.lastChild;
  if (holder.firstChild) { if (keepOpen) return holder.firstChild; holder.innerHTML = ''; return null; }
  var b = fileBlock(f, visibleNotes(allNotesOf(f)));
  holder.appendChild(b);
  if (lazy && io) io.observe(b); else fillBlock(b, true);
  return b;
}
// a whole file, open, with its schema and mapping tables under the header
function fileBlock(f, notes) {
  var b = mkBlock(f.id, notes, { forceOpen: true });
  b.dataset.open = '1';
  b.querySelector('.fh').insertAdjacentHTML('afterend', schemaHtml(f) + mappingHtml(f));
  b.querySelector('.fd').textContent = '收合';
  return b;
}

// ---- side window: one file's whole diff with every note (core and detail), without leaving the current view.
// It stays open: another file's button replaces its content. Closed by ✕, Esc, or a tab / layer change (the page re-renders).
var PEEK = null;
function peekFile(fid) {
  var f = byId[fid]; if (!f) return;
  if (!PEEK) {
    PEEK = document.createElement('aside'); PEEK.className = 'dg-peek'; PEEK.setAttribute('aria-label', '側窗：檔案與全部說明');
    PEEK.innerHTML = '<div class="ph"><span class="nm"></span><button type="button" class="px" title="關閉（Esc）" aria-label="關閉側窗">✕</button></div><div class="pc"></div>';
    PEEK.querySelector('.px').addEventListener('click', closePeek);
    document.body.appendChild(PEEK);
  }
  if (PEEK.dataset.file === fid && !PEEK.hidden) return;
  PEEK.dataset.file = fid; PEEK.hidden = false;
  var nm = PEEK.querySelector('.nm'); nm.textContent = f.path; nm.title = f.path;
  var b = fileBlock(f, allNotesOf(f));
  // the window is too narrow for side-by-side; the floating toolbar and the page-wide buttons leave this block alone
  b._ov = 'inline'; b.querySelector('.tg').textContent = '顯示：單欄';
  BLOCKS.splice(BLOCKS.indexOf(b), 1);
  var pc = PEEK.querySelector('.pc'); pc.innerHTML = ''; pc.appendChild(b); pc.scrollTop = 0;
  fillBlock(b, true);
}
function closePeek() { if (PEEK) { PEEK.hidden = true; PEEK.querySelector('.pc').innerHTML = ''; PEEK.dataset.file = ''; } }
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePeek(); });

// ---- jump (see / mapping): expand file in files tab, highlight the right side's cell ----
function jumpTo(see) {
  var m = /^(.+):(\d+)$/.exec(see); if (!m) return;
  var r = resolve(m[1]); if (!r) return;
  location.hash = '#files/' + r.file.id + '/' + m[2] + (r.hunk ? '/' + r.hunk.id : '');
}
function doJump(fid, line, hid) {
  var wrap = document.getElementById('file-' + fid);
  if (!wrap) { if (showAll()) wrap = document.getElementById('file-' + fid); if (!wrap) return; }
  unfoldTo(wrap);
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
  var hs = (location.hash || (HAS_OV ? '#overview' : '#scenario')).slice(1).split('/'), tab = hs[0] === 'files' || hs[0] === 'mech' || hs[0] === 'logic' || (hs[0] === 'overview' && HAS_OV) || (hs[0] === 'spine' && HAS_SP) ? hs[0] : /^ov-/.test(hs[0]) && HAS_OV ? 'overview' : /^p-/.test(hs[0]) && HAS_SP ? 'spine' : 'scenario';
  if (cur !== tab) {
    BLOCKS.length = 0; if (lgOff) lgOff(); closePeek();
    var v = tab === 'overview' ? viewOverview() : tab === 'spine' ? viewSpine() : tab === 'files' ? viewFiles() : tab === 'mech' ? viewMech() : tab === 'logic' ? viewLogic() : viewScenario();
    var ct = document.getElementById('content'); ct.innerHTML = ''; ct.appendChild(v.node);
    $toc.innerHTML = v.toc; cur = tab; spyOn = null; fitErs();
    Array.prototype.forEach.call(document.querySelectorAll('.tabs a'), function (a) { a.classList.toggle('on', a.dataset.t === tab); });
    var fs = document.getElementById('fsort'); if (fs) { fs.value = FSORT; fs.onchange = function () { FSORT = fs.value; lsSet('dg.fsort', FSORT); cur = null; render(); }; }
  }
  if (tab === 'files' && hs[1]) doJump(hs[1], hs[2], hs[3]);
  else if (!hs[1] && hs[0] && !/^(overview|spine|scenario|files|mech|logic)$/.test(hs[0])) { var el = document.getElementById(hs[0]); if (el) el.scrollIntoView(); }
  spySoon();
}
// a station hidden by the current layer: switch to 整體, then scroll
function scrollToId(id) {
  var el = document.getElementById(id);
  if (!el && showAll()) el = document.getElementById(id);
  if (el) el.scrollIntoView();
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
  var t = e.target.closest ? e.target.closest('[data-see],[data-jump],[data-goto],[data-gosp],[data-all],[data-peek],[data-raw]') : null; if (!t) return;
  if (t.dataset.raw) { var er = t.parentNode, raw = er.classList.toggle('raw'); t.textContent = raw ? '縮小顯示' : '原始大小'; }
  else if (t.dataset.peek) peekFile(t.dataset.peek);
  else if (t.dataset.gosp) { e.preventDefault(); var pid = t.dataset.gosp; if (cur !== 'spine') location.hash = '#spine'; setTimeout(function () { var el = document.getElementById(pid); if (el) el.scrollIntoView(); }, 0); }
  else if (t.dataset.all) { setPanel(false); toggleAll(t.dataset.all === 'open'); }
  else if (t.dataset.see) { e.preventDefault(); jumpTo(t.dataset.see); }
  else if (t.dataset.goto) { e.preventDefault(); var gid = t.dataset.goto; if (cur !== 'scenario') location.hash = '#scenario'; setTimeout(function () { scrollToId(gid); }, 0); }
  else if (t.dataset.jump) {
    var id = t.dataset.jump, want = /^l-/.test(id) ? 'logic' : /^m-/.test(id) ? 'mech' : 'scenario';
    if (t.closest('.dg-toc') || t.closest('.refs')) {
      e.preventDefault();
      var tab = cur === 'files' && t.closest('.refs') ? want : cur;
      if (tab !== cur) { location.hash = '#' + tab; setTimeout(function () { scrollToId(id); }, 0); }
      else scrollToId(id);
    }
  }
});
// ---- sidebar follows the reading position: the link of the section at the top of the screen lights up ----
function tocTarget(a) { return document.getElementById(a.dataset.jump || (a.dataset.file ? 'file-' + a.dataset.file : '')); }
var spyRaf = 0, spyOn = null;
function spy() {
  spyRaf = 0;
  var tb = document.querySelector('.tabbar'), y = (tb ? tb.offsetHeight : 0) + 24, on = null, best = -Infinity, last = null;
  var atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  Array.prototype.forEach.call($toc.querySelectorAll('a'), function (a) {
    var el = tocTarget(a); if (!el || !el.offsetParent || !a.offsetParent) return; // skip folded folders
    var top = el.getBoundingClientRect().top; last = a;
    if (top <= y && top > best) { best = top; on = a; }
  });
  if (atEnd && last) on = last; // the last section may be too short to reach the top
  if (on === spyOn) return;
  if (spyOn) spyOn.classList.remove('on');
  spyOn = on; if (!on) return;
  on.classList.add('on');
  // keep the lit link inside the sidebar's own scroll area, clear of the bottom-left controls
  var r = on.getBoundingClientRect(), t = $toc.getBoundingClientRect();
  if (r.top < t.top + 40 || r.bottom > t.bottom - 140) $toc.scrollTop += r.top - t.top - t.height / 3;
}
function spySoon() { if (!spyRaf) spyRaf = requestAnimationFrame(spy); }
window.addEventListener('scroll', spySoon, { passive: true });
window.addEventListener('resize', spySoon);
$main.innerHTML = head(); syncSeg();
// the layer selector sits bottom-left with the settings button, so it is reachable without scrolling up
document.getElementById('dset').insertAdjacentHTML('afterbegin', layerSelect());
window.addEventListener('hashchange', render);
render();
if (io === null) BLOCKS.forEach(function (b) { fillBlock(b); });
