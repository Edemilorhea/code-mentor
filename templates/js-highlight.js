"use strict";
var DATA = JSON.parse(document.getElementById('data').textContent), D = DATA.diff, G = DATA.guide;
var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
function inl(s) { return h(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }
function md(t) {
  if (!t) return '';
  var out = [];
  String(t).split(/\n\s*\n/).forEach(function (p) {
    var ls = p.split('\n');
    if (ls.every(function (l) { return /^\s*- /.test(l); })) out.push('<ul>' + ls.map(function (l) { return '<li>' + inl(l.replace(/^\s*- /, '')) + '</li>'; }).join('') + '</ul>');
    else out.push('<p>' + ls.map(inl).join('<br>') + '</p>');
  });
  return '<div class="md">' + out.join('') + '</div>';
}

// ---- syntax highlighting: per-line regex tokenizer ----
// shortcut: tokenizes one line at a time, so multi-line comments/strings are only coloured on lines that open them; upgrade to a stateful lexer if it matters.
var KW = {
  cs: 'abstract as async await base bool break case catch checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly record ref return sealed short static string struct switch this throw true try typeof uint ulong unchecked unsafe using var virtual void volatile when where while yield get set init required',
  js: 'async await break case catch class const continue debugger default delete do else export extends false finally for from function if import in instanceof interface let new null of return static super switch this throw true try type typeof undefined var void while yield enum implements private protected public readonly as is keyof declare namespace abstract',
  sql: 'add alter and as asc begin by case check column constraint create cross database default delete desc distinct drop else end exists foreign from full group having if in index inner insert into is join key left like not null on or order outer primary references right select set table then top union unique update values view when where with go identity nvarchar varchar int bigint bit datetime2 uniqueidentifier',
  css: 'important media import keyframes supports font-face',
  ps: 'begin break catch class continue data do dynamicparam else elseif end exit filter finally for foreach from function if in param process return switch throw trap try until using var while echo fi then esac done local export',
  yaml: 'true false null yes no on off'
};
Object.keys(KW).forEach(function (k) { var o = {}; KW[k].split(' ').forEach(function (w) { o[w] = 1; o[w.toUpperCase()] = k === 'sql' ? 1 : o[w.toUpperCase()]; }); KW[k] = o; });
var EXT = { cs: 'cs', ts: 'js', tsx: 'js', js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', json: 'json', sql: 'sql', css: 'css', scss: 'css', less: 'css', html: 'xml', htm: 'xml', xml: 'xml', csproj: 'xml', props: 'xml', config: 'xml', vue: 'xml', svg: 'xml', yml: 'yaml', yaml: 'yaml', md: 'md', ps1: 'ps', psm1: 'ps', sh: 'ps', bash: 'ps' };
var RULES = {
  cs: [['com', /\/\/.*|\/\*.*?\*\/|\/\*.*$/], ['str', /\$?@?"(?:[^"\\]|\\.|"")*"|'(?:[^'\\]|\\.)'/], ['attr', /\[[A-Z]\w*(?:\([^\]]*\))?\]/], ['num', /\b\d[\d_.]*(?:[fFdDmMlLuU]+)?\b|\b0x[\da-fA-F]+\b/], ['w', /[A-Za-z_]\w*/]],
  js: [['com', /\/\/.*|\/\*.*?\*\/|\/\*.*$/], ['str', /`(?:[^`\\]|\\.)*`?|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/], ['attr', /@[A-Za-z_]\w*/], ['num', /\b\d[\d_.]*\b|\b0x[\da-fA-F]+\b/], ['w', /[A-Za-z_$][\w$]*/]],
  sql: [['com', /--.*|\/\*.*?\*\/|\/\*.*$/], ['str', /N?'(?:[^']|'')*'/], ['num', /\b\d+(?:\.\d+)?\b/], ['w', /[A-Za-z_]\w*/]],
  css: [['com', /\/\*.*?\*\/|\/\*.*$|\/\/.*/], ['str', /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/], ['num', /#[\da-fA-F]{3,8}\b|-?\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms)?\b/], ['attr', /@[\w-]+/], ['w', /[A-Za-z_-][\w-]*/]],
  xml: [['com', /<!--.*?-->|<!--.*$/], ['str', /"[^"]*"|'[^']*'/], ['kw', /<\/?[A-Za-z][\w:.-]*|\/?>/], ['attr', /[@:#]?[A-Za-z_][\w:.-]*(?==)/]],
  json: [['attr', /"(?:[^"\\]|\\.)*"(?=\s*:)/], ['str', /"(?:[^"\\]|\\.)*"/], ['num', /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/], ['kw', /\b(?:true|false|null)\b/]],
  yaml: [['com', /#.*/], ['str', /"(?:[^"\\]|\\.)*"|'[^']*'/], ['attr', /^\s*-?\s*[\w.-]+(?=:)/], ['num', /\b\d+(?:\.\d+)?\b/], ['w', /[A-Za-z_]\w*/]],
  md: [['kw', /^#{1,6}\s.*/], ['str', /`[^`]+`/], ['attr', /\[[^\]]*\]\([^)]*\)/]],
  ps: [['com', /#.*/], ['str', /"(?:[^"`\\]|`.|\\.)*"|'[^']*'/], ['attr', /\$[A-Za-z_{][\w:}]*/], ['num', /\b\d+\b/], ['w', /[A-Za-z_][\w-]*/]]
};
function langOf(path) {
  var m = /\.([A-Za-z0-9]+)$/.exec(path || ''); return m ? EXT[m[1].toLowerCase()] : null;
}
// Returns [{c: class|'', s: text}] for one line.
function tokenize(s, lang) {
  var rules = RULES[lang === 'xml' || lang === 'json' || lang === 'md' ? lang : lang];
  if (!rules || !s || s.length > 1000) return [{ c: '', s: s }];
  var kw = KW[lang] || {}, out = [], i = 0, plain = '';
  function flush() { if (plain) { out.push({ c: '', s: plain }); plain = ''; } }
  while (i < s.length) {
    var best = null, bi = -1, rest = s.slice(i), j;
    for (j = 0; j < rules.length; j++) {
      var m = new RegExp(rules[j][1].source.charAt(0) === '^' ? rules[j][1].source : '^(?:' + rules[j][1].source + ')').exec(rest);
      if (m && m[0].length) { best = m[0]; bi = j; break; }
    }
    if (best === null) { plain += s[i++]; continue; }
    var kind = rules[bi][0];
    if (kind === 'w') {
      if (kw[best]) kind = 'kw';
      else if (lang === 'cs' && /^[A-Z][a-z]/.test(best) || lang === 'js' && /^[A-Z][a-z]/.test(best)) kind = 'type';
      else { plain += best; i += best.length; continue; }
    }
    flush(); out.push({ c: kind, s: best }); i += best.length;
  }
  flush();
  return out;
}

// ---- intraline word diff (token LCS) ----
function wsplit(s) { return s.match(/\s+|\w+|[^\w\s]/g) || []; }
// Returns [aMask, bMask]: arrays of booleans per character, true where changed.
function wordDiff(a, b) {
  if (a.length > 500 || b.length > 500) return null;
  var x = wsplit(a), y = wsplit(b), n = x.length, m = y.length, L = [], i, j;
  if (n * m > 40000) return null;
  for (i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
  for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  var ma = new Array(a.length).fill(true), mb = new Array(b.length).fill(true), pa = 0, pb = 0;
  i = 0; j = 0;
  var offA = [], offB = [], o = 0;
  x.forEach(function (t) { offA.push(o); o += t.length; }); o = 0;
  y.forEach(function (t) { offB.push(o); o += t.length; });
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      for (var k = 0; k < x[i].length; k++) { ma[offA[i] + k] = false; mb[offB[j] + k] = false; }
      i++; j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  if (ma.every(Boolean) && mb.every(Boolean)) return null; // nothing in common: skip noisy full highlight
  return [ma, mb];
}
// HTML for a code line: syntax tokens (+ optional word-diff mask with class wd/wa).
function codeHtml(s, lang, mask, wcls) {
  var toks = tokenize(s, lang), pos = 0, out = [];
  toks.forEach(function (t) {
    var seg = t.s, st = 0;
    while (st < seg.length) {
      var ch = mask ? mask[pos + st] : false, e = st + 1;
      while (e < seg.length && (mask ? mask[pos + e] : false) === ch) e++;
      var txt = h(seg.slice(st, e));
      if (ch) txt = '<span class="' + wcls + '">' + txt + '</span>';
      out.push(t.c ? '<span class="tk-' + t.c + '">' + txt + '</span>' : txt);
      st = e;
    }
    pos += seg.length;
  });
  return out.join('');
}
