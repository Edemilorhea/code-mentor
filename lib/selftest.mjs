import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { collect, loadWork, workDir } from './collect.mjs';
import { runBuild } from './run.mjs';
import { diffDelta, remapGuide } from './delta.mjs';
import { check } from './check.mjs';
import { buildMd } from './build-md.mjs';
import { buildHtml } from './build-html.mjs';
import { depthOf, promptHelp } from './prompt-help.mjs';
import { renderSvg } from './svg.mjs';

// node lib/selftest.mjs
const diff = {
  base: 'a', baseline: 'b', target: 'c', branch: 'x', date: '2026-01-01', commits: [],
  files: [{
    id: 'f1', path: 'a.js', status: 'M', additions: 3, deletions: 0,
    hunks: [{ id: 'f1#1', header: '@@ -0,0 +1,3 @@', lines: [1, 2, 3].map((n) => ({ t: '+', s: 'x' + n, n, o: null })) }],
  }],
};
const base = () => ({
  title: 't',
  scenarios: [{ id: 'sc1', title: 'S', stations: [{ id: 's1', title: 'Station', purpose: 'p', status: 'done', hunks: ['f1#1'], notes: [{ hunk: 'f1#1', line: 1, side: 'new', text: 'n' }] }] }],
});
const step = (o = {}) => ({ title: 'T', text: 'x', hunk: 'f1#1', line: 1, to: 2, side: 'new', kind: 'why', ...o });
const withLogic = (o = {}, steps = [step()]) => ({ ...base(), logic: [{ id: 'l1', station: 's1', question: 'Q?', steps, ...o }] });
const counts = (g) => { const r = check(diff, g); return [r.errors.length, r.warnings.length]; };

assert.deepEqual(counts(base()), [0, 0], 'no logic: unchanged');
assert.deepEqual(counts(withLogic()), [0, 0], 'valid logic');
assert.equal(check(diff, withLogic({ station: 'nope' })).errors.length, 1, 'station missing');
assert.equal(check(diff, withLogic({}, [step({ hunk: 'f9#1' })])).errors.length, 1, 'hunk missing');
assert.equal(check(diff, withLogic({}, [step({ line: 9, to: undefined })])).errors.length, 1, 'line outside');
assert.equal(check(diff, withLogic({}, [step({ line: 2, to: 1 })])).errors.length, 1, 'to < line');
assert.equal(check(diff, withLogic({}, [])).errors.length, 1, 'empty steps');

const bare = () => { const g = base(); delete g.scenarios[0].stations[0].notes; return g; };
assert.equal(check(diff, bare()).warnings.length, 1, 'no notes: warning');
assert.equal(check(diff, { ...bare(), depth: '概覽' }).warnings.length, 0, '概覽 skips no-notes warning');
assert.equal(check(diff, { ...base(), depth: 'x' }).errors.length, 1, 'bad depth');
assert.ok(check(diff, { ...base(), depth: '教學' }).warnings.some((w) => w.includes('logic')), '教學 without logic warns');
assert.ok(!check(diff, { ...withLogic(), depth: '教學' }).warnings.some((w) => w.includes('logic')), '教學 with logic ok');
assert.equal(depthOf('教學 基準用 develop'), '教學');
assert.equal(depthOf('overview MR 123'), '概覽');
assert.equal(depthOf('加深成教學'), null);
assert.equal(depthOf(''), null);
assert.ok(promptHelp().includes('code-mentor 怎麼下 prompt'), 'prompt help block');

// layer views: tier, chain, kind names (資料庫 is the old name of 資料模型)
const diff2 = { ...diff, files: [...diff.files, { id: 'f2', path: 'b.cs', status: 'M', additions: 2, deletions: 0,
  hunks: [{ id: 'f2#1', header: '@@ -0,0 +1,2 @@', lines: [1, 2].map((n) => ({ t: '+', s: 'y' + n, n, o: null })) }] }] };
const st0 = (o = {}) => ({ title: 't', depth: '導讀', features: [{ title: 'F', what: 'w', why: 'y', status: 'done', stations: ['s1'] }], scenarios: [{ id: 'sc1', title: 'S', stations: [{ id: 's1', title: 'Station', purpose: 'p', status: 'done',
  hunks: ['f1#1', 'f2#1'], chain: 'a → b', notes: [{ hunk: 'f1#1', line: 1, text: 'n' }, { hunk: 'f2#1', line: 1, text: 'd', tier: 'detail' }], ...o }] }] });
