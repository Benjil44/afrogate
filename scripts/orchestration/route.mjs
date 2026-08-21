#!/usr/bin/env node
// Afrows complexity/cost router (F2) + validation router (F3).
//
//   node scripts/orchestration/route.mjs <file...> [--security] [--json]
//   node scripts/orchestration/route.mjs --changed [--base <ref>] [--security] [--json]
//
// Deterministic: it runs the ONE impact engine (impact-report.mjs) as a
// subprocess and layers a risk-driven routing decision on top — NEVER a second
// impact implementation. Same inputs + same source -> same routing. Output tells
// the human/orchestrator HOW MUCH orchestration a task deserves, so trivial work
// skips the 400k-token full workflow and only genuinely complex/critical work
// pays for it. Line-count is NOT the driver; risk + blast radius + security are.

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const security = argv.includes('--security');
const passthrough = argv.filter((a) => a !== '--json' && a !== '--security');

// ---- run the single impact engine -------------------------------------------
let impact;
try {
  const out = execFileSync(
    process.execPath,
    [path.join(ROOT, 'scripts', 'orchestration', 'impact-report.mjs'), '--json', ...passthrough],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  impact = JSON.parse(out);
} catch (e) {
  console.error('router: impact-report failed:', e && e.message ? e.message : String(e));
  process.exit(2);
}

const files = impact.changed_files || [];
const perFile = impact.per_file || [];
const riskRank = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const maxFileRisk = perFile.reduce((m, f) => Math.max(m, riskRank[f.risk] ?? 0), 0);

// ---- deterministic complexity score (risk-driven, not line-count) -----------
const HIGH_RISK_PATH = /(billing|payment|quota|gems|reseller|auth|rbac|guard|security|secret|schema\.ts|migration|session|token)/i;
const FRONTEND = /^apps\/(dashboard|web|client)\/|^tests\/e2e\//;
const signals = [];
let score = 0;
const add = (n, why) => {
  score += n;
  signals.push(`+${n} ${why}`);
};

if (files.length >= 6) add(2, `${files.length} files`);
else if (files.length >= 3) add(1, `${files.length} files`);
if (maxFileRisk === 2) add(3, 'HIGH-risk file');
else if (maxFileRisk === 1) add(1, 'MEDIUM-risk file');
if (perFile.some((f) => (f.tables || []).length)) add(1, 'touches DB tables');
if (perFile.some((f) => (f.entity_tables || []).length)) add(3, 'schema/entity change');
if (perFile.some((f) => (f.dependents || []).length >= 5 || (f.importers || []).length >= 5)) add(2, 'high fan-in (>=5 consumers)');
if (perFile.some((f) => (f.co_consumers || []).length >= 5)) add(1, 'table shared by >=5 services');
if (files.some((f) => HIGH_RISK_PATH.test(f))) add(2, 'financial/auth/security path');
if (files.some((f) => FRONTEND.test(f))) add(1, 'frontend/e2e surface');
if (files.some((f) => /^infra\/postgres\/migrations\//.test(f))) add(4, 'migration path');
if (security) add(3, 'declared security task');
if (impact.freshness && impact.freshness.state !== 'FRESH') add(1, 'knowledge STALE (verify against source)');

// ---- tier + execution recommendation ----------------------------------------
// CRITICAL is reserved for security + high blast radius; migrations/schema also land here.
let tier;
if ((security && score >= 6) || perFile.some((f) => (f.entity_tables || []).length) || files.some((f) => /^infra\/postgres\/migrations\//.test(f)))
  tier = 'CRITICAL';
else if (score >= 6) tier = 'HIGH';
else if (score >= 3) tier = 'MEDIUM';
else if (score >= 1) tier = 'SMALL';
else tier = 'TRIVIAL';

const PLANS = {
  TRIVIAL: { execution_mode: 'direct', specialists: 0, review_depth: 'self', validation_depth: 'targeted', parallel_useful: false, human_approval: false, token_budget: 30000, wall_clock_min: 5 },
  SMALL: { execution_mode: 'direct-or-single-specialist', specialists: 1, review_depth: 'self+targeted', validation_depth: 'targeted+typecheck', parallel_useful: false, human_approval: false, token_budget: 80000, wall_clock_min: 15 },
  MEDIUM: { execution_mode: 'workflow (analyze->implement)', specialists: 2, review_depth: 'integration-barrier', validation_depth: 'targeted+full-backend', parallel_useful: true, human_approval: false, token_budget: 250000, wall_clock_min: 25 },
  HIGH: { execution_mode: 'full workflow + adversarial review', specialists: 2, review_depth: 'adversarial cto-architect', validation_depth: 'full-backend+build+e2e-if-frontend', parallel_useful: true, human_approval: 'for side effects (push/deploy)', token_budget: 400000, wall_clock_min: 30 },
  CRITICAL: { execution_mode: 'full workflow + security reviewer + broad validation', specialists: 2, review_depth: 'adversarial + security', validation_depth: 'full-backend+build+e2e+remote-security-gate', parallel_useful: true, human_approval: 'REQUIRED (push + any migration/deploy)', token_budget: 500000, wall_clock_min: 40 },
};
const plan = PLANS[tier];

// ---- validation router (F3) — evidence-tagged, UNKNOWN escalates ------------
const verifiedTests = impact.targeted_tests?.verified || [];
const conventionTests = impact.targeted_tests?.convention_hints || [];
const noCoverageFiles = perFile
  .filter((f) => /^apps\/|^packages\//.test(f.file) && !/\.(test|spec)\.ts$/.test(f.file) && !(f.tests_verified || []).length)
  .map((f) => f.file);

const validation = {
  directly_verified: verifiedTests, // VERIFIED test_links
  impact_adjacent: conventionTests, // INFERRED convention hints
  unknown_coverage: noCoverageFiles, // AMBIGUOUS -> escalates broader
  broader_required: impact.broader_validation?.required || noCoverageFiles.length > 0 || tier === 'HIGH' || tier === 'CRITICAL',
  broader_reasons: [
    ...(impact.broader_validation?.reasons || []),
    ...(noCoverageFiles.length ? [`${noCoverageFiles.length} changed file(s) with NO verified test link — UNKNOWN coverage, escalate`] : []),
  ],
  security_gate: security || files.some((f) => HIGH_RISK_PATH.test(f)),
  remote_gate: 'CodeQL + CI must confirm on push (final arbiter); do not claim fixed locally',
  gates: [
    'npm --workspace @afrows/backend run typecheck',
    ...(verifiedTests.length ? ['targeted: ' + verifiedTests.join(', ')] : []),
    ...((impact.broader_validation?.required || noCoverageFiles.length || tier === 'HIGH' || tier === 'CRITICAL') ? ['npm run test:backend'] : []),
    ...(files.some((f) => FRONTEND.test(f)) ? ['npm run build --workspaces --if-present', 'npm run test:e2e'] : []),
    'npm run secrets:check',
  ],
};

const routing = {
  schema: 'afrows-routing/v1',
  freshness: impact.freshness,
  changed_files: files,
  overall_risk: impact.overall_risk,
  complexity: { tier, score, signals },
  plan,
  validation,
  note:
    'Deterministic risk-driven routing. TRIVIAL/SMALL should NOT pay for the full workflow; HIGH/CRITICAL should. UNKNOWN coverage always escalates to broader validation. Remote CodeQL/CI is the final security arbiter.',
};

if (asJson) {
  console.log(JSON.stringify(routing, null, 2));
} else {
  const L = console.log;
  L('Afrows router');
  L('=============');
  L(`Freshness: ${impact.freshness?.state}  | overall risk: ${impact.overall_risk}`);
  L(`Complexity: ${tier}  (score ${score}: ${signals.join('; ') || 'no signals'})`);
  L(`Execution: ${plan.execution_mode}  | specialists ${plan.specialists} | parallel useful: ${plan.parallel_useful}`);
  L(`Review: ${plan.review_depth}  | validation: ${plan.validation_depth}`);
  L(`Budget: ~${plan.token_budget} tokens / ~${plan.wall_clock_min}min  | human approval: ${plan.human_approval}`);
  L('');
  L(`Validation — directly verified: ${validation.directly_verified.length ? validation.directly_verified.join(', ') : '(none)'}`);
  if (validation.unknown_coverage.length) L(`  UNKNOWN coverage (escalates): ${validation.unknown_coverage.join(', ')}`);
  L(`  broader required: ${validation.broader_required}${validation.broader_reasons.length ? ' — ' + validation.broader_reasons.join('; ') : ''}`);
  L(`  security gate: ${validation.security_gate} | remote: ${validation.remote_gate}`);
}
