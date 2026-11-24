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
        body.push(`> 💬 ${n.tier === 'detail' ? '（細部）' : ''}${n.step ? `(${n.step}) ` : ''}[${LABEL[n.kind] || n.kind || 'info'}] ${rg}${n.side === 'old' ? '(舊)' : ''}: ${String(n.text).replace(/\n+/g, ' ')}${n.see ? ` → ${n.see}` : ''}`);
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

  if (guide.features?.length) {
    const sts = new Map((guide.scenarios || []).flatMap((sc) => sc.stations || []).map((s) => [s.id, s.title || s.id]));
    L.push('## 功能總覽', '');
    guide.features.forEach((f, i) => {
      L.push(`### ${i + 1}. ${f.title || ''} ${ST[f.status] || ''}`, '');
      if (f.what) L.push(`- **能做什麼**：${f.what}`);
      if (f.why) L.push(`- **為什麼**：${f.why}`);
      if (f.stations?.length) L.push(`- **看 code**：${f.stations.map((id) => sts.get(id) || id).join('、')}`);
      L.push('');
    });
  }
  if (guide.spines?.length) {
    const sts = new Map((guide.scenarios || []).flatMap((sc) => sc.stations || []).map((s) => [s.id, s.title || s.id]));
    const src = (x) => (x.ref ? `\`${x.ref}\`` : x.unverified ? '未驗證' : '');
    const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    L.push('## 主線', '', '先讀主線看整條路，需要細節再讀下面的站。', '');
    guide.spines.forEach((s, i) => {
      L.push(`### ${i + 1}. ${s.title || s.id}`, '');
      if (s.text) L.push(s.text, '');
      if (s.diagram?.nodes?.length) L.push(mermaid(s.diagram), '');
      if (s.diagramFile) L.push(`[開啟完整圖](${s.diagramFile})`, '');
      if (s.steps?.length) {
        L.push('| # | 檔案 | 做什麼 | 寫入 | 站 | 出處 |', '|---|---|---|---|---|---|');
        s.steps.forEach((st, k) => { const f = diff.files.find((x) => x.id === String(st.file || '').split('#')[0] || x.path === st.file); L.push(`| ${k + 1} | ${cell(f ? f.path : st.file)} | ${cell(st.does)} | ${st.writes ? '⇒ ' + cell(st.writes) : ''} | ${cell(sts.get(st.station) || st.station)} | ${src(st)} |`); });
        L.push('');
      }
      if (s.example?.length) {
        L.push('**一筆範例資料**' + (s.exampleCase ? `：${s.exampleCase}` : ''), '', '| 表 | 新增／修改 | 這一列 | 串到 | 出處 |', '|---|---|---|---|---|');
        s.example.forEach((r) => L.push(`| ${cell(r.table)} | ${cell(r.op)} | ${cell(r.row)} | ${cell(r.link)} | ${src(r)} |`));
        L.push('');
      }
      if (s.failure?.length) {
        L.push('**失敗路徑**', '', '| 哪一步失敗 | 會留下什麼 | 怎麼補救 | 出處 |', '|---|---|---|---|');
        s.failure.forEach((f) => L.push(`| ${cell(f.when)} | ${cell(f.leaves)} | ${cell(f.fix)} | ${src(f)} |`));
        L.push('');
      }
      if (s.recall) L.push(`**重述題**：${s.recall}`, '');
    });
  }
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
      if (s.chain) L.push('**呼叫鏈**', '', '```text', String(s.chain).replace(/\s+$/, ''), '```', '');
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

  if (guide.logic?.length) {
    const title = (id) => (guide.scenarios || []).flatMap((sc) => sc.stations || []).find((s) => s.id === id)?.title || id;
    L.push('## 邏輯導讀', '');
    for (const lg of guide.logic) {
      L.push(`### ${lg.question}`, '', `屬於：${title(lg.station)}`, '');
      if (lg.situation) L.push(`**情境**：${lg.situation}`, '');
      if (lg.input) L.push(`**輸入**：${lg.input}`, '');
      (lg.steps || []).forEach((st, i) => {
        L.push(`**(${i + 1}) ${st.title || ''}**`, '');
        if (st.text) L.push(st.text, '');
        L.push(diffBlock(diff, st.hunk, [{ hunk: st.hunk, line: st.line, to: st.to, side: st.side, kind: st.kind, text: st.title || '' }]));
      });
      if (lg.result) L.push(`**結果**：${lg.result}`, '');
      if (lg.handoff) L.push(`**交給誰**：${lg.handoff}`, '');
      if (lg.failure) L.push(`**失敗時**：${lg.failure}`, '');
    }
  }

  if (guide.mechanisms?.length) {
    L.push('## 機制／架構', '');
    for (const m of guide.mechanisms) {
      L.push(`### ${m.title || m.id}`, '');
      if (m.problem) L.push(`**問題**：${m.problem}`, '');
      if (m.text) L.push(m.text, '');
      if (m.diagram?.nodes?.length) L.push(mermaid(m.diagram), '');
      if (m.diagramFile) L.push(`[開啟完整圖](${m.diagramFile})`, '');
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