const warnsOf = (g) => check(diff2, g).warnings;
assert.deepEqual([check(diff2, st0()).errors.length, warnsOf(st0()).length], [0, 0], 'core + detail + chain: clean');
assert.equal(check(diff2, st0({ notes: [{ hunk: 'f1#1', line: 1, text: 'n', tier: 'deep' }] })).errors.length, 1, 'bad tier');
assert.equal(check(diff2, st0({ chain: 3 })).errors.length, 1, 'chain must be a string');
assert.ok(warnsOf(st0({ chain: undefined })).some((w) => w.includes('chain')), '導讀 across 2 files without chain warns');
assert.ok(!warnsOf({ ...st0({ chain: undefined }), depth: '概覽' }).some((w) => w.includes('chain')), '概覽 needs no chain');
assert.ok(warnsOf(st0({ notes: [{ hunk: 'f1#1', line: 1, text: 'd', tier: 'detail' }] })).some((w) => w.includes('只有 detail')), 'detail only warns');
assert.ok(warnsOf({ ...st0(), depth: '概覽' }).some((w) => w.includes('detail')), '概覽 with detail warns');
assert.equal(check(diff2, { ...st0(), kinds: { 資料庫: ['**/*.cs'] }, files: { 'a.js': { kind: '資料庫' } } }).errors.length, 0, 'old kind name 資料庫 accepted');
assert.equal(check(diff2, { ...st0(), kinds: { 資料模型: ['**/*.cs'] } }).errors.length, 0, 'kind 資料模型');
assert.equal(check(diff2, { ...st0(), files: { 'a.js': { kind: 'db' } } }).errors.length, 1, 'unknown kind');
const md2 = buildMd(diff2, st0());
assert.ok(md2.includes('（細部）') && md2.includes('**呼叫鏈**') && md2.includes('a → b'), 'guide.md marks detail notes and prints the chain');
const html2 = buildHtml(diff2, st0());
assert.ok(html2.includes('function visibleNotes(') && html2.includes('function layerSelect('), 'html ships the layer views');

// 功能總覽: features
const ft = (fs0) => ({ ...st0(), features: fs0 });
assert.ok(warnsOf(ft(undefined)).some((w) => w.includes('features')), '導讀 without features warns');
assert.ok(!warnsOf({ ...ft(undefined), depth: '概覽' }).some((w) => w.includes('features')), '概覽 needs no features');
assert.equal(check(diff2, ft([{ title: 'F', what: 'w', why: 'y', stations: ['nope'] }])).errors.length, 1, 'feature points at a missing station');
assert.equal(check(diff2, ft([{ title: 'F', what: 'w', why: 'y', status: 'ok', stations: ['s1'] }])).errors.length, 1, 'bad feature status');
assert.ok(warnsOf(ft([{ title: 'F', what: 'w', why: 'y', stations: [] }])).some((w) => w.includes('沒有被任何功能')), 'station not in any feature warns');
assert.ok(buildMd(diff2, st0()).includes('## 功能總覽'), 'guide.md has the overview');
assert.ok(buildHtml(diff2, st0()).includes('function viewOverview('), 'html ships the overview tab');

