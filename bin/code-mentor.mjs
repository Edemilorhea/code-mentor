#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect, table, loadWork, show, WORK } from '../lib/collect.mjs';
import { check, report } from '../lib/check.mjs';
import { buildHtml } from '../lib/build-html.mjs';
import { buildMd } from '../lib/build-md.mjs';

const SKILL = fileURLToPath(new URL('../skill/code-mentor', import.meta.url));
const USAGE = `code-mentor — 把 git diff 轉成情境導向的 code 導讀

用法：
  code-mentor collect [--base <ref>] [--range <a..b>] [--mr <iid> [--remote origin] [--target <branch>]] [--no-worktree] [--keep-cr]
  code-mentor show <fileId|hunkId|path>
  code-mentor check
  code-mentor build [--out <dir>] [--force]
  code-mentor skill install [--project]
  code-mentor skill path
  code-mentor help`;

const BOOL = new Set(['no-worktree', 'keep-cr', 'force', 'project']);
function parseArgs(argv) {
  const pos = [], opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (BOOL.has(k)) opts[k] = true;
      else { if (i + 1 >= argv.length) throw new Error(`--${k} 需要參數`); opts[k] = argv[++i]; }
    } else pos.push(a);
  }
  return { pos, opts };
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, opts } = parseArgs(rest);
  switch (cmd) {
    case 'collect': {
      const { diff, dir, created } = collect(opts);
      console.log(`基準 ${diff.base}　merge-base ${diff.baseline} → ${diff.target}　${diff.files.length} 個檔案${diff.source?.mr ? `　MR !${diff.source.mr.iid} ${diff.source.mr.title || ''}` : ''}\n`);
      console.log(table(diff));
      console.log(`\n已寫入 ${path.join(dir, 'diff.json')}${created ? `；已建立 guide.json 骨架` : '；guide.json 已存在，未覆蓋（新檔請自行補進 files）'}`);
      break;
    }
    case 'show': {
      if (!pos[0]) throw new Error('用法：code-mentor show <fileId|hunkId|path>');
      console.log(show(loadWork().diff, pos[0]));
      break;
    }
    case 'check': {
      const { diff, guide } = loadWork();
      const r = check(diff, guide);
      console.log(report(r));
      if (r.errors.length) process.exitCode = 1;
      break;
    }
    case 'build': {
      const { diff, guide } = loadWork();
      const r = check(diff, guide);
      if (r.errors.length || r.warnings.length) console.log(report(r));
      if (r.errors.length && !opts.force) { console.error('check 有錯誤，中止 build（可用 --force 強制）'); process.exitCode = 1; break; }
      const out = path.resolve(opts.out || path.join(WORK, 'out'));
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, 'index.html'), buildHtml(diff, guide));
      fs.writeFileSync(path.join(out, 'guide.md'), buildMd(diff, guide));
      console.log(path.join(out, 'index.html'));
      console.log(path.join(out, 'guide.md'));
      break;
    }
    case 'skill': {
      if (pos[0] === 'path') { console.log(SKILL); break; }
      if (pos[0] !== 'install') throw new Error('用法：code-mentor skill install [--project] | skill path');
      const dest = opts.project ? path.resolve('.agents/skills/code-mentor') : path.join(os.homedir(), '.agents/skills/code-mentor');
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(SKILL, dest, { recursive: true, force: true });
      console.log(dest);
      break;
    }
    case undefined: case 'help': case '--help': case '-h':
      console.log(USAGE); break;
    default:
      console.error(`未知指令：${cmd}\n\n${USAGE}`); process.exitCode = 1;
  }
}

try { main(); } catch (e) {
  console.error('錯誤：' + (e.stderr?.toString().trim() || e.message));
  process.exitCode = 1;
}
