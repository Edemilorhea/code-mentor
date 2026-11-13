// npm postinstall: on a global install, refresh the skill and agent so `npm i -g` alone upgrades everything.
// Local/dev installs are skipped so a project dependency never writes into the user's home.
// Never fail the install: a copy error only prints a hint.
import { install } from './install.mjs';

if (process.env.npm_config_global === 'true' && !process.env.CODE_MENTOR_SKIP_SETUP) {
  try {
    console.log('code-mentor: 已更新 ' + install('skill') + '\ncode-mentor: 已更新 ' + install('agent') + '\ncode-mentor: 重啟 OpenCode 後生效');
  } catch (e) {
    console.warn('code-mentor: 自動安裝 skill/agent 失敗（' + e.message + '），請手動執行 code-mentor setup');
  }
}
