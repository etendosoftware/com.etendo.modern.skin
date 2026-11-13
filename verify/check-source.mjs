#!/usr/bin/env node
/*
 * Source gates for com.etendo.modern.skin. No browser, no running Etendo, no npm dependencies.
 *
 *   G0 jsmin-selftest  a broken fixture must be rejected, or the gate is checking nothing
 *   G1 jsmin           every script, minified with the kernel's own JSMin, still parses
 *   G2 css-url         no parenthesis inside url(): the kernel's CSS pipeline stops at the first )
 *   G3 css-scope       every rule of etendo-skin.css hangs from .etskin-on, except the documented
 *                      exceptions (@font-face, :root tokens, the boot screen under #OBLoadingDiv)
 *
 * ES5 syntax is checked separately with es-check (see .github/workflows/source-gate.yml).
 *
 * JSMin is compiled from core's JSMin.java: the one next to this module in an Etendo checkout, or
 * the file named by JSMIN_SOURCE (CI downloads it from etendo_core at a pinned tag).
 *
 * Usage: node verify/check-source.mjs     Exit code 0 only when every gate passes.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERIFY = path.dirname(fileURLToPath(import.meta.url));
const MODULE = path.dirname(VERIFY);
const WEB = path.join(MODULE, 'web', 'com.etendo.modern.skin');
const CACHE = path.join(VERIFY, '.cache');
const JSMIN_SOURCE = process.env.JSMIN_SOURCE || path.resolve(MODULE, '..', '..',
  'modules_core/org.openbravo.client.kernel/src/org/openbravo/client/kernel/JSMin.java');

const results = [];
const report = (id, name, problems, ok) => results.push({ id, name, ok: problems.length === 0,
  detail: problems.length ? problems.join('\n     ') : ok });
const rel = (p) => path.relative(MODULE, p);
const read = (p) => fs.readFileSync(p, 'utf8');
const list = (dir, ext) => fs.readdirSync(dir).filter((f) => f.endsWith(ext)).sort().map((f) => path.join(dir, f));

/* ------------------------------------------------------------------ JSMin */

function compileJsmin() {
  if (!fs.existsSync(JSMIN_SOURCE)) throw new Error(`core JSMin.java not found at ${JSMIN_SOURCE}; set JSMIN_SOURCE`);
  const classes = path.join(CACHE, 'classes');
  fs.mkdirSync(classes, { recursive: true });
  execFileSync('javac', ['-nowarn', '-d', classes, JSMIN_SOURCE, path.join(VERIFY, 'jsmin', 'JSMinRunner.java')],
    { stdio: 'pipe' });
  return classes;
}

function minifyAndParse(classes, file) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'etskin-jsmin-')), 'out.js');
  const min = spawnSync('java', ['-cp', classes, 'org.openbravo.client.kernel.JSMinRunner', file, out], { encoding: 'utf8' });
  if (min.status !== 0) return `jsmin: ${(min.stderr || '').trim().split('\n').pop()}`;
  const check = spawnSync(process.execPath, ['--check', out], { encoding: 'utf8' });
  if (check.status !== 0) return `parse: ${(check.stderr || '').trim().split('\n').filter(Boolean).pop()}`;
  return null;
}

let classes = null;
try {
  classes = compileJsmin();
} catch (err) {
  report('G0', 'jsmin-selftest', [String(err.stderr || err.message).trim().split('\n')[0]]);
}

if (classes) {
  const scripts = list(path.join(WEB, 'js'), '.js');
  report('G0', 'jsmin-selftest',
    minifyAndParse(classes, path.join(VERIFY, 'fixtures', 'broken.js')) ? [] : ['fixtures/broken.js was accepted'],
    'fixtures/broken.js rejected');
  const bad = scripts.map((f) => [f, minifyAndParse(classes, f)]).filter(([, e]) => e).map(([f, e]) => `${rel(f)}: ${e}`);
  report('G1', 'jsmin', bad, `${scripts.length} script(s) minify and parse`);
}

/* ------------------------------------------------------------------ CSS */

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
const lineOf = (css, index) => css.slice(0, index).split('\n').length;

const sheets = list(path.join(WEB, 'css'), '.css');
{
  const problems = [];
  for (const file of sheets) {
    const css = stripComments(read(file));
    for (const m of css.matchAll(/url\(([^)]*)\)/g)) {
      if (m[1].includes('(')) problems.push(`${rel(file)}:${lineOf(css, m.index)}: "(" inside url()`);
    }
  }
  report('G2', 'css-url', problems, `${sheets.length} stylesheet(s), no "(" inside url()`);
}

// Top-level preludes of a block, recursing into @media / @supports. Good enough for this sheet:
// no braces inside strings or url()s (G2 and the data URIs' encoding keep it that way).
function rules(css, offset, out) {
  let depth = 0;
  let start = 0;
  let open = -1;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') {
      if (depth++ === 0) open = i;
    } else if (css[i] === '}' && --depth === 0) {
      const prelude = css.slice(start, open).trim();
      if (/^@(media|supports)\b/.test(prelude)) rules(css.slice(open + 1, i), offset + open + 1, out);
      else out.push({ prelude, index: offset + start + css.slice(start, open).search(/\S/) });
      start = i + 1;
    }
  }
  return out;
}

// .etskin-on anywhere in the selector scopes it ([dir="rtl"] .etskin-on ... is fine).
const ALLOWED = [/\.etskin-on(?![\w-])/, /^:root$/, /#OBLoadingDiv\b/];
{
  const file = path.join(WEB, 'css', 'etendo-skin.css');
  const css = stripComments(read(file));
  const problems = [];
  let count = 0;
  for (const { prelude, index } of rules(css, 0, [])) {
    if (/^@(font-face|keyframes|-webkit-keyframes|import|charset)\b/.test(prelude)) continue;
    for (const selector of prelude.split(',').map((s) => s.trim())) {
      count++;
      if (!ALLOWED.some((re) => re.test(selector))) problems.push(`${rel(file)}:${lineOf(css, index)}: ${selector}`);
    }
  }
  report('G3', 'css-scope', problems, `${count} selector(s) under .etskin-on or a documented exception`);
}

/* ------------------------------------------------------------------ report */

for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id} ${r.name.padEnd(14)} ${r.detail}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} gates green${failed.length ? ` - FAILED: ${failed.map((r) => r.id).join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
