import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { runBuild } from './run.mjs';
import { workDir } from './collect.mjs';

// live reload over SSE; keeps the scroll position across reloads (the report renders lazily, so retry for ~2s)
const LIVE = `<script>(function(){var k='cm.scroll',y=sessionStorage.getItem(k);
if(y!=null){sessionStorage.removeItem(k);y=+y;var n=0,t=setInterval(function(){window.scrollTo(0,y);if(++n>20||Math.abs(window.scrollY-y)<2)clearInterval(t)},100)}
new EventSource('/__events').onmessage=function(){sessionStorage.setItem(k,String(window.scrollY));location.reload()}})()</script>`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const TYPES = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

export function serve(opts, cwd) {
  // resolved once: a later collect on another branch moves .code-mentor/current but must not redirect this server
  const work = workDir(cwd, opts.dir);
  const out = opts.out ? path.resolve(cwd, opts.out) : work;
  if (!fs.existsSync(path.join(work, 'guide.json'))) throw new Error(`找不到 ${path.join(work, 'guide.json')}，先跑 code-mentor collect`);
  const clients = new Set();
  let err = '', timer = null;

  function rebuild() {
    try {
      // force: a guide being written is usually incomplete; check results go to the terminal, not a blocking error
      const r = runBuild({ dir: work, out, force: true }, cwd);
      err = '';
      const warn = r.text.split('\n').find((l) => /錯誤|警告/.test(l));
      console.log(`[${new Date().toLocaleTimeString()}] 已重新 build${warn ? '　' + warn.trim() : ''}`);
    } catch (e) {
      err = e.message; // e.g. guide.json saved mid-write with invalid JSON; keep serving the last good report
      console.error(`[${new Date().toLocaleTimeString()}] build 失敗：${err}`);
    }
    for (const c of clients) c.write('data: reload\n\n');
  }

  rebuild();
  fs.watch(work, (_ev, name) => {
    if (name && name !== 'guide.json') return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 200);
  });

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/__events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': ok\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url === '/' || url === '/index.html') {
      let html;
      try { html = fs.readFileSync(path.join(out, 'index.html'), 'utf8'); } catch { html = '<!doctype html><meta charset="utf-8"><body></body>'; }
      const banner = err ? `<div style="position:fixed;top:0;left:0;right:0;z-index:999;background:#b91c1c;color:#fff;padding:8px 16px;font:13px/1.5 monospace;white-space:pre-wrap">build 失敗（顯示的是上一次成功的版本）：${esc(err)}</div>` : '';
      const i = html.lastIndexOf('</body>');
      html = i < 0 ? html + banner + LIVE : html.slice(0, i) + banner + LIVE + html.slice(i);
      res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }
    // other files under out/ (e.g. diagrams/*.svg); never outside it
    const file = path.resolve(out, '.' + url);
    if (!file.startsWith(out + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });

  const fixed = opts.port != null;
  let port = fixed ? Number(opts.port) : 4173;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`--port 不是有效的 port：${opts.port}`);
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' && !fixed && port < 4173 + 20) { server.listen(++port, '127.0.0.1'); return; }
    console.error(`錯誤：無法開啟 port ${port}（${e.code || e.message}）`);
    process.exit(1);
  });
  server.on('listening', () => console.log(`code-mentor serve：http://127.0.0.1:${port}/\n監看 ${path.join(work, 'guide.json')}，存檔就自動更新；Ctrl+C 停止`));
  server.listen(port, '127.0.0.1'); // localhost only: the report contains source code
}
