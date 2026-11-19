import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HELP_FILE = fileURLToPath(new URL('../skill/code-mentor/references/prompt-help.md', import.meta.url));

export const DEPTHS = ['概覽', '導讀', '教學'];
const ALIAS = { '概覽': '概覽', '概览': '概覽', overview: '概覽', '導讀': '導讀', guide: '導讀', '教學': '教學', teach: '教學' };

// Only an exact whitespace-separated token counts, so a sentence that merely contains 教學 is not misread.
export function depthOf(text) {
  for (const t of String(text ?? '').split(/\s+/)) { const d = ALIAS[t.toLowerCase()]; if (d) return d; }
  return null;
}

// Single source of the "how to prompt" text. It lives outside SKILL.md so a normal run does not load it.
export function promptHelp() {
  return fs.readFileSync(HELP_FILE, 'utf8').replace(/\r\n/g, '\n').trim();
}
