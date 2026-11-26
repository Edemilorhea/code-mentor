#!/usr/bin/env node
import { runCollect, runShow, runCheck, runBuild } from '../lib/run.mjs';
import { createInterface } from 'node:readline/promises';
import { SKILL, AGENT, TARGETS, install, setup, detected, parseTargets } from '../lib/install.mjs';
import { serve } from '../lib/serve.mjs';
import { promptHelp } from '../lib/prompt-help.mjs';

function emit(r) { console.log(r.text); if (!r.ok) process.exitCode = 1; }
const USAGE = `code-mentor — 把 git diff 轉成情境導向的 code 導讀

用法：
  code-mentor collect [--base <ref>] [--range <a..b>] [--mr <iid> [--remote origin] [--target <branch>]] [--no-worktree] [--keep-cr] [--include-ignored] [--new]
  code-mentor show <fileId|hunkId|path> [--dir <dir>]
  code-mentor check [--dir <dir>]
  code-mentor build [--dir <dir>] [--out <dir>] [--force]
  code-mentor serve [--dir <dir>] [--port <n>] [--out <dir>]   （本機預覽，guide.json 存檔就自動更新）

產出位置：.code-mentor/output/docs/<分支名>-<hash>/，每個分支／MR／range 一個資料夾。
同一個來源再跑 collect 會沿用並覆蓋；加 --new 才另開 -2、-3 副本。
show／check／build／serve 預設用最近一次 collect 的資料夾，--dir 可指定。
  code-mentor setup [--target opencode,claude,codex | --all] [--project]
                                         （選擇要裝到哪些 AI 工具；不帶參數時會詢問）
  code-mentor skill install [--project]  （只裝 OpenCode／Codex 共用的 skill）
  code-mentor skill path
  code-mentor agent install [--project]  （OpenCode agent）
  code-mentor agent path
  code-mentor help`;

const BOOL = new Set(['no-worktree', 'keep-cr', 'include-ignored', 'force', 'project', 'new', 'all']);
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

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, opts } = parseArgs(rest);
  switch (cmd) {
    case 'collect': emit(runCollect(opts, process.cwd())); break;
    case 'show': emit(runShow(pos[0], process.cwd(), opts.dir)); break;
    case 'check': emit(runCheck(process.cwd(), opts.dir)); break;
    case 'build': emit(runBuild(opts, process.cwd())); break;
    case 'serve': serve(opts, process.cwd()); break;
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
    case 'setup': return runSetup(opts);
    case undefined: case 'help': case '--help': case '-h':
      console.log(USAGE);
      { const h = promptHelp(); if (h) console.log('\n' + h); }
      break;
    default:
      console.error(`未知指令：${cmd}\n\n${USAGE}`); process.exitCode = 1;
  }
}

// Picks tools from --target / --all, else asks in a terminal (default = detected tools), else uses the detected tools.
async function runSetup(opts) {
  const keys = Object.keys(TARGETS);
  const found = detected();
  let targets;
  if (opts.all) targets = keys;
  else if (opts.target) targets = parseTargets(opts.target);
  else if (process.stdin.isTTY) {
    console.log('要裝到哪些 AI 工具？（* = 本機偵測到）');
    keys.forEach((k, i) => console.log(`  ${i + 1}. ${TARGETS[k].label}${found.includes(k) ? ' *' : ''}`));
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ans = (await rl.question(`輸入編號，用逗號分隔（直接 Enter = ${found.map(k => keys.indexOf(k) + 1).join(',') || '全部'}）：`)).trim();
    rl.close();
    targets = ans ? ans.split(',').map(s => {
      const k = keys[Number(s.trim()) - 1];
      if (!k) throw new Error(`沒有這個編號：${s.trim()}`);
      return k;
    }) : (found.length ? found : keys);
  } else {
    if (!found.length) throw new Error('偵測不到 OpenCode／Claude Code／Codex，請用 --target opencode,claude,codex 或 --all 指定');
    targets = found;
  }
  for (const d of setup([...new Set(targets)], opts.project)) console.log(d);
  console.log(`完成：${targets.map(k => TARGETS[k].label).join('、')}。重啟這些工具後生效；之後升級只要 npm i -g @edemilorhea/code-mentor@latest`);
}

try { await main(); } catch (e) {
  console.error('錯誤：' + (e.stderr?.toString().trim() || e.message));
  process.exitCode = 1;
}
