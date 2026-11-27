import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HELP_FILE = fileURLToPath(new URL('../skill/code-mentor/references/prompt-help.md', import.meta.url));

export const DEPTHS = ['概覽', '導讀', '教學'];
// what a report of each depth contains: shown in the report badge (HTML) and the guide.md header
export const DEPTH_INFO = {
  '概覽': '小功能或簡單修改：每站三句說明，沒有行註解。',
  '導讀': '較大的功能：逐段行註解、呼叫鏈、主線與必要的機制。',
  '教學': '導讀全部內容，加上語法說明、規則說明與邏輯導讀分頁。',
};
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
