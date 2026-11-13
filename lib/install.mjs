import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL = fileURLToPath(new URL('../skill/code-mentor', import.meta.url));
export const AGENT = fileURLToPath(new URL('../agent/code-mentor.md', import.meta.url));

// Copies the bundled skill or agent to the global (or --project) location and returns the target path.
export function install(kind, project) {
  const src = kind === 'skill' ? SKILL : AGENT;
  const dest = kind === 'skill'
    ? (project ? path.resolve('.agents/skills/code-mentor') : path.join(os.homedir(), '.agents/skills/code-mentor'))
    : (project ? path.resolve('.opencode/agent/code-mentor.md') : path.join(os.homedir(), '.config/opencode/agent/code-mentor.md'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
  return dest;
}
