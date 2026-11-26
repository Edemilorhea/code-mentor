import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL = fileURLToPath(new URL('../skill/code-mentor', import.meta.url));
export const AGENT = fileURLToPath(new URL('../agent/code-mentor.md', import.meta.url));

// What each AI tool gets. `home` marks the tool as present on this machine; paths are relative to the home dir (global) or cwd (--project).
// OpenCode and Codex both read ~/.agents/skills, so they share one skill copy. Only OpenCode gets the agent:
// Claude Code and Codex invoke the skill directly (/code-mentor, $code-mentor), and Codex agents cannot restrict writes to .code-mentor/.
const SKILL_ITEM = { kind: 'skill', global: '.agents/skills/code-mentor', project: '.agents/skills/code-mentor' };
export const TARGETS = {
  opencode: { label: 'OpenCode', home: '.config/opencode', items: [SKILL_ITEM, { kind: 'agent', global: '.config/opencode/agent/code-mentor.md', project: '.opencode/agent/code-mentor.md' }] },
  claude: { label: 'Claude Code', home: '.claude', items: [{ kind: 'skill', global: '.claude/skills/code-mentor', project: '.claude/skills/code-mentor' }] },
  codex: { label: 'Codex', home: '.codex', items: [SKILL_ITEM] },
};

const destOf = (item, project) => (project ? path.resolve(item.project) : path.join(os.homedir(), item.global));

function copy(kind, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // The skill folder is owned by this tool: clear it first, so a reference file removed or renamed upstream does not linger.
  if (kind === 'skill') fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(kind === 'skill' ? SKILL : AGENT, dest, { recursive: true, force: true });
  return dest;
}

// Copies the bundled skill or agent to the OpenCode global (or --project) location and returns the target path.
export function install(kind, project) {
  return copy(kind, destOf(TARGETS.opencode.items.find(i => i.kind === kind), project));
}

// Tools whose config folder exists in the home dir.
export const detected = () => Object.keys(TARGETS).filter(k => fs.existsSync(path.join(os.homedir(), TARGETS[k].home)));

// "opencode,claude" / "all" -> validated keys.
export function parseTargets(s) {
  const keys = String(s).split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (keys.includes('all')) return Object.keys(TARGETS);
  const bad = keys.filter(k => !TARGETS[k]);
  if (bad.length) throw new Error(`不認得的工具：${bad.join(', ')}（可用：${Object.keys(TARGETS).join(', ')}, all）`);
  return [...new Set(keys)];
}

// Installs everything the chosen tools need, copying a shared destination once. Returns the written paths.
export function setup(targets, project) {
  const done = new Map();
  for (const t of targets) for (const item of TARGETS[t].items) {
    const dest = destOf(item, project);
    if (!done.has(dest)) done.set(dest, copy(item.kind, dest));
  }
  return [...done.values()];
}

// npm postinstall: refresh only the global copies that already exist, so an upgrade never adds a tool the user did not pick.
export function refreshInstalled() {
  const done = new Map();
  for (const t of Object.values(TARGETS)) for (const item of t.items) {
    const dest = destOf(item, false);
    if (!done.has(dest) && fs.existsSync(dest)) done.set(dest, copy(item.kind, dest));
  }
  return [...done.values()];
}
