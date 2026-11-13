import { resolveRef } from './collect.mjs';

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

export function check(diff, guide) {
  const errors = [], warnings = [];
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
    for (const n of u.s.notes || []) {
      const r = n.hunk && resolveRef(diff, n.hunk);
      if (!r) { errors.push(`${u.label}: note 的 hunk "${n.hunk}" 不存在`); continue; }
      const hs = r.hunk ? [r.hunk] : r.file.hunks;
      const key = n.side === 'old' ? 'o' : 'n';
      if (!hs.some((h) => h.lines.some((l) => l[key] === n.line))) {
        errors.push(`${u.label}: note 的 line ${n.line}（${n.side === 'old' ? 'old' : 'new'}）不在 ${n.hunk} 內`);
      }
      if (n.to != null) {
        if (typeof n.to !== 'number' || n.to < n.line) errors.push(`${u.label}: note 的 to (${n.to}) 必須是 >= line (${n.line}) 的數字`);
        else if (!hs.some((h) => h.lines.some((l) => l[key] === n.to))) errors.push(`${u.label}: note 的 to ${n.to} 不在 ${n.hunk} 內`);
      }
      if (n.see && !seeOk(diff, n.see)) errors.push(`${u.label}: note 的 see "${n.see}" 目標不存在（格式 hunkId:line）`);
    }
    if (u.kind === 'station') {
      if (!u.s.purpose) warnings.push(`${u.label}: 缺少 purpose`);
      if (!u.s.status) warnings.push(`${u.label}: 缺少 status`);
      if (hasCode && !(u.s.notes || []).length && !(u.s.callouts || []).length) warnings.push(`${u.label}: 有程式變更但沒有任何行註解或 callout，讀者看不到改了什麼、為什麼改`);
      const nh = (u.s.hunks || []).length;
      if (nh > 6) warnings.push(`${u.label}: 引用 ${nh} 個區塊，考慮拆成子站（parent）讓每站只講一件事`);
    }
  }
  for (const sc of guide.scenarios || []) {
    const n = (sc.stations || []).filter((s) => !s.parent).length;
    if (n > 7) warnings.push(`情境 ${sc.id}: 主線站數 ${n} > 7`);
  }
  const KINDS = ['前端', '後端', '資料庫', '其他'];
  for (const [k, globs] of Object.entries(guide.kinds || {})) {
    if (!KINDS.includes(k)) errors.push(`kinds 的類別 "${k}" 不合法（只能是 ${KINDS.join('／')}）`);
    else if (!Array.isArray(globs)) errors.push(`kinds["${k}"] 必須是 glob 陣列`);
  }
  for (const p of Object.keys(gfiles)) {
    if (!diff.files.some((f) => f.path === p)) warnings.push(`files["${p}"] 不在 diff 中`);
    const k = gfiles[p].kind;
    if (k !== undefined && !KINDS.includes(k)) errors.push(`files["${p}"].kind "${k}" 不合法（只能是 ${KINDS.join('／')}）`);
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