// 主線 (spines) and chain ⇒ 寫入
{
  const dS = { ...diff, files: [{ ...diff.files[0], hunks: [{ ...diff.files[0].hunks[0], lines: [{ t: '+', s: 'await db.SaveChangesAsync();', n: 1, o: null }, ...diff.files[0].hunks[0].lines.slice(1)] }] }] };
  const sp = (o = {}) => ({ id: 'p1', title: 'P', diagram: { nodes: [{ id: 'a', label: 'A' }], edges: [] },
    steps: [{ file: 'f1', does: 'save', writes: 'T', station: 's1', ref: 'f1#1:1' }],
    example: [{ table: 'T', op: '新增', row: 'Id=1', ref: 'f1#1:1' }], failure: [{ when: 'x', leaves: 'y', unverified: true }], recall: 'Q?', ...o });
  const g = (o = {}) => ({ ...withLogic(), depth: '教學', ...o });
  const E = (x) => check(dS, x).errors, W = (x) => check(dS, x).warnings;
  assert.ok(E(g()).some((e) => e.includes('spines')), '教學 + SaveChanges without spines is an error');
  assert.ok(!E(g({ noSpine: 'seed only' })).some((e) => e.includes('spines')), 'noSpine exempts');
  assert.ok(!E({ ...g(), depth: '導讀' }).some((e) => e.includes('spines')), '導讀 without spines is not an error');
  assert.deepEqual([E(g({ spines: [sp()] })).length, W(g({ spines: [sp()] })).filter((w) => w.includes('主線')).length], [0, 0], 'valid spine');
  assert.ok(E(g({ spines: [sp({ steps: [{ does: 'x', station: 'nope', ref: 'f1#1:1' }] })] })).some((e) => e.includes('station')), 'spine step to a missing station');
  assert.ok(W(g({ spines: [sp({ steps: [{ does: 'x', writes: 'T', ref: 'f1#1:1' }] })] })).some((w) => w.includes('沒有連到任何站')), 'step without station warns');
  assert.ok(W(g({ spines: [sp({ steps: [{ does: 'x', writes: 'T', station: 's1' }] })] })).some((w) => w.includes('沒有出處')), 'claim without ref warns');
  assert.ok(E(g({ spines: [sp({ example: [{ table: 'T', ref: 'f1#1:9' }] })] })).some((e) => e.includes('ref')), 'bad ref is an error');
  assert.ok(E(g({ spines: [sp()], features: [{ title: 'F', spine: 'p9', stations: ['s1'] }] })).some((e) => e.includes('p9')), 'feature points at a missing spine');
  const withChain = (c) => g({ noSpine: 'x', scenarios: [{ id: 'sc1', title: 'S', stations: [{ ...base().scenarios[0].stations[0], chain: c }] }] });
  assert.ok(W(withChain('a → b')).some((w) => w.includes('⇒')), 'SaveChanges with no ⇒ in chain warns');
  assert.ok(!W(withChain('a → b ⇒ 寫入 T')).some((w) => w.includes('⇒')), 'chain with ⇒ ok');
  assert.ok(buildMd(dS, g({ spines: [sp()] })).includes('## 主線'), 'guide.md has the spine');
  assert.ok(buildHtml(dS, g({ spines: [sp()] })).includes('function viewSpine('), 'html ships the spine tab');
  const rg = { spines: [sp()] }; remapGuide(rg, { f1: { id: 'f3' } });
  assert.deepEqual([rg.spines[0].steps[0].file, rg.spines[0].steps[0].ref], ['f3', 'f3#1:1'], 'remap moves spine file/ref');
}

