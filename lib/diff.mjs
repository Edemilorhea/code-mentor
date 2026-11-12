// Unified diff parser + file flag heuristics.

const unq = (s) => {
  if (s[0] !== '"') return s;
  const str = s.slice(1, s.lastIndexOf('"'));
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c !== '\\') { out.push(...Buffer.from(c)); continue; }
    const n = str[++i];
    if (/[0-7]/.test(n)) {
      let o = n;
      while (o.length < 3 && /[0-7]/.test(str[i + 1] ?? '')) o += str[++i];
      out.push(parseInt(o, 8));
    } else out.push({ n: 10, t: 9, '"': 34, '\\': 92 }[n] ?? n.charCodeAt(0));
  }
  return Buffer.from(out).toString('utf8');
};
const strip = (p, pre) => (p.startsWith(pre) ? p.slice(2) : p);

function startFile(raw) {
  const rest = raw.slice(11);
  const m = rest.match(/^("(?:[^"\\]|\\.)*"|\S+) ("(?:[^"\\]|\\.)*"|\S+)$/);
  let a, b;
  if (m) [a, b] = [m[1], m[2]];
  else { const half = (rest.length - 1) / 2; a = rest.slice(0, half); b = rest.slice(half + 1); }
  return { path: strip(unq(b), 'b/'), oldPath: strip(unq(a), 'a/'), status: 'modified', binary: false, hunks: [] };
}

export function parseDiff(text) {
  const files = [];
  let f = null, h = null, ro = 0, rn = 0, o = 0, n = 0;
  for (const raw of text.split('\n')) {
    if (raw.startsWith('diff --git ')) { f = startFile(raw); files.push(f); h = null; ro = rn = 0; continue; }
    if (!f) continue;
    if (h && (ro > 0 || rn > 0)) {
      const line = raw.replace(/\r$/, '');
      const t = line[0] === '+' || line[0] === '-' ? line[0] : ' ';
      const s = line[0] === '+' || line[0] === '-' || line[0] === ' ' ? line.slice(1) : line;
      if (t === '+') { h.lines.push({ t, o: null, n: n++, s }); rn--; }
      else if (t === '-') { h.lines.push({ t, o: o++, n: null, s }); ro--; }
      else { h.lines.push({ t, o: o++, n: n++, s }); ro--; rn--; }
      continue;
    }
    if (raw[0] === '\\') { if (h?.lines.length) h.lines[h.lines.length - 1].noNewline = true; continue; }
    const hm = raw.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hm) {
      ro = hm[2] === undefined ? 1 : +hm[2]; rn = hm[4] === undefined ? 1 : +hm[4];
      o = +hm[1]; n = +hm[3];
      h = { header: raw.replace(/\r$/, ''), oldStart: o, newStart: n, lines: [] };
      f.hunks.push(h);
    } else if (raw.startsWith('--- ')) {
      const v = raw.slice(4).split('\t')[0];
      if (v !== '/dev/null') f.oldPath = strip(unq(v), 'a/');
    } else if (raw.startsWith('+++ ')) {
      const v = raw.slice(4).split('\t')[0];
      f.path = v === '/dev/null' ? f.oldPath : strip(unq(v), 'b/');
    } else if (raw.startsWith('rename from ')) { f.oldPath = unq(raw.slice(12)); f.status = 'renamed'; }
    else if (raw.startsWith('rename to ')) { f.path = unq(raw.slice(10)); f.status = 'renamed'; }
    else if (raw.startsWith('new file mode')) f.status = 'added';
    else if (raw.startsWith('deleted file mode')) f.status = 'deleted';
    else if (raw.startsWith('Binary files') || raw.startsWith('GIT binary patch')) f.binary = true;
  }
  return files;
}

// Synthesize an all-added file (untracked).
export function addedFile(path, content) {
  const ls = content.split('\n');
  if (ls[ls.length - 1] === '') ls.pop();
  const f = { path, oldPath: null, status: 'added', binary: false, hunks: [] };
  if (ls.length) {
    f.hunks.push({
      header: `@@ -0,0 +1,${ls.length} @@`, oldStart: 0, newStart: 1,
      lines: ls.map((s, i) => ({ t: '+', o: null, n: i + 1, s: s.replace(/\r$/, '') })),
    });
  }
  return f;
}

const GEN = [
  [/\/Migrations\//i, 'EF Migration'],
  [/\.Designer\.cs$/i, 'Designer 產生檔'],
  [/ModelSnapshot\.cs$/i, 'EF ModelSnapshot'],
  [/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|packages\.lock\.json)$/i, 'lockfile'],
  [/\.min\.(js|css)$/i, '壓縮檔'],
  [/\.snap$/i, 'snapshot 檔'],
  [/\.generated\./i, '產生檔'],
];

export function finalize(files) {
  files.forEach((f, i) => {
    f.id = 'f' + (i + 1);
    f.hunks.forEach((h, j) => { h.id = `${f.id}#${j + 1}`; });
    const all = f.hunks.flatMap((h) => h.lines);
    f.additions = all.filter((l) => l.t === '+').length;
    f.deletions = all.filter((l) => l.t === '-').length;
    const p = '/' + f.path;
    const hit = GEN.find(([re]) => re.test(p));
    f.generated = !!hit || (/\.json$/i.test(f.path) && f.additions > 500);
    f.generatedReason = hit ? hit[1] : f.generated ? '大型 JSON' : '';
    f.large = f.additions + f.deletions > 200;
  });
  return files;
}
