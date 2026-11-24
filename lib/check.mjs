import fs from 'node:fs';
import path from 'node:path';
import { resolveRef } from './collect.mjs';
import { DEPTHS } from './prompt-help.mjs';

// File kinds; '資料庫' is the pre-0.1.116 name of '資料模型' and is still accepted.
const KINDS = ['前端', '後端', '資料模型', '其他', '資料庫'];
// Note tiers: core shows in every view, detail only in the 前端／後端／資料模型 views.
const TIERS = ['core', 'detail'];
// File role tags; must match ROLES in templates/js-diff.js.
const ROLES = ['測試', '產生檔', '前端元件', '前端 Model', '前端 Service', 'API 入口', '後端 Command／Query', '後端 Model', '後端 Service', 'DB 設定', '設定／資料', '其他'];

// Every station + mechanism, with a label for messages.
export function units(guide) {
  const u = [];
  for (const sc of guide.scenarios || []) for (const s of sc.stations || []) u.push({ kind: 'station', label: `情境 ${sc.id}/站 ${s.id}`, s, sc });
  for (const m of guide.mechanisms || []) u.push({ kind: 'mechanism', label: `機制 ${m.id}`, s: m });
  return u;
}

// "<hunkId|fileId>:<line>" must point at a line (new or old number) inside that hunk/file.
export function seeOk(diff, ref) {
  const m = /^(.+):(\d+)$/.exec(String(ref || ''));
  if (!m) return false;
  const r = resolveRef(diff, m[1]);
  if (!r) return false;
  const ln = +m[2];
  return (r.hunk ? [r.hunk] : r.file.hunks).some((h) => h.lines.some((l) => l.n === ln || l.o === ln));
}

// Validate one note-like object (station note or logic step); returns error strings.
export function noteErrors(diff, label, n) {
  const errors = [];
  const r = n.hunk && resolveRef(diff, n.hunk);
  if (!r) return [`${label}: note 的 hunk "${n.hunk}" 不存在`];
  const hs = r.hunk ? [r.hunk] : r.file.hunks;
  const key = n.side === 'old' ? 'o' : 'n';
  if (!hs.some((h) => h.lines.some((l) => l[key] === n.line))) {
    errors.push(`${label}: note 的 line ${n.line}（${n.side === 'old' ? 'old' : 'new'}）不在 ${n.hunk} 內`);
  }
  if (n.to != null) {
    if (typeof n.to !== 'number' || n.to < n.line) errors.push(`${label}: note 的 to (${n.to}) 必須是 >= line (${n.line}) 的數字`);
    else if (!hs.some((h) => h.lines.some((l) => l[key] === n.to))) errors.push(`${label}: note 的 to ${n.to} 不在 ${n.hunk} 內`);
  }
  if (n.see && !seeOk(diff, n.see)) errors.push(`${label}: note 的 see "${n.see}" 目標不存在（格式 hunkId:line）`);
  return errors;
}

