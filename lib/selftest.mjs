import assert from 'node:assert/strict';
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
console.log('selftest ok');
