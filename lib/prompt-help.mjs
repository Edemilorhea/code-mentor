import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const SKILL_FILE = fileURLToPath(new URL('../skill/code-mentor/SKILL.md', import.meta.url));

export const DEPTHS = ['概覽', '導讀', '教學'];
const ALIAS = { '概覽': '概覽', '概览': '概覽', overview: '概覽', '導讀': '導讀', guide: '導讀', '教學': '教學', teach: '教學' };

// Only an exact whitespace-separated token counts, so a sentence that merely contains 教學 is not misread.
export function depthOf(text) {
  for (const t of String(text ?? '').split(/\s+/)) { const d = ALIAS[t.toLowerCase()]; if (d) return d; }
  return null;
}

// Single source of the "how to prompt" text: the marked block in SKILL.md.
export function promptHelp() {
  const m = fs.readFileSync(SKILL_FILE, 'utf8').replace(/\r\n/g, '\n').match(/<!-- prompt-help:start -->\n([\s\S]*?)\n<!-- prompt-help:end -->/);
  return m ? m[1].trim() : '';
}