// An added line that saves to the database. Only SaveChanges: Add( also matches list.Add and services.AddScoped,
// and a migration changes the schema, not the data.
const SAVE_RE = /\bSaveChanges(Async)?\s*\(/;
export function savesData(diff, ref) {
  const r = resolveRef(diff, ref);
  if (!r || r.file.generated) return false;
  return (r.hunk ? [r.hunk] : r.file.hunks).some((h) => h.lines.some((l) => l.t === '+' && SAVE_RE.test(l.s)));
}

// 主線 (spines): one per user action that writes data, from the button to the tables.
function checkSpines(diff, guide, stationIds, errors, warnings) {
  const sp = guide.spines;
  if (sp !== undefined && !Array.isArray(sp)) { errors.push('spines 必須是陣列'); return; }
  const ids = new Set();
  // evidence: every claim points at code ("ref": "fN#k:line"), or says it is unverified
  const src = (label, x) => {
    if (x.ref !== undefined && !seeOk(diff, x.ref)) errors.push(`${label}: ref "${x.ref}" 目標不存在（格式 hunkId:line）`);
    else if (x.ref === undefined && !x.unverified) warnings.push(`${label}: 沒有出處：填 ref（hunkId:line）指到程式，或設 unverified: true`);
  };
  (sp || []).forEach((s, i) => {
    const id = s.id ?? `#${i + 1}`, L = `主線 ${id}`;
    if (!s.id) errors.push(`${L}: 缺少 id`); else if (ids.has(s.id)) errors.push(`${L}: id 重複`);
    ids.add(s.id);
    if (!String(s.title || '').trim()) errors.push(`${L}: 缺少 title`);
    const steps = Array.isArray(s.steps) ? s.steps : [];
    if (!steps.length) errors.push(`${L}: steps 不可為空`);
    if (!s.diagram?.nodes?.length && !s.diagramFile) warnings.push(`${L}: 缺少 diagram（流程圖），或用 diagramFile 指向細節圖`);
    steps.forEach((st, k) => {
      const l = `${L}/步 ${k + 1}`;
      if (!String(st.does || '').trim()) errors.push(`${l}: 缺少 does`);
      if (st.file !== undefined && !resolveRef(diff, st.file)) errors.push(`${l}: file "${st.file}" 不在 diff 中`);
      if (!st.station) warnings.push(`${l}: 沒有連到任何站（station）`);
      else if (!stationIds.has(st.station)) errors.push(`${l}: station "${st.station}" 不存在`);
      src(l, st);
    });
    if (!steps.some((st) => String(st.writes || '').trim())) warnings.push(`${L}: 沒有任何一步寫了 writes（寫入哪張表）：只讀的操作不需要主線`);
    const ex = s.example;
    if (ex !== undefined && !Array.isArray(ex)) errors.push(`${L}: example 必須是陣列`);
    else if (!(ex || []).length) { if (guide.depth === '教學') warnings.push(`${L}: 缺少 example（一筆範例資料）`); }
    else ex.forEach((r, k) => { const l = `${L}/範例 ${k + 1}`; if (!String(r.table || '').trim()) errors.push(`${l}: 缺少 table`); src(l, r); });
    const fl = s.failure;
    if (fl !== undefined && !Array.isArray(fl)) errors.push(`${L}: failure 必須是陣列`);
    else if (!(fl || []).length) warnings.push(`${L}: 缺少 failure（失敗路徑）`);
    else fl.forEach((f, k) => { const l = `${L}/失敗 ${k + 1}`; if (!String(f.leaves || '').trim()) warnings.push(`${l}: 缺少 leaves（會留下什麼）`); src(l, f); });
    if (!String(s.recall || '').trim()) warnings.push(`${L}: 缺少 recall（重述題）`);
  });
  for (const [i, f] of (guide.features || []).entries()) if (f.spine !== undefined && !ids.has(f.spine)) errors.push(`功能 ${i + 1}: spine "${f.spine}" 不存在`);
  // 教學 with writes and no spine is an error, not a warning: this is how ACM01 went without one.
  // noSpine: "<reason>" exempts a guide whose SaveChanges are not user actions (seed, scripts).
  if (guide.depth === '教學' && !(sp || []).length && !String(guide.noSpine || '').trim() && diff.files.some((f) => savesData(diff, f.id))) {
    errors.push('depth 是「教學」，程式有 SaveChanges（寫入資料），但沒有 spines（主線）：每個會寫入的使用者操作寫一條；確定不是使用者操作時填 noSpine 說明原因');
  }
}

// Same rule as diagLink in templates/js-highlight.js: only diagrams/… relative paths, no "..", no scheme.
export const diagPathOk = (p) => /^diagrams\/[^:\\]+$/.test(p) && !/(^|\/)\.\.(\/|$)/.test(p);
const LINK_RE = /\[([^\]]+)\]\((diagrams\/[^)\s]+)\)/g;

