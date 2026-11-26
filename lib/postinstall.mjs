// npm postinstall: on a global install, refresh the skill and agent copies already installed, so `npm i -g` alone upgrades everything.
// A first install writes nothing (npm cannot ask which tools to use); it only points to `code-mentor setup`.
// Local/dev installs are skipped so a project dependency never writes into the user's home.
// Never fail the install: a copy error only prints a hint.
import { refreshInstalled } from './install.mjs';

if (process.env.npm_config_global === 'true' && !process.env.CODE_MENTOR_SKIP_SETUP) {
  try {
    const done = refreshInstalled();
    console.log(done.length
      ? done.map(d => 'code-mentor: 已更新 ' + d).join('\n') + '\ncode-mentor: 重啟 AI 工具後生效'
      : 'code-mentor: 執行 code-mentor setup，選擇要裝到 OpenCode／Claude Code／Codex');
  } catch (e) {
    console.warn('code-mentor: 自動更新 skill/agent 失敗（' + e.message + '），請手動執行 code-mentor setup');
  }
}