// diagrams: wrapping, fan-out labels, diagramFile, [text](diagrams/…) links
{
  const D = { type: 'flow', nodes: [
    { id: 'h', label: 'Tenant CreateAuthorizedNaturalPersonCommandHandler（f109）', kind: 'focal' },
    { id: 'a', label: 'Base SaveAuthorizationLetterCommandHandler（f38）⇒ FileMeta', kind: 'external' },
    { id: 'b', label: 'Customer EnsureAuthorizedNaturalPersonAccountCommandHandler（f61）⇒ SCUser／NaturalPerson', kind: 'external' },
    { id: 'c', label: 'Tenant CompanySCUser 新增一列', kind: 'focal' }, { id: 'd', label: 'Base 補償刪檔', kind: 'pending' }],
  edges: [{ from: 'h', to: 'a', label: '① 存 PDF，回 fileUid' }, { from: 'h', to: 'b', label: '② 備妥帳號，回 userTenantId' }, { from: 'h', to: 'c', label: '③ SaveChanges' }, { from: 'h', to: 'd', label: '②③ 失敗時', dashed: true }] };
  const svg = renderSvg(D);
  const rects = [...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)" rx="(\d+)"/g)].map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4], node: m[5] === '9' }));
  assert.ok(rects.filter((r) => r.node).every((r) => r.w <= 260), 'node width <= 260');
  const lb = rects.filter((r) => !r.node);
  assert.equal(lb.length, 4, '4 edge labels');
  const hit = (p, q) => p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y;
  assert.ok(lb.every((p, i) => lb.every((q, j) => i === j || !hit(p, q))), 'edge labels do not overlap each other');
  assert.ok(lb.every((p) => rects.filter((r) => r.node).every((q) => !hit(p, q))), 'edge labels do not cover nodes');
  assert.ok(svg.includes('<title>Customer EnsureAuthorizedNaturalPersonAccountCommandHandler（f61）⇒ SCUser／NaturalPerson</title>') && svg.includes('…'), 'cut label keeps full text in <title>');
  const sp1 = { id: 'p1', title: 'P', diagram: D, steps: [{ does: 'x', writes: 'T', station: 's1', ref: 'f1#1:1' }], failure: [{ leaves: 'y', unverified: true }], recall: 'Q' };
  const W2 = check(diff, { ...base(), spines: [sp1] }).warnings;
  assert.ok(W2.some((w) => w.includes('節點 h')) && W2.some((w) => w.includes('邊 h→a')) && W2.some((w) => w.includes('連出 4 條')), 'long diagram warnings name the node');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-diag-'));
  fs.mkdirSync(path.join(tmp, 'diagrams')); fs.writeFileSync(path.join(tmp, 'diagrams', 'p1.html'), 'x');
  const gF = (o) => ({ ...base(), spines: [{ ...sp1, diagram: undefined, ...o }] });
  assert.ok(!check(diff, gF({ diagramFile: 'diagrams/p1.html' }), tmp).warnings.some((w) => w.includes('缺少 diagram')), 'diagramFile replaces diagram');
  assert.equal(check(diff, gF({ diagramFile: 'diagrams/p1.html' }), tmp).errors.length, 0, 'existing diagramFile ok');
  assert.ok(check(diff, gF({ diagramFile: 'diagrams/no.html' }), tmp).errors.some((e) => e.includes('不存在')), 'missing diagramFile is an error');
  assert.ok(check(diff, gF({ diagramFile: '../a.html' }), tmp).errors.some((e) => e.includes('diagrams/')), 'diagramFile outside diagrams/ is an error');
  const gL = (t) => { const g = base(); g.scenarios[0].stations[0].callouts = [{ kind: 'why', text: t }]; return g; };
  assert.equal(check(diff, gL('[看](diagrams/p1.html)'), tmp).errors.length, 0, 'link to an existing diagram');
  assert.ok(check(diff, gL('[看](diagrams/no.html)'), tmp).errors.some((e) => e.includes('不存在')), 'link to a missing diagram');
  fs.rmSync(tmp, { recursive: true, force: true });
  // the browser inl(): load js-highlight.js's helpers in a sandbox
  const hl = fs.readFileSync(new URL('../templates/js-highlight.js', import.meta.url), 'utf8');
  const src = hl.slice(hl.indexOf('var ESC'), hl.indexOf('function md('));
  const inl = new Function(src + '\nreturn inl;')();
  assert.equal(inl('[看完整圖](diagrams/p1-confirm.html)'), '<a href="diagrams/p1-confirm.html" target="_blank" rel="noopener">看完整圖</a>', 'diagram link');
  assert.equal(inl('[x](javascript:alert(1))'), '[x](javascript:alert(1))', 'javascript: stays text');
  assert.equal(inl('[x](../a.html)'), '[x](../a.html)', '../ stays text');
  assert.equal(inl('[x](diagrams/../a.html)'), '[x](diagrams/../a.html)', 'diagrams/.. stays text');
  assert.equal(inl('[x](https://e.com)'), '[x](https://e.com)', 'http stays text');
}

const md0 = buildMd(diff, base()), md1 = buildMd(diff, withLogic());
assert.ok(!md0.includes('## 邏輯導讀') && md1.includes('## 邏輯導讀') && md1.includes('屬於：Station'));

// the tab is rendered client-side (only when G.logic is non-empty), so statically we can only check the template ships it
assert.ok(buildHtml(diff, withLogic()).includes('data-t="logic"'), 'html has logic tab');
assert.ok(buildHtml(diff, base()).includes('function markFormat('), 'html inlines markFormat for the format-only fold');

