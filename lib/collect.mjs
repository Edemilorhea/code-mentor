import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { git, tryGit } from './git.mjs';
import { parseDiff, addedFile, finalize } from './diff.mjs';
import { parseMigration, isMigrationPath } from './efmigration.mjs';

export const WORK = '.code-mentor';
const MAX_CONTENT_LINES = 6000;

const refExists = (c, cwd) => !!tryGit(['rev-parse', '--verify', '--quiet', c + '^{commit}'], cwd);

// Used only for MR target fallback; branch comparisons require creation provenance.
export function detectBase(cwd) {
  const head = tryGit(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'], cwd);
  const cands = [head && head.replace('refs/remotes/', ''), 'main', 'master', 'develop', 'origin/main', 'origin/master', 'origin/develop'].filter(Boolean);
  return cands.find((c) => refExists(c, cwd)) || null;
}

function createdBase(cwd, branch) {
  if (branch === 'HEAD') return null;
  const created = tryGit(['reflog', 'show', '--date=unix', '--format=%H%x09%gs%x09%gd', `refs/heads/${branch}`], cwd) || '';
  const match = /^([0-9a-f]+)\tbranch: Created from (.+)\t.+@\{(\d+)\}$/m.exec(created);
  let ref = match?.[2];
  if (ref === 'HEAD') {
    const checkout = tryGit(['reflog', 'show', '--date=unix', '--format=%H%x09%gs%x09%gd', 'HEAD'], cwd) || '';
    const entries = checkout.split('\n').map((line) => line.split('\t')).filter(([hash, subject, selector]) => hash === match[1] && subject?.endsWith(` to ${branch}`) && Math.abs(Number(selector?.match(/@\{(\d+)\}$/)?.[1]) - Number(match[3])) <= 2);
    if (entries.length !== 1) return null;
    ref = /^checkout: moving from (.+) to /.exec(entries[0][1])?.[1];
  }
  if (!ref || ref === 'HEAD' || ref === branch || /^[0-9a-f]{7,40}$/i.test(ref) || !refExists(ref, cwd)) return null;
  return ref;
}

// Run an optional CLI (glab/gh); null when missing or failing.
function cli(cmd, args, cwd) {
  try { return execFileSync(cmd, args, { cwd, encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
}

function mrMeta(iid, cwd) {
  const gl = cli('glab', ['mr', 'view', String(iid), '--output', 'json'], cwd);
  if (gl) try { const j = JSON.parse(gl); return { title: j.title, description: j.description, url: j.web_url, author: j.author?.username, target: j.target_branch }; } catch { /* fall through */ }
  const gh = cli('gh', ['pr', 'view', String(iid), '--json', 'baseRefName,title,body,url,author'], cwd);
  if (gh) try { const j = JSON.parse(gh); return { title: j.title, description: j.body, url: j.url, author: j.author?.login, target: j.baseRefName }; } catch { /* fall through */ }
  return {};
}

function fetchMr(remote, iid, cwd) {
  const local = `refs/code-mentor/mr-${iid}`;
  const errs = [];
  for (const src of [`merge-requests/${iid}/head`, `pull/${iid}/head`]) {
    try { git(['fetch', remote, `+${src}:${local}`], cwd); return local; } catch (e) { errs.push(e.stderr?.toString().trim() || e.message); }
  }
  throw new Error(`無法取得 MR/PR !${iid}（remote ${remote}）：\n${errs.join('\n')}`);
}

export function collect(opts, cwd = process.cwd()) {
  const top = tryGit(['rev-parse', '--show-toplevel'], cwd);
  if (!top) throw new Error('不在 git repo 內');
  const root = path.resolve(top);
  const dir = path.join(cwd, WORK);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.gitignore'), '*\n');

  const flags = ['-M', '--no-color', '--no-textconv', '-U3', ...(opts['keep-cr'] ? [] : ['--ignore-cr-at-eol'])];
  const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd) || 'HEAD';
  let mode, base, headRef = 'HEAD', mb, target, uncommitted = false, text, untracked = [], mr = null;

  if (opts.mr) {
    mode = 'mr';
    const iid = String(opts.mr).replace(/\D/g, '');
    if (!iid) throw new Error('--mr 需要數字 iid');
    const remote = opts.remote || 'origin';
    headRef = fetchMr(remote, iid, cwd);
    mr = { iid: +iid, ...mrMeta(iid, cwd) };
    const tb = opts.target || mr.target;
    let tref;
    if (tb) {
      try { git(['fetch', remote, `+refs/heads/${tb}:refs/remotes/${remote}/${tb}`], cwd); } catch (e) { throw new Error(`無法 fetch ${remote}/${tb}：${e.stderr?.toString().trim() || e.message}`); }
      tref = `${remote}/${tb}`;
      mr.target = tb;
    } else {
      tref = detectBase(cwd);
      if (!tref) throw new Error('找不到目標分支，請加 --target <branch>');
      mr.target = tref;
    }
    base = tref;
    mb = tryGit(['merge-base', base, headRef], cwd);
    if (!mb) throw new Error(`${base} 與 MR 沒有共同祖先`);
    target = `MR !${iid}`;
    text = git(['diff', ...flags, mb, headRef], cwd);
  } else if (opts.range) {
    mode = 'range';
    const [a, b] = opts.range.split('..');
    if (!a || !b) throw new Error('--range 格式需為 a..b');
    base = a; headRef = b; mb = tryGit(['rev-parse', a], cwd) || a; target = `range ${opts.range}`;
    text = git(['diff', ...flags, `${a}..${b}`], cwd);
  } else {
    mode = 'branch';
    base = opts.base || createdBase(cwd, branch);
    if (!base || !refExists(base, cwd)) throw new Error(opts.base ? `找不到 base：${opts.base}` : '無法從本機 reflog 確認此分支的建立基準（reflog 可能已過期或證據不明確），請用 --base <ref> 指定。');
    mb = tryGit(['merge-base', base, 'HEAD'], cwd);
    if (!mb) throw new Error(`${base} 與 HEAD 沒有共同祖先`);
    const same = branch === base.replace(/^origin\//, '');
    if (same) throw new Error(`目前就在基準分支（${branch}），沒有可比較的分支。請切換到其他分支，或用 --mr <iid> 導讀某個 MR。`);
    target = '工作目錄';
    if (opts['no-worktree']) { target = 'HEAD'; text = git(['diff', ...flags, mb, 'HEAD'], cwd); }
    else {
      text = git(['diff', ...flags, mb], cwd);
      uncommitted = !!tryGit(['status', '--porcelain'], cwd);
      untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], cwd).split('\0').filter(Boolean);
    }
  }
  let files = parseDiff(text);
  for (const p of untracked) {
    try {
      const buf = fs.readFileSync(path.join(root, p));
      if (buf.includes(0)) continue; // skip binaries
      files.push(addedFile(p, buf.toString('utf8')));
    } catch { /* unreadable: skip */ }
  }
  // shortcut: uses the current checkout's ignore rules, also in --mr/--range mode; read rules from the target ref if that ever differs.
  const ignored = [];
  if (!opts['include-ignored'] && files.length) {
    let out = '';
    try { out = execFileSync('git', ['check-ignore', '--no-index', '-z', '--stdin'], { cwd, encoding: 'utf8', input: files.map((f) => f.path).join('\0') + '\0', stdio: ['pipe', 'pipe', 'ignore'] }); } catch { /* exit 1 = nothing ignored; other failures: keep all files */ }
    const hit = new Set(out.split('\0').filter(Boolean));
    if (hit.size) { ignored.push(...files.filter((f) => hit.has(f.path)).map((f) => f.path)); files = files.filter((f) => !hit.has(f.path)); }
  }
  finalize(files);

  // Full new-file content so the report can expand context between hunks.
  const worktree = mode === 'branch' && !opts['no-worktree'];
  const headForShow = mode === 'branch' ? 'HEAD' : headRef;
  for (const f of files) {
    if (f.binary || f.generated || f.status === 'added' || f.status === 'deleted') continue;
    let c = null;
    try { c = worktree ? fs.readFileSync(path.join(root, f.path), 'utf8') : git(['show', `${headForShow}:${f.path}`], cwd); } catch { /* missing: no expand */ }
    if (c == null || c.includes('\0')) continue;
    const ls = c.split('\n');
    if (ls[ls.length - 1] === '') ls.pop();
    if (ls.length > MAX_CONTENT_LINES) f.contentTruncated = true;
    else f.content = ls.map((s) => s.replace(/\r$/, ''));
  }
  // EF migration schema from the added lines of each migration file.
  for (const f of files) {
    if (!isMigrationPath(f.path)) continue;
    const added = f.hunks.flatMap((h) => h.lines).filter((l) => l.t === '+').map((l) => l.s).join('\n');
    try { const s = parseMigration(added); if (s) f.schema = s; } catch { /* unparseable: ignore */ }
  }

  const logRange = mode === 'range' ? opts.range : `${mb}..${headRef}`;
  const commits = (tryGit(['log', '--format=%h%x09%s', logRange], cwd) || '')
    .split('\n').filter(Boolean).map((l) => { const [h, ...s] = l.split('\t'); return { hash: h, subject: s.join('\t') }; });
  const mbFull = tryGit(['rev-parse', mb], cwd) || mb;

  const diff = {
    base, baseline: mbFull.slice(0, 10), target, range: opts.range || null, branch,
    source: { mode, base, head: mode === 'branch' ? branch : headRef, mergeBase: mbFull.slice(0, 10), ...(mr ? { mr } : {}) },
    uncommitted, date: new Date().toISOString().slice(0, 10), commits, files, ignored,
  };
  fs.writeFileSync(path.join(dir, 'diff.json'), JSON.stringify(diff, null, 1));

  const gp = path.join(dir, 'guide.json');
  let created = false;
  if (!fs.existsSync(gp)) {
    const guide = {
      title: mr?.title || '', summary: '', need: mr?.description || '', intent: 'Unknown', outOfScope: [], unknowns: [], evidence: '',
      scenarios: [{ id: 'main', title: '', actor: '', stations: [] }],
      mechanisms: [],
      files: Object.fromEntries(files.map((f) => [f.path, { summary: '', explain: '', skip: '', skipHunks: [] }])),
    };
    fs.writeFileSync(gp, JSON.stringify(guide, null, 2) + '\n');
    created = true;
  }
  return { diff, dir, created };
}
export function table(diff) {
  const rows = [['id', 'status', '+/-', 'flags', 'path', 'hunks']];
  for (const f of diff.files) {
    rows.push([f.id, f.status, `+${f.additions}/-${f.deletions}`,
      [f.generated && 'gen', f.large && 'large', f.binary && 'bin'].filter(Boolean).join(',') || '-', f.path, String(f.hunks.length)]);
  }
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((c, i) => c.padEnd(w[i])).join('  ').trimEnd()).join('\n');
}

export function loadWork(cwd = process.cwd()) {
  const rd = (n) => {
    const p = path.join(cwd, WORK, n);
    if (!fs.existsSync(p)) throw new Error(`找不到 ${WORK}/${n}，請先執行 code-mentor collect`);
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw new Error(`${WORK}/${n} JSON 格式錯誤：${e.message}`); }
  };
  return { diff: rd('diff.json'), guide: rd('guide.json') };
}

// Resolve a file id / hunk id / path to { file, hunk? }.
export function resolveRef(diff, ref) {
  const hm = /^(f\d+)#(\d+)$/.exec(ref);
  if (hm) {
    const f = diff.files.find((x) => x.id === hm[1]);
    const h = f?.hunks.find((x) => x.id === ref);
    return h ? { file: f, hunk: h } : null;
  }
  const f = diff.files.find((x) => x.id === ref || x.path === ref);
  return f ? { file: f } : null;
}

export function show(diff, ref) {
  const r = resolveRef(diff, ref);
  if (!r) throw new Error(`找不到 ${ref}`);
  const out = [];
  const hunks = r.hunk ? [r.hunk] : r.file.hunks;
  out.push(`# ${r.file.id} ${r.file.status} ${r.file.path}${r.file.oldPath && r.file.oldPath !== r.file.path ? ` (from ${r.file.oldPath})` : ''}`);
  for (const h of hunks) {
    out.push(`## ${h.id}  ${h.header}`);
    for (const l of h.lines) {
      const no = l.n != null ? String(l.n).padStart(5) : '     ';
      out.push(`${no} ${l.t}${l.s}`);
    }
  }
  return out.join('\n');
}
