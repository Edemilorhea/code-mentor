#!/usr/bin/env node
import { runCollect, runShow, runCheck, runBuild } from '../lib/run.mjs';
import { SKILL, AGENT, install } from '../lib/install.mjs';

function emit(r) { console.log(r.text); if (!r.ok) process.exitCode = 1; }
const USAGE = `code-mentor — 把 git diff 轉成情境導向的 code 導讀

用法：
  code-mentor collect [--base <ref>] [--range <a..b>] [--mr <iid> [--remote origin] [--target <branch>]] [--no-worktree] [--keep-cr] [--include-ignored]
  code-mentor show <fileId|hunkId|path>
  code-mentor check
  code-mentor build [--out <dir>] [--force]
  code-mentor setup [--project]          （一次裝好 skill + agent）
  code-mentor skill install [--project]
  code-mentor skill path
  code-mentor agent install [--project]
  code-mentor agent path
  code-mentor help`;

const BOOL = new Set(['no-worktree', 'keep-cr', 'include-ignored', 'force', 'project']);
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
    case 'collect': emit(runCollect(opts, process.cwd())); break;
    case 'show': emit(runShow(pos[0], process.cwd())); break;
    case 'check': emit(runCheck(process.cwd())); break;
    case 'build': emit(runBuild(opts, process.cwd())); break;
    case 'agent': {
      if (pos[0] === 'path') { console.log(AGENT); break; }
      if (pos[0] !== 'install') throw new Error('用法：code-mentor agent install [--project] | agent path');
      console.log(install('agent', opts.project));
      break;
    }
    case 'skill': {
      if (pos[0] === 'path') { console.log(SKILL); break; }
      if (pos[0] !== 'install') throw new Error('用法：code-mentor skill install [--project] | skill path');
      console.log(install('skill', opts.project));
      break;
    }
    case 'setup':
      console.log(install('skill', opts.project));
      console.log(install('agent', opts.project));
      console.log('完成。重啟 OpenCode 後生效；之後升級只要 npm i -g @edemilorhea/code-mentor@latest');
      break;
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