// Diagram files and [text](diagrams/…) links must exist in the work folder. Skipped when no dir is given (selftest).
function checkDiagramFiles(guide, dir, errors) {
  const exists = (p) => !dir || fs.existsSync(path.join(dir, p));
  const owners = [...(guide.spines || []).map((s, i) => [`主線 ${s.id ?? '#' + (i + 1)}`, s]), ...(guide.mechanisms || []).map((m, i) => [`機制 ${m.id ?? '#' + (i + 1)}`, m])];
  for (const [label, o] of owners) {
    if (o.diagramFile === undefined) continue;
    if (!diagPathOk(String(o.diagramFile))) errors.push(`${label}: diagramFile "${o.diagramFile}" 只能是 diagrams/ 開頭的相對路徑`);
    else if (!exists(o.diagramFile)) errors.push(`${label}: diagramFile "${o.diagramFile}" 不存在於工作資料夾`);
  }
  const seen = new Set();
  const walk = (v) => {
    if (typeof v === 'string') { for (const m of v.matchAll(LINK_RE)) if (diagPathOk(m[2]) && !seen.has(m[2])) { seen.add(m[2]); if (!exists(m[2])) errors.push(`連結 [${m[1]}](${m[2]})：檔案不存在於工作資料夾`); } }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(guide);
}

// Built-in diagrams are meant as a quick sketch; long labels and wide fan-outs do not fit the page.
function checkDiagramSize(guide, warnings) {
  const owners = [...(guide.spines || []).map((s, i) => [`主線 ${s.id ?? '#' + (i + 1)}`, s.diagram]), ...(guide.mechanisms || []).map((m, i) => [`機制 ${m.id ?? '#' + (i + 1)}`, m.diagram])];
  for (const [label, d] of owners) {
    if (!d?.nodes?.length) continue;
    for (const n of d.nodes) if ([...String(n.label ?? n.id)].length > 24) warnings.push(`${label}: 節點 ${n.id} 的 label 超過 24 字：Handler 名稱、檔案 id、表名放進 steps，圖只寫「模組＋動作」`);
    const out = new Map();
    for (const e of d.edges || []) {
      if ([...String(e.label || '')].length > 12) warnings.push(`${label}: 邊 ${e.from}→${e.to} 的 label 超過 12 字：只寫編號或留空`);
      (out.get(e.from) || out.set(e.from, []).get(e.from)).push(e);
    }
    for (const [id, es] of out) if (es.length > 3 && es.every((e) => String(e.label || '').trim())) warnings.push(`${label}: 節點 ${id} 連出 ${es.length} 條都有 label 的邊：改用 diagramFile 畫 sequence 圖`);
  }
}

export function check(diff, guide, dir) {
  const errors = [], warnings = [];
  checkDiagramFiles(guide, dir, errors);
  checkDiagramSize(guide, warnings);
  const wholeFile = new Set(), hunkSet = new Set();
  const gfiles = guide.files || {};

  for (const u of units(guide)) {
    let hasCode = false;
    for (const ref of u.s.hunks || []) {
      const r = resolveRef(diff, ref);
      if (!r) { errors.push(`${u.label}: 未知的 hunk/檔案參照 "${ref}"`); continue; }
      if (!r.file.generated) hasCode = true;
      if (r.hunk) hunkSet.add(r.hunk.id); else wholeFile.add(r.file.id);
    }
    const notes = u.s.notes || [];
    for (const n of notes) {
      errors.push(...noteErrors(diff, u.label, n));
      if (n.tier !== undefined && !TIERS.includes(n.tier)) errors.push(`${u.label}: note 的 tier "${n.tier}" 不合法（只能是 core／detail）`);
    }
    if (u.kind === 'station') {
      if (!u.s.purpose) warnings.push(`${u.label}: 缺少 purpose`);
      if (!u.s.status) warnings.push(`${u.label}: 缺少 status`);
      if (u.s.chain !== undefined && typeof u.s.chain !== 'string') errors.push(`${u.label}: chain 必須是字串`);
      const core = notes.filter((n) => (n.tier || 'core') === 'core');
      if (guide.depth !== '概覽' && hasCode && !notes.length && !(u.s.callouts || []).length) warnings.push(`${u.label}: 有程式變更但沒有任何行註解或 callout，讀者看不到改了什麼、為什麼改`);
      else if (guide.depth !== '概覽' && hasCode && notes.length && !core.length && !(u.s.callouts || []).length) warnings.push(`${u.label}: 只有 detail 註解、沒有 core：「整體」檢視看不到這站改了什麼`);
      if (guide.depth === '概覽' && notes.some((n) => n.tier === 'detail')) warnings.push(`${u.label}: depth 是「概覽」卻有 detail 註解`);
      const files = new Set((u.s.hunks || []).map((ref) => resolveRef(diff, ref)?.file.id).filter(Boolean));
      if ((guide.depth === '導讀' || guide.depth === '教學') && files.size >= 2 && !String(u.s.chain || '').trim()) warnings.push(`${u.label}: 跨 ${files.size} 個檔案但沒有 chain（呼叫鏈）`);
      const nh = (u.s.hunks || []).length;
      if (nh > 6) warnings.push(`${u.label}: 引用 ${nh} 個區塊，考慮拆成子站（parent）讓每站只講一件事`);
      // S2: a station whose code saves to the database must say where in its chain ("⇒ 寫入 <表>")
      if (u.s.chain && !String(u.s.chain).includes('⇒') && (u.s.hunks || []).some((ref) => savesData(diff, ref))) warnings.push(`${u.label}: 程式有 SaveChanges，但 chain 沒有任何「⇒ 寫入 <表名>」`);
    }
  }
  for (const sc of guide.scenarios || []) {
    const n = (sc.stations || []).filter((s) => !s.parent).length;
    if (n > 7) warnings.push(`情境 ${sc.id}: 主線站數 ${n} > 7`);
  }
  if (guide.depth !== undefined && !DEPTHS.includes(guide.depth)) errors.push(`depth: 只能是 概覽／導讀／教學，收到「${guide.depth}」`);
  if (guide.depth === '教學' && !(guide.logic || []).length) warnings.push('depth 是「教學」但沒有 logic：核心方法要寫邏輯導讀；這次修改沒有含決策或轉換的方法時可以忽略');
  const stationIds = new Set(units(guide).filter((u) => u.kind === 'station').map((u) => u.s.id));
  const feats = guide.features;
  if (feats !== undefined && !Array.isArray(feats)) errors.push('features 必須是陣列');
  else if (feats?.length) {
    const used = new Set();
    feats.forEach((f, i) => {
      const label = `功能 ${i + 1}`;
      if (!String(f.title || '').trim()) errors.push(`${label}: 缺少 title`);
      if (!String(f.what || '').trim()) warnings.push(`${label}: 缺少 what（使用者能做什麼）`);
      if (!String(f.why || '').trim()) warnings.push(`${label}: 缺少 why（為什麼要做）`);
      if (f.status !== undefined && !['done', 'unverified', 'gap'].includes(f.status)) errors.push(`${label}: status "${f.status}" 不合法（只能是 done／unverified／gap）`);
      for (const id of f.stations || []) { if (!stationIds.has(id)) errors.push(`${label}: station "${id}" 不存在`); used.add(id); }
    });
    const sts = units(guide).filter((u) => u.kind === 'station');
    for (const u of sts) if (u.s.parent && used.has(u.s.id)) used.add(u.s.parent); // a feature pointing at a sub-station covers its parent
    const tops = sts.filter((u) => !u.s.parent).map((u) => u.s.id);
    for (const id of tops) if (!used.has(id)) warnings.push(`站 ${id}: 沒有被任何功能（features）引用：可能是多出來的站，也可能是功能清單漏了`);
  } else if (guide.depth === '導讀' || guide.depth === '教學') warnings.push('缺少 features（功能總覽）：讀者看 code 前無法先確認功能有沒有缺');
  checkSpines(diff, guide, stationIds, errors, warnings);
  const logicIds = new Set();
  for (const [li, lg] of (guide.logic || []).entries()) {
    const id = lg.id ?? `#${li + 1}`;
    if (logicIds.has(lg.id)) errors.push(`邏輯 ${id}: id 重複`);
    logicIds.add(lg.id);
    if (!stationIds.has(lg.station)) errors.push(`邏輯 ${id}: station "${lg.station}" 不存在`);
    if (!String(lg.question || '').trim()) errors.push(`邏輯 ${id}: 缺少 question`);
    const steps = Array.isArray(lg.steps) ? lg.steps : [];
    if (!steps.length) errors.push(`邏輯 ${id}: steps 不可為空`);
    if (steps.length > 8) warnings.push(`邏輯 ${id}: ${steps.length} 步 > 8，考慮拆成兩題`);
    steps.forEach((st, i) => {
      const label = `邏輯 ${id}/步 ${i + 1}`;
      if (!st.hunk) errors.push(`${label}: 缺少 hunk（每一步都要指向程式碼）`);
      else errors.push(...noteErrors(diff, label, st));
      if (!String(st.text || '').trim()) warnings.push(`${label}: 缺少 text`);
    });
  }
  for (const [k, globs] of Object.entries(guide.kinds || {})) {
    if (!KINDS.includes(k)) errors.push(`kinds 的類別 "${k}" 不合法（只能是 ${KINDS.slice(0, 4).join('／')}）`);
    else if (!Array.isArray(globs)) errors.push(`kinds["${k}"] 必須是 glob 陣列`);
  }
  for (const p of Object.keys(gfiles)) {
    if (!diff.files.some((f) => f.path === p)) warnings.push(`files["${p}"] 不在 diff 中`);
    const ro = gfiles[p].role;
    if (ro !== undefined && ro !== '' && !ROLES.includes(ro)) errors.push(`files["${p}"].role "${ro}" 不合法（只能是 ${ROLES.join('／')}）`);
    const k = gfiles[p].kind;
    if (k !== undefined && !KINDS.includes(k)) errors.push(`files["${p}"].kind "${k}" 不合法（只能是 ${KINDS.slice(0, 4).join('／')}）`);
  }

  for (const f of diff.files) {
    const g = gfiles[f.path] || {};
    for (const h of g.skipHunks || []) if (!f.hunks.some((x) => x.id === h)) errors.push(`${f.path}: skipHunks 含未知 hunk "${h}"`);
    for (const [i, m] of (g.mapping || []).entries()) {
      for (const k of ['from', 'to']) if (!seeOk(diff, m[k])) errors.push(`${f.path}: mapping[${i}].${k} "${m[k]}" 目標不存在（格式 hunkId:line）`);
    }
    const skipped = !!(g.skip && g.skip.trim());
    const any = wholeFile.has(f.id) || f.hunks.some((h) => hunkSet.has(h.id));
    if (!skipped && !any) {
      if (f.hunks.length === 0 || !f.hunks.every((h) => (g.skipHunks || []).includes(h.id))) {
        errors.push(`${f.id} ${f.path}: 未被任何站/機制涵蓋（引用它，或在 files 填 skip 原因）`);
      }
    } else if (!skipped && !wholeFile.has(f.id)) {
      const rest = f.hunks.filter((h) => !hunkSet.has(h.id) && !(g.skipHunks || []).includes(h.id));
      if (rest.length) errors.push(`${f.id} ${f.path}: 只引用部分 hunk，其餘未涵蓋：${rest.map((h) => h.id).join(', ')}（引用或列入 skipHunks）`);
    }
    if ((f.generated || f.large) && !(g.summary && g.summary.trim())) errors.push(`${f.id} ${f.path}: ${f.generated ? '產生檔' : '大修改'}缺少 files.summary`);
    if (f.generated && !(g.explain && g.explain.trim())) errors.push(`${f.id} ${f.path}: 產生檔缺少 files.explain（用白話解釋產生碼語法）`);
  }
  return { errors, warnings };
}

export function report({ errors, warnings }) {
  const out = [];
  for (const e of errors) out.push('錯誤: ' + e);
  for (const w of warnings) out.push('警告: ' + w);
  out.push(`${errors.length} 個錯誤、${warnings.length} 個警告`);
  return out.join('\n');
}
