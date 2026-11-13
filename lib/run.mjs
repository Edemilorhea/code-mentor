import fs from 'node:fs';
import path from 'node:path';
import { collect, table, loadWork, show, WORK } from './collect.mjs';
import { check, report } from './check.mjs';
import { buildHtml } from './build-html.mjs';
import { buildMd } from './build-md.mjs';

export function runCollect(opts, cwd) {
  const { diff, dir, created } = collect(opts, cwd);
  const out = [
    `基準 ${diff.base}　merge-base ${diff.baseline} → ${diff.target}　${diff.files.length} 個檔案${diff.source?.mr ? `　MR !${diff.source.mr.iid} ${diff.source.mr.title || ''}` : ''}\n`,
    table(diff),
  ];
  if (diff.ignored.length > 0) {
    out.push(`\n已排除 ${diff.ignored.length} 個符合 .gitignore 的檔案（加 --include-ignored 可保留）：`);
    for (const p of diff.ignored.slice(0, 10)) out.push(p);
    if (diff.ignored.length > 10) out.push(`…還有 ${diff.ignored.length - 10} 個`);
  }
  out.push(`\n已寫入 ${path.join(dir, 'diff.json')}${created ? `；已建立 guide.json 骨架` : '；guide.json 已存在，未覆蓋（新檔請自行補進 files）'}`);
  return { text: out.join('\n'), ok: true };
}

export function runShow(ref, cwd) {
  if (!ref) throw new Error('用法：code-mentor show <fileId|hunkId|path>');
  return { text: show(loadWork(cwd).diff, ref), ok: true };
}

export function runCheck(cwd) {
  const { diff, guide } = loadWork(cwd);
  const r = check(diff, guide);
  return { text: report(r), ok: r.errors.length === 0 };
}

export function runBuild(opts, cwd) {
  const { diff, guide } = loadWork(cwd);
  const r = check(diff, guide);
  const out = [];
  if (r.errors.length || r.warnings.length) out.push(report(r));
  if (r.errors.length && !opts.force) {
    out.push('check 有錯誤，中止 build（可用 --force 強制）');
    return { text: out.join('\n'), ok: false };
  }
  const dir = path.resolve(cwd, opts.out || path.join(WORK, 'out'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), buildHtml(diff, guide));
  fs.writeFileSync(path.join(dir, 'guide.md'), buildMd(diff, guide));
  out.push(path.join(dir, 'index.html'), path.join(dir, 'guide.md'));
  return { text: out.join('\n'), ok: true };
}
