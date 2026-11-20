import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { collect, loadWork, workDir } from './collect.mjs';
import { runBuild } from './run.mjs';
import { check } from './check.mjs';
import { buildMd } from './build-md.mjs';
import { buildHtml } from './build-html.mjs';
import { depthOf, promptHelp } from './prompt-help.mjs';

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
