// Build-time SVG diagram renderer: layered left-to-right layout, elbow connectors.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FS = 14, PADX = 16, NH = 36, GAPX = 70, GAPY = 24, MARGIN = 16;
const tw = (s) => [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? FS : FS * 0.58), 0);

export function renderSvg(diagram, title = '流程圖') {
  const nodes = (diagram?.nodes || []).map((n) => ({ ...n, label: String(n.label ?? n.id), w: Math.max(60, Math.ceil(tw(n.label ?? n.id)) + PADX * 2) }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = (diagram?.edges || []).filter((e) => byId.has(e.from) && byId.has(e.to)).map((e) => ({ ...e }));
  if (!nodes.length) return '';

  // DFS to find back edges (cycles)
  const out = new Map(nodes.map((n) => [n.id, []]));
  edges.forEach((e) => out.get(e.from).push(e));
  const state = new Map();
  const dfs = (id) => {
    state.set(id, 1);
    for (const e of out.get(id)) {
      if (e.from === e.to || state.get(e.to) === 1) e.back = true;
      else if (!state.get(e.to)) dfs(e.to);
    }
    state.set(id, 2);
  };
  const hasIn = new Set(edges.map((e) => e.to));
  nodes.filter((n) => !hasIn.has(n.id)).forEach((n) => !state.get(n.id) && dfs(n.id));
  nodes.forEach((n) => !state.get(n.id) && dfs(n.id));

  // rank = longest path from sources over forward edges
  const rank = new Map(nodes.map((n) => [n.id, 0]));
  for (let i = 0; i < nodes.length; i++) {
    let changed = false;
    for (const e of edges) if (!e.back && rank.get(e.to) < rank.get(e.from) + 1) { rank.set(e.to, rank.get(e.from) + 1); changed = true; }
    if (!changed) break;
  }
  const cols = [];
  nodes.forEach((n) => { n.rank = rank.get(n.id); (cols[n.rank] ||= []).push(n); });
  const colW = cols.map((c) => Math.max(...(c || [{ w: 0 }]).map((n) => n.w)));
  const colX = []; let x = MARGIN;
  cols.forEach((_, i) => { colX[i] = x; x += colW[i] + GAPX; });
  const maxRows = Math.max(...cols.map((c) => c?.length || 0));
  const H = maxRows * NH + (maxRows - 1) * GAPY;
  cols.forEach((c, i) => {
    const ch = c.length * NH + (c.length - 1) * GAPY;
    c.forEach((n, j) => { n.x = colX[i] + (colW[i] - n.w) / 2; n.y = MARGIN + (H - ch) / 2 + j * (NH + GAPY); });
  });
  const width = x - GAPX + MARGIN;
  const nBack = edges.filter((e) => e.back).length;
  const height = MARGIN * 2 + H + (nBack ? 30 + nBack * 12 : 0);

  const paths = []; const labels = [];
  let bi = 0;
  const gapCount = new Map();
  edges.forEach((e) => {
    const a = byId.get(e.from), b = byId.get(e.to);
    const dash = e.dashed || e.back ? ' stroke-dasharray="5 4"' : '';
    let d, lx, ly;
    if (e.back) {
      const yb = MARGIN + H + 18 + bi++ * 12;
      const x1 = a.x + a.w / 2 - 6, x2 = b.x + b.w / 2 + 6;
      d = `M${x1} ${a.y + NH} V${yb} H${x2} V${b.y + NH + 2}`;
      lx = (x1 + x2) / 2; ly = yb;
    } else {
      const x1 = a.x + a.w, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2;
      const gi = b.rank; const k = gapCount.get(gi) || 0; gapCount.set(gi, k + 1);
      const mx = x2 - GAPX / 2 + ((k % 5) - 2) * 6;
      d = y1 === y2 && b.rank - a.rank === 1 ? `M${x1} ${y1} H${x2 - 2}` : `M${x1} ${y1} H${mx} V${y2} H${x2 - 2}`;
      lx = b.rank - a.rank === 1 && y1 === y2 ? (x1 + x2) / 2 : mx; ly = y1 === y2 ? y1 : (y1 + y2) / 2;
    }
    paths.push(`<path d="${d}" fill="none" stroke="var(--muted)" stroke-width="1.5"${dash} marker-end="url(#ah)"/>`);
    if (e.label) {
      const w = Math.ceil(tw(e.label)) + 8;
      labels.push(`<rect x="${lx - w / 2}" y="${ly - 9}" width="${w}" height="18" rx="3" fill="var(--card)"/><text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="12" fill="var(--muted)">${esc(e.label)}</text>`);
    }
  });

  const boxes = nodes.map((n) => {
    const k = n.kind || 'normal';
    const st = { focal: ['var(--accent-bg)', 'var(--accent)', ''], external: ['var(--inline-bg)', 'var(--muted)', ''], pending: ['var(--bad-bg)', 'var(--bad)', ' stroke-dasharray="5 4"'], normal: ['var(--card)', 'var(--line)', ''] }[k] || ['var(--card)', 'var(--line)', ''];
    return `<g><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${NH}" rx="9" fill="${st[0]}" stroke="${st[1]}" stroke-width="${k === 'focal' ? 2 : 1.5}"${st[2]}/><text x="${n.x + n.w / 2}" y="${n.y + NH / 2 + 5}" text-anchor="middle" font-size="${FS}" fill="var(--text)"${k === 'focal' ? ' font-weight="700"' : ''}>${esc(n.label)}</text></g>`;
  });

  return `<svg class="diagram" role="img" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" font-family="'Noto Sans TC','Microsoft JhengHei',system-ui,sans-serif"><title>${esc(title)}</title><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>${paths.join('')}${labels.join('')}${boxes.join('')}</svg>`;
}

// ---- ER diagram: table boxes on a simple grid, FK edges between them ----
export function renderEr(tables) {
  const RH = 20, HH = 28, W = 230, GX = 70, GY = 40, M = 16, per = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(tables.length))));
  const col = { added: 'var(--ok)', modified: 'var(--warn)', dropped: 'var(--bad)', renamed: 'var(--warn)' };
  const pos = new Map();
  const rowsH = [];
  tables.forEach((t, i) => {
    const r = Math.floor(i / per), c = i % per;
    rowsH[r] = Math.max(rowsH[r] || 0, HH + Math.max(1, t.columns.length) * RH + 6);
    pos.set(t.name, { r, c, t });
  });
  const rowY = []; let y = M;
  rowsH.forEach((h, r) => { rowY[r] = y; y += h + GY; });
  for (const p of pos.values()) { p.x = M + p.c * (W + GX); p.y = rowY[p.r]; p.h = HH + Math.max(1, p.t.columns.length) * RH + 6; }
  const width = M * 2 + per * W + (per - 1) * GX, height = y - GY + M;
  const out = [];
  const edges = [];
  for (const p of pos.values()) for (const fk of p.t.fks) {
    const q = pos.get(fk.toTable);
    if (!q || q === p) continue;
    const ci = Math.max(0, p.t.columns.findIndex((c) => c.name === fk.column));
    const y1 = p.y + HH + ci * RH + RH / 2, y2 = q.y + HH / 2;
    const right = q.x > p.x, x1 = right ? p.x + W : p.x, x2 = right ? q.x : q.x + W;
    const mx = q.x === p.x ? p.x - 20 : (x1 + x2) / 2;
    const d = q.x === p.x ? `M${p.x} ${y1} H${mx} V${y2} H${q.x}` : `M${x1} ${y1} H${mx} V${y2} H${x2}`;
    edges.push(`<path d="${d}" fill="none" stroke="var(--muted)" stroke-width="1.3" marker-end="url(#ah2)"/>`);
  }
  for (const p of pos.values()) {
    const t = p.t, c = col[t.change] || 'var(--line)', dead = t.change === 'dropped';
    let g = `<g><rect x="${p.x}" y="${p.y}" width="${W}" height="${p.h}" rx="8" fill="var(--card)" stroke="${c}" stroke-width="1.6"/>`
      + `<rect x="${p.x}" y="${p.y}" width="${W}" height="${HH}" rx="8" fill="${c}" fill-opacity=".18"/>`
      + `<text x="${p.x + 10}" y="${p.y + 19}" font-size="13" font-weight="700" fill="var(--text)"${dead ? ' text-decoration="line-through"' : ''}>${esc(t.name)}</text>`
      + `<text x="${p.x + W - 10}" y="${p.y + 19}" font-size="11" text-anchor="end" fill="var(--muted)">${esc(t.change)}</text>`;
    t.columns.forEach((cl, i) => {
      const cy = p.y + HH + i * RH + 14, cc = col[cl.change] || 'var(--text)';
      const badge = [t.pks.includes(cl.name) && 'PK', t.fks.some((f) => f.column === cl.name) && 'FK', t.indexes.some((x) => x.columns.includes(cl.name)) && 'idx'].filter(Boolean).join(' ');
      g += `<text x="${p.x + 10}" y="${cy}" font-size="12" fill="${cc}"${cl.change === 'dropped' ? ' text-decoration="line-through"' : ''}>${esc(cl.name)}</text>`
        + `<text x="${p.x + W - 10}" y="${cy}" font-size="11" text-anchor="end" fill="var(--muted)">${esc([cl.type, badge].filter(Boolean).join('  '))}</text>`;
    });
    out.push(g + '</g>');
  }
  return `<svg class="diagram" role="img" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" font-family="'Noto Sans TC','Microsoft JhengHei',system-ui,sans-serif"><title>資料表變更（由 migration 推出）</title><defs><marker id="ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>${edges.join('')}${out.join('')}</svg>`;
}
