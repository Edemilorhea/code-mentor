import { resolveRef } from './collect.mjs';

const ST = { done: '✅ 已完成', unverified: '⚠️ 未驗證', gap: '❌ 缺口' };
const ICON = { why: '💡', good: '✅', risk: '⚠️', bug: '🐞', info: 'ℹ️', what: '📝', how: '🔧', syntax: '📖' };
const LABEL = { what: '改了什麼', how: '怎麼改', why: '為什麼', syntax: '語法／用法' };
const mid = (s) => String(s ?? '').replace(/["\n\r]/g, ' ').replace(/[\[\](){}|<>]/g, ' ').trim() || '_';

function diffBlock(diff, ref, notes) {
  const r = resolveRef(diff, ref);
  if (!r) return '';
  const f = r.file;
  const hunks = r.hunk ? [r.hunk] : f.hunks;
  const out = [`**${f.path}** (${f.status}, +${f.additions} −${f.deletions}) \`${r.hunk ? r.hunk.id : f.id}\``, ''];
  const body = [];
  for (const h of hunks) {
    body.push('```diff', h.header);
    for (const l of h.lines) body.push(l.t + l.s);
    body.push('```');
    for (const n of notes) {
      if (n.hunk !== h.id && n.hunk !== f.id && n.hunk !== f.path) continue;
      const k = n.side === 'old' ? 'o' : 'n';
      if (h.lines.some((l) => l[k] === n.line)) {
        const rg = n.to > n.line ? `L${n.line}–L${n.to}` : `L${n.line}`;
        body.push(`> 💬 ${n.step ? `(${n.step}) ` : ''}[${LABEL[n.kind] || n.kind || 'info'}] ${rg}${n.side === 'old' ? '(舊)' : ''}: ${String(n.text).replace(/\n+/g, ' ')}${n.see ? ` → ${n.see}` : ''}`);
      }
    }
    body.push('');
  }
  if (f.generated) out.push('<details><summary>展開產生檔 diff</summary>', '', ...body, '</details>', '');
  else out.push(...body);
  return out.join('\n');
}

function unit(diff, s, lines) {
  for (const c of s.callouts || []) lines.push(`> ${ICON[c.kind] || ''} **${c.title || LABEL[c.kind] || c.kind}**`, ...String(c.text || '').split('\n').map((t) => '> ' + t), '');
  for (const ref of s.hunks || []) lines.push(diffBlock(diff, ref, s.notes || []));
}

export function buildMd(diff, guide) {
  const L = [];
  const gf = guide.files || {};
  L.push(`# ${guide.title || 'Code 導讀'}`, '');
  L.push(`> 基準：\`${diff.base}\`（${diff.baseline}）→ ${diff.target}　分支：\`${diff.branch}\`　日期：${diff.date}`, '');
  const mr = diff.source?.mr;
  if (mr) {
    L.push(`> MR !${mr.iid}：${mr.url ? `[${mr.title || mr.iid}](${mr.url})` : mr.title || ''}　作者：${mr.author || '?'}　目標：\`${mr.target || '?'}\``, '');
    if (mr.description) L.push('<details><summary>MR 說明</summary>', '', mr.description, '', '</details>', '');
  }
  if (guide.summary) L.push(guide.summary, '');
  if (guide.need) L.push(`**需求**：${guide.need}（意圖：${guide.intent || 'Unknown'}）`, '');
  const adds = diff.files.reduce((a, f) => a + f.additions, 0), dels = diff.files.reduce((a, f) => a + f.deletions, 0);
  L.push(`共 ${diff.files.length} 個檔案，+${adds} −${dels}`, '');
  if (diff.commits?.length) L.push('<details><summary>Commits</summary>', '', ...diff.commits.map((c) => `- \`${c.hash}\` ${c.subject}`), '', '</details>', '');

  L.push('## 依情境', '');
  for (const sc of guide.scenarios || []) {
    L.push(`### 情境：${sc.title || sc.id}${sc.actor ? `（${sc.actor}）` : ''}`, '');
    let top = 0, sub = 0;
    for (const s of sc.stations || []) {
      let num;
      if (s.parent) num = `${(sc.stations.findIndex((x) => x.id === s.parent) >= 0 ? topNo(sc, s.parent) : '?')}-${String.fromCharCode(97 + sub++)}`;
      else { top++; sub = 0; num = String(top); }
      L.push(`#### ${s.parent ? '↳ ' : ''}${num}. ${s.title || s.id}${s.change ? ` \`${s.change}\`` : ''} ${ST[s.status] || ''}`, '');
      if (s.situation) L.push(`- **情境**：${s.situation}`);
      if (s.purpose) L.push(`- **為了完成**：${s.purpose}`);
      if (s.did) L.push(`- **我做了**：${s.did}`);
      L.push('');
      unit(diff, s, L);
    }
  }

  L.push('## 檔案總覽', '', '| 檔案 | 狀態 | +/− | 說明 |', '|---|---|---|---|');
  for (const f of diff.files) {
    const g = gf[f.path] || {};
    const flags = [f.generated && '產生檔', f.large && '大修改'].filter(Boolean).join('、');
    L.push(`| \`${f.path}\` | ${f.status}${flags ? `（${flags}）` : ''} | +${f.additions} −${f.deletions} | ${String(g.summary || (g.skip ? '略過：' + g.skip : '')).replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
  }
  L.push('');
  for (const f of diff.files.filter((x) => x.generated)) {
    const g = gf[f.path] || {};
    L.push(`### 產生檔：\`${f.path}\``, '', g.summary || '', '', g.explain || '', '');
  }
  for (const f of diff.files) {
    const g = gf[f.path] || {};
    if (f.schema) {
      L.push(`### 資料表變更：\`${f.path}\``, '');
      for (const t of f.schema.tables) {
        L.push(`**${t.name}**（${t.change}${t.seed ? `，種子 ${t.seed} 筆` : ''}）`, '', '| 欄位 | 型別 | Nullable | MaxLength | 異動 |', '|---|---|---|---|---|',
          ...t.columns.map((c) => `| ${c.name} | ${c.type} | ${c.nullable ?? ''} | ${c.maxLength ?? ''} | ${c.change} |`), '');
      }
    }
    if (g.mapping?.length) L.push(`### Entity 設定 ↔ Migration：\`${f.path}\``, '', ...g.mapping.map((m) => `- \`${m.from}\` ↔ \`${m.to}\`：${String(m.text || '').replace(/\n+/g, ' ')}`), '');
  }

  if (guide.mechanisms?.length) {
    L.push('## 機制／架構', '');
    for (const m of guide.mechanisms) {
      L.push(`### ${m.title || m.id}`, '');
      if (m.problem) L.push(`**問題**：${m.problem}`, '');
      if (m.text) L.push(m.text, '');
      if (m.diagram?.nodes?.length) L.push(mermaid(m.diagram), '');
      unit(diff, m, L);
    }
  }

  L.push('## 證據與未知', '');
  if (guide.evidence) L.push(`**證據**：${guide.evidence}`, '');
  if (guide.outOfScope?.length) L.push('**範圍外**', ...guide.outOfScope.map((x) => '- ' + x), '');
  if (guide.unknowns?.length) L.push('**未知**', ...guide.unknowns.map((x) => '- ' + x), '');
  return L.join('\n').replace(/\n{3,}/g, '\n\n');
}

function topNo(sc, id) {
  let n = 0;
  for (const s of sc.stations) { if (!s.parent) n++; if (s.id === id) return n; }
  return '?';
}

function mermaid(d) {
  const ids = new Map(d.nodes.map((n, i) => [n.id, 'n' + i]));
  if (d.type === 'state') {
    const o = ['```mermaid', 'stateDiagram-v2'];
    d.nodes.forEach((n) => o.push(`  state "${mid(n.label)}" as ${ids.get(n.id)}`));
    (d.edges || []).forEach((e) => ids.has(e.from) && ids.has(e.to) && o.push(`  ${ids.get(e.from)} --> ${ids.get(e.to)}${e.label ? ': ' + mid(e.label) : ''}`));
    return o.concat('```').join('\n');
  }
  const o = ['```mermaid', 'flowchart LR'];
  d.nodes.forEach((n) => o.push(`  ${ids.get(n.id)}["${mid(n.label)}"]`));
  (d.edges || []).forEach((e) => ids.has(e.from) && ids.has(e.to) && o.push(`  ${ids.get(e.from)} ${e.dashed ? '-.->' : '-->'}${e.label ? `|${mid(e.label)}|` : ''} ${ids.get(e.to)}`));
  return o.concat('```').join('\n');
}
