#!/usr/bin/env node
// Deterministic tests -> code analyzer. READ-ONLY over the repo; writes only
// graphify-out/test_links.json.
//
//   node scripts/knowledge/build-test-links.mjs
//
// Evidence classes (never LLM/semantic):
//   TEST_IMPORTS        EXTRACTED — a test file imports a production file (resolved). confidence 1.0
//   TEST_FIXTURE        EXTRACTED — a test file imports a test helper/fixture.        confidence 1.0
//   TEST_CONVENTION_MATCH CONVENTION — test basename stem == a production file stem,
//                         and the test does NOT already import it.                    confidence 0.5
//   (unresolved)        AMBIGUOUS — a relative import that does not resolve, OR an
//                         e2e/black-box spec with zero production imports.
//
// "Unknown is better than false certainty": black-box specs get NO invented edges.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const sortBy = (a, f) => [...a].sort((x, y) => (f(x) < f(y) ? -1 : f(x) > f(y) ? 1 : 0));

// ---- discover test files ---------------------------------------------------
const TEST_ROOTS = ['apps/backend/test', 'tests/e2e', 'apps/dashboard', 'apps/client'];
function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (/\.(test|spec)\.ts$/.test(e.name)) out.push(p);
  }
}
const testFiles = [];
for (const r of TEST_ROOTS) walk(path.join(ROOT, r), testFiles);
if (!testFiles.length) { console.error('FATAL: no test/spec files discovered.'); process.exit(1); }

// ---- production file index (for convention matching) -----------------------
const prodFiles = [];
function walkProd(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'test', 'dist', '.next'].includes(e.name)) walkProd(p); }
    else if (/\.ts$/.test(e.name) && !/\.(test|spec|d)\.ts$/.test(e.name)) prodFiles.push(p);
  }
}
walkProd(path.join(ROOT, 'apps'));
walkProd(path.join(ROOT, 'packages'));
const prodByStem = new Map(); // basename stem -> [relpaths]
for (const p of prodFiles) {
  const stem = path.basename(p).replace(/\.ts$/, '');
  if (!prodByStem.has(stem)) prodByStem.set(stem, []);
  prodByStem.get(stem).push(rel(p));
}

