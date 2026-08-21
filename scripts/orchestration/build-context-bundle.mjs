#!/usr/bin/env node
// Afrows Task Context Bundle (F0) + Cache (F0A).
//
//   node scripts/orchestration/build-context-bundle.mjs \
//        --task "short task description" [--file <path>]... [--security] [--json] [--no-cache]
//
// Builds ONE deterministic context artifact per task so every agent on that task
// INHERITS the same context instead of re-discovering it (the observed duplicate-
// read cost). It composes, with provenance, the SINGLE impact/routing pass plus
// the human-decision (F7) and security-pattern (F4) layers that apply to the
// change set. It writes structured REFERENCES (path/symbol/line/evidence/
// confidence), not copied source text.
//
// Cache key = sha256(HEAD + manifest_source_sha + sorted target files + task
// fingerprint). The key includes the LIVE HEAD, so any source change is a cache
// miss -> the bundle is always re-derived from current source; the cache never
// serves stale authoritative data. Bundles live in graphify-out/context/
// (gitignored / regenerable).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const CTX_DIR = path.join(ROOT, 'graphify-out', 'context');
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const security = argv.includes('--security');
const noCache = argv.includes('--no-cache');
const taskIdx = argv.indexOf('--task');
const task = taskIdx >= 0 ? argv[taskIdx + 1] : '(no task)';
const files = [];
for (let i = 0; i < argv.length; i++) if (argv[i] === '--file') files.push(argv[i + 1]);

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}
function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

const head = git(['rev-parse', 'HEAD']) || 'unknown';
const manifest = loadJson(path.join(ROOT, 'graphify-out', 'knowledge-manifest.json'));
const manifestSha = manifest?.source_git_sha || 'none';

// ---- cache key --------------------------------------------------------------
const fingerprint = crypto
  .createHash('sha256')
  .update(head)
  .update('|')
  .update(manifestSha)
  .update('|')
  .update([...files].sort().join(','))
  .update('|')
  .update(task.trim().toLowerCase().replace(/\s+/g, ' '))
  .digest('hex')
  .slice(0, 16);
const cachePath = path.join(CTX_DIR, `${fingerprint}.json`);

if (!noCache && fs.existsSync(cachePath)) {
  const cached = loadJson(cachePath);
  // Guard: the cache is only valid if it was built at the CURRENT HEAD.
  if (cached && cached.provenance && cached.provenance.head === head) {
    cached.cache = { hit: true, key: fingerprint };
    console.log(asJson ? JSON.stringify(cached, null, 2) : `context bundle CACHE HIT (${fingerprint}) — reused, no re-discovery`);
    process.exit(0);
  }
}

// ---- run the single impact+routing pass -------------------------------------
let routing;
try {
  const out = execFileSync(
    process.execPath,
    [path.join(ROOT, 'scripts', 'orchestration', 'route.mjs'), '--json', ...(security ? ['--security'] : []), ...files],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  routing = JSON.parse(out);
} catch (e) {
  console.error('context-bundle: route.mjs failed:', e && e.message ? e.message : String(e));
  process.exit(2);
}
const changed = routing.changed_files || files;

// ---- F7: applicable human decisions (by affected_paths overlap) -------------
const decisions = loadJson(path.join(ROOT, 'docs', 'decisions.json'));
const pathMatches = (patterns) =>
  (patterns || []).some((pat) => {
    const base = pat.replace(/\/\*\*$/, '').replace(/\*\*$/, '');
    return changed.some((f) => f === pat || f.startsWith(base));
  });
const applicableDecisions = (decisions?.decisions || [])
  .filter((d) => d.kind === 'forbidden-change' || d.kind === 'data-semantics' ? pathMatches(d.affected_paths) : false)
  .map((d) => ({ id: d.id, source_adr: d.source_adr, decision: d.decision, forbidden_changes: d.forbidden_changes, required_tests: d.required_tests, evidence: 'affected_paths overlap', confidence: 'VERIFIED' }));

// ---- F4: applicable security patterns (by detection regex hit) --------------
const secReg = loadJson(path.join(ROOT, 'docs', 'security-patterns.json'));
const applicablePatterns = [];
for (const p of secReg?.patterns || []) {
  let hit = false;
  const evidence = [];
  if (p.detection) {
    let re;
    try {
      re = new RegExp(p.detection.replace(/^\/|\/$/g, ''));
    } catch {
      re = null;
    }
    if (re) {
      for (const f of changed) {
        const abs = path.join(ROOT, f);
        if (!fs.existsSync(abs)) continue;
        const src = fs.readFileSync(abs, 'utf8');
        if (re.test(src)) {
          hit = true;
          evidence.push(f);
        }
      }
    }
  }
  if (hit) applicablePatterns.push({ id: p.id, threat: p.threat, safe_pattern: p.safe_pattern, regression: p.regression, evidence, confidence: 'VERIFIED (detection regex hit)' });
}

// ---- assemble bundle --------------------------------------------------------
const bundle = {
  schema: 'afrows-context-bundle/v1',
  task,
  provenance: {
    head,
    manifest_source_sha: manifestSha,
    freshness: routing.freshness,
    authority_note: 'source/migrations/tests/config are authoritative; this bundle is derived context. On any conflict, re-read source (INV-1).',
  },
  impact: {
    changed_files: changed,
    overall_risk: routing.overall_risk,
    per_file: (routing.__perfile || undefined), // impact per-file is in the routing engine; keep the reference-only summary below
  },
  routing: { complexity: routing.complexity, plan: routing.plan },
  validation: routing.validation,
  applicable_decisions: applicableDecisions,
  applicable_security_patterns: applicablePatterns,
  regression_registry: 'docs/regression-guards.md',
  agent_instructions:
    'READ this bundle instead of re-discovering. Honor applicable_decisions.forbidden_changes. If a security pattern applies, reuse its safe_pattern (do not re-derive). Treat derived facts as HINTS if freshness != FRESH and re-verify against source.',
  cache: { hit: false, key: fingerprint },
};

// ---- write cache ------------------------------------------------------------
if (!noCache) {
  fs.mkdirSync(CTX_DIR, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
}

if (asJson) {
  console.log(JSON.stringify(bundle, null, 2));
} else {
  const L = console.log;
  L(`Task context bundle  [key ${fingerprint}]  (cache ${noCache ? 'off' : 'written'})`);
  L(`  head=${head.slice(0, 12)} freshness=${routing.freshness?.state} complexity=${routing.complexity.tier}`);
  L(`  changed files: ${changed.length}`);
  L(`  applicable decisions (forbidden-change/data-semantics): ${applicableDecisions.map((d) => d.id).join(', ') || '(none)'}`);
  L(`  applicable security patterns: ${applicablePatterns.map((p) => p.id).join(', ') || '(none)'}`);
  L(`  validation: broader=${routing.validation.broader_required} unknown-coverage=${routing.validation.unknown_coverage.length}`);
}
