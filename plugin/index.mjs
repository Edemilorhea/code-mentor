import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runCollect, runShow, runCheck, runBuild } from '../lib/run.mjs';

const SKILL_FILE = fileURLToPath(new URL('../skill/code-mentor/SKILL.md', import.meta.url));

function parseSkill(raw) {
  const m = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { description: 'code-mentor', content: raw };
  const d = m[1].match(/^description:\s*(.*)$/m);
  const description = (d?.[1] ?? 'code-mentor').trim().replace(/^(["'])(.*)\1$/, '$2');
  return { description, content: m[2] };
}

const obj = (properties, required) => ({ type: 'object', properties, ...(required ? { required } : {}), additionalProperties: false });
const str = description => ({ type: 'string', description });
const bool = description => ({ type: 'boolean', description });

export default {
  id: 'edemilorhea.code-mentor',
  async setup(ctx) {
    const dir = ctx.location.directory;
    const { description, content } = parseSkill(fs.readFileSync(SKILL_FILE, 'utf8'));

    const skills = await ctx.skill.transform(editor => {
      if (editor.get('code-mentor')) return; // 使用者已用 CLI 安裝
      editor.add({ id: 'code-mentor', name: 'code-mentor', description, path: SKILL_FILE, content });
    });

    const wrap = fn => async input => {
      try {
        const r = fn(input ?? {});
        return { content: r.text + (r.ok ? '' : '\n\n（失敗）') };
      } catch (e) {
        return { content: '錯誤：' + (e.stderr?.toString().trim() || e.message) };
      }
    };

    const tools = await ctx.tool.transform(editor => {
      editor.namespace({ name: 'code_mentor', description: 'code-mentor：把 git diff 做成情境導向 code 導讀的工具。' });
      const add = (name, description, input, run) => editor.add({
        name, description, options: { codemode: false, namespace: 'code_mentor' }, input, execute: wrap(run),
      });

      add('collect', '比對分支／MR／range，寫出 .code-mentor/diff.json 與 guide.json 骨架，回傳檔案表格。',
        obj({
          base: str('比對基準 ref'),
          range: str('a..b 形式的範圍'),
          mr: str('MR／PR 編號（GitLab iid 或 GitHub PR 號碼）'),
          remote: str('MR 使用的 remote（預設 origin）'),
          target: str('MR 目標分支（抓不到 MR 資訊時使用）'),
          noWorktree: bool('只比到 HEAD，不含未 commit 的修改'),
          includeIgnored: bool('保留符合 .gitignore 的檔案'),
          keepCr: bool('保留 CR 字元'),
        }),
        i => {
          const opts = {};
          for (const k of ['base', 'range', 'mr', 'remote', 'target']) if (i[k] != null) opts[k] = String(i[k]);
          if (i.noWorktree) opts['no-worktree'] = true;
          if (i.includeIgnored) opts['include-ignored'] = true;
          if (i.keepCr) opts['keep-cr'] = true;
          return runCollect(opts, dir);
        });

      add('show', '顯示指定檔案或 hunk 的 diff 內容。',
        obj({ ref: str('fileId、hunkId（f3#2）或路徑') }, ['ref']),
        i => runShow(i.ref, dir));

      add('check', '檢查 guide.json 是否涵蓋 diff 並符合格式，回傳錯誤與警告。',
        obj({}), () => runCheck(dir));

      add('build', '先 check，通過後產生單檔離線 index.html 與 guide.md 並回傳路徑。',
        obj({ out: str('輸出目錄（預設 .code-mentor/out）'), force: bool('check 有錯誤時仍強制 build') }),
        i => runBuild({ ...(i.out ? { out: String(i.out) } : {}), force: !!i.force }, dir));
    });

    const commands = await ctx.command.transform(editor => {
      editor.add({
        name: 'code-mentor',
        description: '把目前分支／MR 的修改做成 code 導讀 HTML',
        execute: async invocation => {
          const argument = String(invocation.prompt?.text ?? '').trim();
          const res = await ctx.skill.list();
          const list = Array.isArray(res) ? res : (res?.data ?? []);
          const has = id => (list.some(s => s.id === id || s.name === id) ? '有' : '沒有');
          const text = `載入 code-mentor skill，照它的流程導讀這次修改。使用者需求：${argument || '導讀目前分支'}

本機偵測到的 skill（由 plugin 判斷，不要再自己猜）：
- implementation-understanding-tutor：${has('implementation-understanding-tutor')}
- change-understanding-review：${has('change-understanding-review')}
- diagram-design：${has('diagram-design')}

依 code-mentor skill 第 0 節「內容大腦」選擇路徑。操作 diff 一律用 code_mentor 工具（collect、show、check、build），不要另外用 shell 呼叫 code-mentor CLI。`;
          await ctx.session.prompt({ sessionID: invocation.sessionID, text, delivery: invocation.delivery });
        },
      });
    });

    return async () => {
      await commands.dispose();
      await tools.dispose();
      await skills.dispose();
    };
  },
};
