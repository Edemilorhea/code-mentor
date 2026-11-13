#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCollect, runShow, runCheck, runBuild } from '../lib/run.mjs';

const SKILL = fileURLToPath(new URL('../skill/code-mentor', import.meta.url));
const AGENT = fileURLToPath(new URL('../agent/code-mentor.md', import.meta.url));
function emit(r) { console.log(r.text); if (!r.ok) process.exitCode = 1; }
const USAGE = `code-mentor — 把 git diff 轉成情境導向的 code 導讀

用法：
  code-mentor collect [--base <ref>] [--range <a..b>] [--mr <iid> [--remote origin] [--target <branch>]] [--no-worktree] [--keep-cr] [--include-ignored]
  code-mentor show <fileId|hunkId|path>
  code-mentor check
  code-mentor build [--out <dir>] [--force]
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
      const dest = opts.project ? path.resolve('.opencode/agent/code-mentor.md') : path.join(os.homedir(), '.config/opencode/agent/code-mentor.md');
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(AGENT, dest);
      console.log(dest);
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
