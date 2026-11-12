// Heuristic EF Core migration parser (Up method only). Returns null when nothing is recognised.
// shortcut: regex based, not a C# parser; verbatim strings and exotic overloads may be missed, upgrade to Roslyn if needed.

// Index after the ')' that closes the '(' at src[i]; string-aware.
function balanced(src, i) {
  let d = 0, inStr = false;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (inStr) { if (c === '\\') k++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '(') d++;
    else if (c === ')' && --d === 0) return k + 1;
  }
  return src.length;
}

const sArg = (s, n) => new RegExp(`\\b${n}:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(s)?.[1];
const bArg = (s, n) => { const m = new RegExp(`\\b${n}:\\s*(true|false)`).exec(s); return m ? m[1] === 'true' : undefined; };
const nArg = (s, n) => { const m = new RegExp(`\\b${n}:\\s*(\\d+)`).exec(s); return m ? +m[1] : undefined; };
const strs = (s) => [...s.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
const colsArg = (s) => strs(/\bcolumns?:\s*(new\s*(?:string)?\[\]\s*\{[^}]*\}|"[^"]*")/.exec(s)?.[1] || '');

function col(name, a, gen, change) {
  const c = { name, type: sArg(a, 'type') || gen || '', change };
  const nu = bArg(a, 'nullable'), ml = nArg(a, 'maxLength');
  if (nu !== undefined) c.nullable = nu;
  if (ml !== undefined) c.maxLength = ml;
  return c;
}

export function parseMigration(text) {
  const um = /void\s+Up\s*\(/.exec(text);
  if (!um) return null;
  let up = text.slice(um.index);
  const dm = /void\s+Down\s*\(/.exec(up);
  if (dm) up = up.slice(0, dm.index);

  const tables = new Map();
  const T = (name, change) => {
    if (!name) return null;
    let t = tables.get(name);
    if (!t) { t = { name, change: change || 'modified', columns: [], pks: [], fks: [], indexes: [], seed: 0 }; tables.set(name, t); }
    else if (change) t.change = change;
    return t;
  };

  const re = /migrationBuilder\s*\.\s*(\w+)\s*(?:<([^()]*)>)?\s*\(/g;
  let m;
  while ((m = re.exec(up))) {
    const op = m[1], gen = m[2]?.trim();
    const open = re.lastIndex - 1, end = balanced(up, open);
    const a = up.slice(open + 1, end - 1);
    re.lastIndex = end;
    const table = sArg(a, 'table');
    switch (op) {
      case 'CreateTable': {
        const t = T(sArg(a, 'name'), 'added');
        if (!t) break;
        const cr = /(\w+)\s*=\s*table\.Column<([^()]*?)>\s*\(/g;
        let c;
        while ((c = cr.exec(a))) {
          const o = cr.lastIndex - 1, e = balanced(a, o);
          t.columns.push(col(c[1], a.slice(o + 1, e - 1), c[2].trim(), 'added'));
          cr.lastIndex = e;
        }
        const pr = /table\.PrimaryKey\s*\(/g;
        let p;
        while ((p = pr.exec(a))) {
          const o = pr.lastIndex - 1, e = balanced(a, o);
          const body = a.slice(o + 1, e - 1).replace(/^\s*"[^"]*"\s*,?/, '');
          t.pks = [...body.matchAll(/\b\w+\.(\w+)/g)].map((x) => x[1]);
        }
        const fr = /table\.ForeignKey\s*\(/g;
        let f;
        while ((f = fr.exec(a))) {
          const o = fr.lastIndex - 1, e = balanced(a, o);
          const body = a.slice(o + 1, e - 1);
          const cm = /column:\s*\w+\s*=>\s*(?:new\s*\{)?[^,)]*?\.(\w+)/.exec(body);
          t.fks.push({ column: cm?.[1] || '', toTable: sArg(body, 'principalTable') || '' });
        }
        break;
      }
      case 'DropTable': T(sArg(a, 'name'), 'dropped'); break;
      case 'AddColumn': T(table)?.columns.push(col(sArg(a, 'name'), a, gen, 'added')); break;
      case 'AlterColumn': T(table)?.columns.push(col(sArg(a, 'name'), a, gen, 'modified')); break;
      case 'DropColumn': T(table)?.columns.push({ name: sArg(a, 'name'), type: '', change: 'dropped' }); break;
      case 'RenameColumn': T(table)?.columns.push({ name: sArg(a, 'newName'), from: sArg(a, 'name'), type: '', change: 'renamed' }); break;
      case 'AddPrimaryKey': { const t = T(table); if (t) t.pks = colsArg(a); break; }
      case 'AddForeignKey': T(table)?.fks.push({ column: colsArg(a)[0] || '', toTable: sArg(a, 'principalTable') || '' }); break;
      case 'CreateIndex': T(table)?.indexes.push({ name: sArg(a, 'name') || '', columns: colsArg(a), unique: bArg(a, 'unique') === true, change: 'added' }); break;
      case 'DropIndex': T(table)?.indexes.push({ name: sArg(a, 'name') || '', columns: [], unique: false, change: 'dropped' }); break;
      case 'InsertData': case 'UpdateData': {
        const t = T(table);
        if (!t) break;
        const v = a.slice(a.search(/\bvalues:/) >= 0 ? a.search(/\bvalues:/) : 0);
        t.seed += /object\[,\]/.test(v) ? (v.match(/\{[^{}]*\}/g) || []).length : 1;
        break;
      }
      default: break;
    }
  }
  return tables.size ? { tables: [...tables.values()] } : null;
}

export const isMigrationPath = (p) => /\/Migrations\//i.test('/' + p) && !/(\.Designer\.cs|ModelSnapshot\.cs)$/i.test(p) && /\.cs$/i.test(p);