// ---- helpers ---------------------------------------------------------------
const isProd = (r) => (r.startsWith('apps/') || r.startsWith('packages/')) && !/\/test\//.test(r) && !/\/tests\//.test(r) && !/\.(test|spec)\.ts$/.test(r);
const isHelper = (r) => /\/test\//.test(r) || /\/tests\//.test(r);
function backendModule(r) {
  const m = r.match(/apps\/backend\/src\/([^/]+)\//);
  return m ? m[1] : null;
}
function resolveSpec(importerFile, spec) {
  // workspace package specifiers
  if (spec === '@afrows/shared' || spec.startsWith('@afrows/shared/')) return firstExisting(['packages/shared/src/index.ts']);
  if (spec.startsWith('@afrows/')) return null; // other workspace pkgs: not file-resolvable deterministically here
  if (!spec.startsWith('.')) return null; // npm/node builtins
  const dir = path.dirname(importerFile);
  const base = path.resolve(dir, spec);
  const cands = [base, base + '.ts', path.join(base, 'index.ts')];
  for (const c of cands) if (fs.existsSync(c) && fs.statSync(c).isFile()) return rel(c);
  return { unresolved: spec };
}
function firstExisting(list) {
  for (const r of list) if (fs.existsSync(path.join(ROOT, r))) return r;
  return null;
}
// parse imports incl. multi-line; capture named symbols + module specifier
const IMPORT_RE = /import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
function parseImports(text) {
  const out = [];
  let m;
  while ((m = IMPORT_RE.exec(text)) !== null) {
    const clause = m[2] || '';
    const spec = m[3] || m[4] || m[5];
    if (!spec) continue;
    const line = text.slice(0, m.index).split('\n').length;
    const syms = [];
    const named = clause.match(/\{([\s\S]*?)\}/);
    if (named) for (const s of named[1].split(',')) { const t = s.trim().split(/\s+as\s+/)[0].trim(); if (t && /^[A-Za-z_$]/.test(t)) syms.push(t); }
    out.push({ spec, line, symbols: sortBy([...new Set(syms)], (x) => x) });
  }
  return out;
}

// ---- build edges -----------------------------------------------------------
const importEdges = []; // TEST_IMPORTS
const fixtureEdges = []; // TEST_FIXTURE
const conventionEdges = []; // TEST_CONVENTION_MATCH
const unresolved = []; // AMBIGUOUS
const blackbox = []; // no production imports at all

for (const tf of sortBy(testFiles, (x) => rel(x))) {
  const trel = rel(tf);
  const text = fs.readFileSync(tf, 'utf8');
  const imports = parseImports(text);
  const importedProd = new Set();
  let prodImportCount = 0;
  for (const imp of imports) {
    const r = resolveSpec(tf, imp.spec);
    if (r == null) continue; // npm/builtin/other-workspace: skip
    if (typeof r === 'object' && r.unresolved) { unresolved.push({ test: trel, import: imp.spec, line: imp.line, reason: 'relative import did not resolve' }); continue; }
    if (isProd(r)) {
      prodImportCount++; importedProd.add(r);
      importEdges.push({ test: trel, target_file: r, module: backendModule(r), symbols: imp.symbols, type: 'TEST_IMPORTS', evidence: 'EXTRACTED direct import', source_location: `${trel}:${imp.line}`, confidence: 1.0 });
    } else if (isHelper(r)) {
      fixtureEdges.push({ test: trel, target_file: r, type: 'TEST_FIXTURE', evidence: 'EXTRACTED helper import', source_location: `${trel}:${imp.line}`, confidence: 1.0 });
    }
  }
  // convention: test stem -> production file with same stem, not already imported
  const stem = path.basename(tf).replace(/\.(test|spec)\.ts$/, '');
  for (const cand of prodByStem.get(stem) || []) {
    if (importedProd.has(cand)) continue;
    conventionEdges.push({ test: trel, target_file: cand, module: backendModule(cand), type: 'TEST_CONVENTION_MATCH', evidence: 'CONVENTION filename-stem match (NOT verified coverage)', confidence: 0.5 });
  }
  if (prodImportCount === 0) blackbox.push({ test: trel, reason: imports.some((i) => i.spec.includes('@playwright')) ? 'playwright black-box e2e (no production import)' : 'no resolved production import' });
}

const out = {
  schema: 'afrows-test-links/v1',
  note: 'Deterministic tests->code links. EXTRACTED (import/fixture) are evidence-backed; CONVENTION is a filename hint, NOT verified coverage; black-box specs have no direct edges.',
  test_files: testFiles.length,
  counts: {
    test_imports: importEdges.length,
    test_fixtures: fixtureEdges.length,
    convention_matches: conventionEdges.length,
    unresolved: unresolved.length,
    blackbox_specs: blackbox.length,
  },
  edges: sortBy(importEdges, (e) => e.test + '|' + e.target_file),
  fixtures: sortBy(fixtureEdges, (e) => e.test + '|' + e.target_file),
  convention: sortBy(conventionEdges, (e) => e.test + '|' + e.target_file),
  unresolved: sortBy(unresolved, (e) => e.test + '|' + e.import),
  blackbox: sortBy(blackbox, (e) => e.test),
};
const OUT = path.join(ROOT, 'graphify-out', 'test_links.json');
if (!fs.existsSync(path.dirname(OUT))) { console.error('FATAL: graphify-out/ missing.'); process.exit(1); }
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

console.log(`test_links.json written: ${rel(OUT)}`);
console.log(`  test files:          ${out.test_files}`);
console.log(`  TEST_IMPORTS (EXTRACTED):     ${out.counts.test_imports}`);
console.log(`  TEST_FIXTURE (EXTRACTED):     ${out.counts.test_fixtures}`);
console.log(`  TEST_CONVENTION_MATCH:        ${out.counts.convention_matches}`);
console.log(`  unresolved (AMBIGUOUS):       ${out.counts.unresolved}`);
console.log(`  black-box specs (no edges):   ${out.counts.blackbox_specs}`);
const modsWithTests = new Set(importEdges.map((e) => e.module).filter(Boolean));
console.log(`  backend modules with import-linked tests: ${modsWithTests.size}`);