// output folders: one per branch, reused on re-collect, --new opens -N, an explicit dir stays pinned (what serve relies on)
{
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-selftest-'));
  const g = (...a) => execFileSync('git', a, { cwd: repo, stdio: ['ignore', 'pipe', 'ignore'] });
  const commit = (file, text) => { fs.writeFileSync(path.join(repo, file), text); g('add', '.'); g('commit', '-q', '-m', file); };
  const docs = path.join(repo, '.code-mentor', 'output', 'docs');
  const current = () => fs.readFileSync(path.join(repo, '.code-mentor', 'current'), 'utf8').trim();
  try {
    g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't'); g('config', 'core.autocrlf', 'false');
    commit('a.txt', 'a\n');
    g('branch', 'feature/a', 'main'); g('checkout', '-q', 'feature/a'); commit('b.txt', 'b\n');

    const a1 = collect({}, repo);
    assert.match(path.basename(a1.dir), /^feature-a-[0-9a-f]{6}$/, 'branch folder name');
    assert.equal(path.dirname(a1.dir), docs, 'under output/docs');
    assert.ok(a1.created && !a1.reused, 'first collect creates');
    assert.equal(current(), path.basename(a1.dir), 'current points to folder');
    assert.equal(fs.readFileSync(path.join(repo, '.code-mentor', '.gitignore'), 'utf8'), '*\n', 'gitignore');

    const guideA = path.join(a1.dir, 'guide.json');
    fs.writeFileSync(guideA, JSON.stringify({ ...JSON.parse(fs.readFileSync(guideA, 'utf8')), title: 'kept' }));
    const a2 = collect({}, repo);
    assert.equal(a2.dir, a1.dir, 're-collect reuses the folder');
    assert.ok(a2.reused && !a2.created, 're-collect overwrites, keeps guide');
    assert.equal(JSON.parse(fs.readFileSync(guideA, 'utf8')).title, 'kept', 'guide.json kept');
    assert.ok(a2.delta && !a2.delta.changed.length && !a2.delta.added.length, 'unchanged re-collect: empty delta');

    // update mode: a new file sorts first, so b.txt moves from f1 to f2; guide refs follow it by path
    const st = { id: 's1', hunks: ['f1#1'], notes: [{ hunk: 'f1#1', line: 1, text: 'n' }] };
    fs.writeFileSync(guideA, JSON.stringify({ ...JSON.parse(fs.readFileSync(guideA, 'utf8')), scenarios: [{ id: 'main', stations: [st] }] }));
    commit('a0.txt', 'x\n');
    const a2b = collect({}, repo);
    assert.deepEqual(a2b.delta.added, ['a0.txt'], 'delta lists the new file');
    const s1 = JSON.parse(fs.readFileSync(guideA, 'utf8')).scenarios[0].stations[0];
    assert.deepEqual([s1.hunks[0], s1.notes[0].hunk, s1.notes[0].line], ['f2#1', 'f2#1', 1], 'refs remapped by path');
    // a moved hunk (same lines, new numbers) shifts the note line; a removed file becomes gone:
    const prev = { files: [{ id: 'f1', path: 'p.ts', hunks: [{ header: '@@ -10,2 +10,2 @@', oldStart: 10, newStart: 10, lines: [{ t: '-', s: 'a' }, { t: '+', s: 'b' }, { t: ' ', s: 'c' }] }] }, { id: 'f2', path: 'q.ts', hunks: [] }] };
    const next = { files: [{ id: 'f1', path: 'p.ts', hunks: [{ header: '@@ -15,2 +15,2 @@', oldStart: 15, newStart: 15, lines: prev.files[0].hunks[0].lines }] }] };
    const dl = diffDelta(prev, next), gd = { scenarios: [{ stations: [{ hunks: ['f1#1', 'f2'], notes: [{ hunk: 'f1#1', line: 10, to: 11, see: 'f1#1:11' }] }] }] };
    remapGuide(gd, dl.map);
    assert.deepEqual([dl.moved, dl.removed], [['p.ts'], ['q.ts']], 'moved + removed lists');
    const nn = gd.scenarios[0].stations[0];
    assert.deepEqual([nn.hunks, nn.notes[0].line, nn.notes[0].to, nn.notes[0].see], [['f1#1', 'gone:f2'], 15, 16, 'f1#1:16'], 'line shift + gone');

    const a3 = collect({ new: true }, repo);
    assert.equal(path.basename(a3.dir), path.basename(a1.dir) + '-2', '--new opens -2');
    assert.ok(a3.created, '--new writes a fresh guide');
    assert.equal(collect({}, repo).dir, a3.dir, 'later collect reuses the newest copy');
    assert.equal(path.basename(collect({ new: true }, repo).dir), path.basename(a1.dir) + '-3', '--new again opens -3');

    // a slug-alike branch must not share the folder
    g('branch', 'feature-a', 'main'); g('checkout', '-q', 'feature-a'); commit('c.txt', 'c\n');
    const b = collect({}, repo);
    assert.notEqual(b.dir, a1.dir, 'feature-a vs feature/a: different folders');
    assert.match(path.basename(b.dir), /^feature-a-[0-9a-f]{6}$/);
    assert.ok(fs.existsSync(guideA), 'other branch folder untouched');

    // current now points to feature-a; a pinned dir must still build feature/a
    assert.equal(loadWork(repo).diff.branch, 'feature-a', 'default follows current');
    const r = runBuild({ dir: a1.dir, force: true }, repo);
    assert.ok(r.ok && fs.existsSync(path.join(a1.dir, 'index.html')), 'pinned build writes into its own folder');
    assert.equal(loadWork(repo, a1.dir).diff.branch, 'feature/a', 'pinned dir reads its own diff');
    assert.ok(!fs.existsSync(path.join(b.dir, 'index.html')), 'pinned build does not touch current folder');

    fs.writeFileSync(path.join(repo, '.code-mentor', 'current'), '..\n');
    assert.throws(() => workDir(repo), /無效/, 'current must be a single folder name');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}
console.log('selftest ok');
