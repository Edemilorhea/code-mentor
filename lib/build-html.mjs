import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderSvg, renderEr } from './svg.mjs';
import { pairRows } from './sbs.mjs';

const T = (n) => fs.readFileSync(fileURLToPath(new URL('../templates/' + n, import.meta.url)), 'utf8');
const JS_PARTS = ['js-highlight.js', 'js-diff.js', 'js-app.js'];

export function buildHtml(diff, guide) {
  const g = JSON.parse(JSON.stringify(guide));
  for (const m of g.mechanisms || []) m.svg = m.diagram?.nodes?.length ? renderSvg(m.diagram, m.title || m.id) : '';
  const schemas = diff.files.filter((f) => f.schema).flatMap((f) => f.schema.tables);
  g.erSvg = schemas.length ? renderEr(schemas) : '';
  g.erTables = schemas;
  // Embed as JSON; escape < so </script> can never terminate the block.
  const data = JSON.stringify({ diff, guide: g }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const title = String(g.title || 'Code 導讀').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // pairRows is a pure function from lib/sbs.mjs, inlined so the page and the selftest share one implementation.
  const js = `${pairRows.toString()}\n` + JS_PARTS.map(T).join('\n');
  const script = js.replace(/<\/script/gi, '<\\/script');
  return T('report.html')
    .replace('__TITLE__', () => title)
    .replace('/*__CSS__*/', () => T('report.css'))
    .replace('__DATA__', () => data)
    .replace('/*__JS__*/', () => script);
}
