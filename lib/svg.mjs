// Build-time SVG diagram renderer: layered left-to-right layout, elbow connectors.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FS = 14, PADX = 16, NH = 36, LH = 18, GAPX = 70, GAPY = 24, MARGIN = 16;
// node text wraps at MAXT so a node is at most MAXT + 2*PADX (260px) wide; edge labels use 12px text
const MAXT = 260 - PADX * 2, EFS = 12, TRUNK = 10;
const cw = (ch) => (ch.charCodeAt(0) > 0x2e80 ? FS : FS * 0.58);
const tw = (s) => [...String(s)].reduce((w, ch) => w + cw(ch), 0);
const ew = (s) => Math.ceil(tw(s) * EFS / FS) + 10; // edge label box width

// Wraps a label into at most 2 lines of MAXT; the second line ends with … when text is left over.
// Prefers to break after a space or full-width punctuation in the second half of the line.
function wrap(label) {
  const chars = [...label], lines = [];
  let i = 0;
  while (i < chars.length && lines.length < 2) {
    let w = 0, j = i;
    while (j < chars.length && w + cw(chars[j]) <= MAXT) w += cw(chars[j++]);
    if (j < chars.length && lines.length === 0) {
      for (let k = j; k > i + (j - i) / 2; k--) if (/[\s／（）、，]/.test(chars[k - 1])) { j = k; break; }
    }
    lines.push(chars.slice(i, j).join('').trim());
    i = j;
  }
  if (i < chars.length) {
    let l = [...lines[1]];
    while (l.length && tw(l.join('') + '…') > MAXT) l.pop();
    lines[1] = l.join('') + '…';
  }
  return lines;
}

export function renderSvg(diagram, title = '流程圖') {
  const nodes = (diagram?.nodes || []).map((n) => {
    const label = String(n.label ?? n.id), lines = wrap(label);
    return { ...n, label, lines, w: Math.max(60, Math.ceil(Math.max(...lines.map(tw))) + PADX * 2), h: NH + (lines.length - 1) * LH };
  });
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
  // Gap before column r: one vertical trunk per source (lane), then the labels, which sit on the last
  // horizontal segment just before the target. All edges from one source into one column share its trunk.
  const fwd = edges.filter((e) => !e.back);
  const lanes = cols.map(() => []), lblW = cols.map(() => 0);
  fwd.forEach((e) => {
    const r = rank.get(e.to);
    if (!lanes[r].includes(e.from)) lanes[r].push(e.from);
    if (e.label) lblW[r] = Math.max(lblW[r], ew(e.label));
  });
  const LANE0 = 12, LGAP = 6, ARROW = 10;
  const gapW = cols.map((_, r) => Math.max(GAPX, LANE0 + lanes[r].length * TRUNK + (lblW[r] ? LGAP + lblW[r] + ARROW : 0)));
  const colX = []; let x = MARGIN;
  cols.forEach((_, i) => { if (i) x += gapW[i]; colX[i] = x; x += colW[i]; });
  const colH = cols.map((c) => c.reduce((s, n) => s + n.h, 0) + (c.length - 1) * GAPY);
  const H = Math.max(...colH);
  cols.forEach((c, i) => {
    let y = MARGIN + (H - colH[i]) / 2;
    c.forEach((n) => { n.x = colX[i] + (colW[i] - n.w) / 2; n.y = y; y += n.h + GAPY; });
  });
  const width = x + MARGIN;
  const nBack = edges.filter((e) => e.back).length;
  const height = MARGIN * 2 + H + (nBack ? 30 + nBack * 12 : 0);

  const paths = []; const labels = []; const boxesL = [];
  // a label box that would overlap an earlier one moves up until it is clear
  const place = (lx, ly, w) => {
    let y = ly;
    for (let t = 0; t < 20 && boxesL.some((b) => lx < b.x + b.w && lx + w > b.x && y < b.y + 18 && y + 18 > b.y); t++) y -= 20;
    boxesL.push({ x: lx, y, w });
    return y;
  };
  // several edges into one target enter at different heights
  const inCount = new Map(), inIdx = new Map();
  fwd.forEach((e) => inCount.set(e.to, (inCount.get(e.to) || 0) + 1));
  let bi = 0;
  edges.forEach((e) => {
    const a = byId.get(e.from), b = byId.get(e.to);
    const dash = e.dashed || e.back ? ' stroke-dasharray="5 4"' : '';
    let d;
    if (e.back) {
      const yb = MARGIN + H + 18 + bi++ * 12;
      const x1 = a.x + a.w / 2 - 6, x2 = b.x + b.w / 2 + 6;
      d = `M${x1} ${a.y + a.h} V${yb} H${x2} V${b.y + b.h + 2}`;
      if (e.label) { const w = ew(e.label), lx = (x1 + x2) / 2 - w / 2; labels.push([lx, place(lx, yb - 9, w), w, e.label]); }
    } else {
      const r = b.rank, n = inCount.get(e.to), k = inIdx.get(e.to) || 0; inIdx.set(e.to, k + 1);
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2 + (n > 1 ? (k - (n - 1) / 2) * Math.min(10, (b.h - 12) / (n - 1)) : 0);
      const tx = colX[r] - gapW[r] + LANE0 + lanes[r].indexOf(e.from) * TRUNK;
      d = Math.abs(y1 - y2) < 0.5 ? `M${x1} ${y1} H${x2 - 2}` : `M${x1} ${y1} H${tx} V${y2} H${x2 - 2}`;
      // label: right-aligned on the last horizontal segment, LGAP above the line
      if (e.label) { const w = ew(e.label), lx = x2 - ARROW - w; labels.push([lx, place(lx, y2 - LGAP - 18, w), w, e.label]); }
    }
    paths.push(`<path d="${d}" fill="none" stroke="var(--muted)" stroke-width="1.5"${dash} marker-end="url(#ah)"/>`);
  });
  const labelSvg = labels.map(([lx, ly, w, s]) => `<rect x="${lx}" y="${ly}" width="${w}" height="18" rx="3" fill="var(--card)"/><text x="${lx + w / 2}" y="${ly + 13}" text-anchor="middle" font-size="${EFS}" fill="var(--muted)">${esc(s)}</text>`);

  const boxes = nodes.map((n) => {
    const k = n.kind || 'normal';
    const st = { focal: ['var(--accent-bg)', 'var(--accent)', ''], external: ['var(--inline-bg)', 'var(--muted)', ''], pending: ['var(--bad-bg)', 'var(--bad)', ' stroke-dasharray="5 4"'], normal: ['var(--card)', 'var(--line)', ''] }[k] || ['var(--card)', 'var(--line)', ''];
    const y0 = n.y + n.h / 2 - (n.lines.length - 1) * LH / 2 + 5;
    const txt = n.lines.map((l, i) => `<text x="${n.x + n.w / 2}" y="${y0 + i * LH}" text-anchor="middle" font-size="${FS}" fill="var(--text)"${k === 'focal' ? ' font-weight="700"' : ''}>${esc(l)}</text>`).join('');
    // full label in <title>: the browser shows it on hover, also when the visible text is cut with …
    return `<g><title>${esc(n.label)}</title><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="9" fill="${st[0]}" stroke="${st[1]}" stroke-width="${k === 'focal' ? 2 : 1.5}"${st[2]}/>${txt}</g>`;
  });

  return `<svg class="diagram" role="img" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" font-family="'Noto Sans TC','Microsoft JhengHei',system-ui,sans-serif"><title>${esc(title)}</title><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>${paths.join('')}${labelSvg.join('')}${boxes.join('')}</svg>`;
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
