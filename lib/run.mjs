import fs from 'node:fs';
import path from 'node:path';
import { collect, table, loadWork, show, WORK } from './collect.mjs';
import { check, report } from './check.mjs';
import { buildHtml } from './build-html.mjs';
import { buildMd } from './build-md.mjs';

export function runCollect(opts, cwd) {
  const { diff, dir, created, reused, legacy, delta } = collect(opts, cwd);
  const out = [
    `基準 ${diff.base}　merge-base ${diff.baseline} → ${diff.target}　${diff.files.length} 個檔案${diff.source?.mr ? `　MR !${diff.source.mr.iid} ${diff.source.mr.title || ''}` : ''}\n`,
    table(diff),
  ];
  if (diff.ignored.length > 0) {
    out.push(`\n已排除 ${diff.ignored.length} 個符合 .gitignore 的檔案（加 --include-ignored 可保留）：`);
    for (const p of diff.ignored.slice(0, 10)) out.push(p);
    if (diff.ignored.length > 10) out.push(`…還有 ${diff.ignored.length - 10} 個`);
  }
  out.push(`\n工作資料夾：${dir}`);
  out.push(reused ? '沿用這個來源既有的資料夾：diff.json 已更新，build 會覆蓋報告（要另開新副本請加 --new）' : '已建立新的資料夾');
  out.push(created ? '已建立 guide.json 骨架' : 'guide.json 已存在，沿用（要整份重做時直接覆寫，不必先讀它）');
  if (delta) out.push(deltaText(delta, diff.files.length));
  if (legacy) out.push(`注意：${path.join(WORK, 'guide.json')} 是舊版位置，已不再使用；請改寫上面工作資料夾裡的 guide.json`);
  return { text: out.join('\n'), ok: true };
}

// What changed since the previous collect, for the update mode of the skill.
function deltaText(d, total) {
  const n = d.added.length + d.changed.length + d.removed.length;
  const out = [`\n和上次 collect 比較（共 ${total} 個檔案）：新增 ${d.added.length}、內容有改 ${d.changed.length}、移除 ${d.removed.length}、只改格式 ${d.format.length}、只有行號移動 ${d.moved.length}`];
  const list = (t, ps) => { if (ps.length) out.push(t + '：', ...ps.map((p) => '  ' + p)); };
  list('新增', d.added); list('內容有改', d.changed); list('移除', d.removed); list('只改格式', d.format);
  if (d.moved.length) out.push(`只有行號移動的 ${d.moved.length} 個檔案，註解行號已自動跟著移動`);
  if (d.n) out.push(`guide.json 已更新 ${d.n} 個參照到新的檔案 id 與行號（移除檔的參照改成 gone:…，check 會指出來）`);
  if (!n && !d.format.length && !d.moved.length) out.push('沒有任何檔案變動');
  if (n * 2 > total) out.push('變動超過一半：先問使用者要不要重做導讀');
  return out.join('\n');
}

export function runShow(ref, cwd, dir) {
  if (!ref) throw new Error('用法：code-mentor show <fileId|hunkId|path>');
  return { text: show(loadWork(cwd, dir).diff, ref), ok: true };
}

export function runCheck(cwd, dir) {
  const w = loadWork(cwd, dir);
  const r = check(w.diff, w.guide);
  return { text: `工作資料夾：${w.dir}\n${report(r)}`, ok: r.errors.length === 0 };
}

export function runBuild(opts, cwd) {
  const w = loadWork(cwd, opts.dir);
  const r = check(w.diff, w.guide);
  const out = [`工作資料夾：${w.dir}`];
  if (r.errors.length || r.warnings.length) out.push(report(r));
  if (r.errors.length && !opts.force) {
    out.push('check 有錯誤，中止 build（可用 --force 強制）');
    return { text: out.join('\n'), ok: false };
  }
  const dir = opts.out ? path.resolve(cwd, opts.out) : w.dir;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildHtml(w.diff, w.guide));
  fs.writeFileSync(path.join(dir, 'guide.md'), buildMd(w.diff, w.guide));
  out.push(path.join(dir, 'index.html'), path.join(dir, 'guide.md'));
  return { text: out.join('\n'), ok: true };
}
