#!/usr/bin/env node
// Deterministic impact analysis + targeted test selection for the Afrows
// engineering orchestrator.
//
//   node scripts/orchestration/impact-report.mjs <file> [<file>...]
//   node scripts/orchestration/impact-report.mjs --changed          # vs HEAD
//   node scripts/orchestration/impact-report.mjs --changed --base origin/main
//   ... [--json]                                                    # machine output
//
// READ-ONLY. Touches no source, writes no files, makes no network calls.
//
// It answers the Checklist-3 questions from EVIDENCE ONLY:
//   what changes / who depends on it / what it depends on / which tables /
//   who else touches those tables / which tests are linked / what risk.
//
// Every finding is tagged with a fact type per AGENTS.md §3:
//   VERIFIED  - extracted edge carrying a source_location
//   DERIVED   - computed from verified edges (e.g. co-consumers, risk)
//   INFERRED  - convention/heuristic (e.g. filename-stem test match)
//   AMBIGUOUS - flagged uncertain; verify against source
//
// Staleness (AGENTS.md §5): if the knowledge manifest describes a revision
// other than HEAD, EVERY derived finding is downgraded to HINTS ONLY and the
// report says so loudly. Absence of a link is never proof of no dependency.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const GO = path.join(ROOT, 'graphify-out');
const slash = (p) => String(p).replace(/\\/g, '/');
const sortBy = (a, f) => [...a].sort((x, y) => (f(x) < f(y) ? -1 : f(x) > f(y) ? 1 : 0));
const uniq = (a) => [...new Set(a)];

// ---- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const useChanged = argv.includes('--changed');
const baseIdx = argv.indexOf('--base');
const base = baseIdx >= 0 ? argv[baseIdx + 1] : null;
let files = argv.filter((a, i) => !a.startsWith('--') && !(baseIdx >= 0 && i === baseIdx + 1));

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

if (useChanged) {
  const range = base ? [`${base}...HEAD`] : [];
  const out = [
    ...git(['diff', '--name-only', ...range]).split('\n'),
    ...git(['diff', '--name-only', '--cached']).split('\n'),
  ].filter(Boolean);
  files = uniq(out);
}
files = uniq(files.map(slash)).filter(Boolean);

if (!files.length) {
  console.error('No files given. Pass paths, or --changed to read them from git.');
  process.exit(2);
}

// ---- load evidence ----------------------------------------------------------
function loadJson(rel) {
  const p = path.join(GO, rel);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}
const testLinks = loadJson('test_links.json');
const serviceLinks = loadJson('service_links.json');
const bridges = loadJson('bridges.json');
const manifest = loadJson('knowledge-manifest.json');

const missing = [
  !testLinks && 'test_links.json',
  !serviceLinks && 'service_links.json',
  !bridges && 'bridges.json',
  !manifest && 'knowledge-manifest.json',
].filter(Boolean);

// ---- freshness (AGENTS.md §5) ----------------------------------------------
let headSha = null;
try {
  headSha = git(['rev-parse', 'HEAD']);
} catch {
  headSha = null;
}
const manifestSha = manifest && typeof manifest.source_git_sha === 'string' ? manifest.source_git_sha : null;
const freshness = !headSha || !manifestSha ? 'UNKNOWN' : manifestSha === headSha ? 'FRESH' : 'STALE';
const hintsOnly = freshness !== 'FRESH';

// ---- risk model (DERIVED, deliberately explicit) ---------------------------
// High-risk surfaces come from AGENTS.md §10 + docs/invariants.md.
const HIGH_RISK_FILE_RE = /(billing|payment|quota|gems|reseller|auth|rbac|guard|security|secret|schema\.ts|session|token)/i;
const HIGH_RISK_PATH_RE = /^(infra\/postgres\/migrations|apps\/backend\/src\/database)\//;
const HIGH_RISK_TABLE_RE = /(customer_accounts|payment|gems|reseller|wallet|billing|admin_users|secret_records|client_access_tokens|quota)/i;
const SHARED_INFRA_RE = /^(packages\/shared|apps\/backend\/src\/database|apps\/backend\/src\/common)\//;

// ---- per-file analysis ------------------------------------------------------
const testEdges = (testLinks && testLinks.edges) || [];
const testFixtures = (testLinks && testLinks.fixtures) || [];
const testConvention = (testLinks && testLinks.convention) || [];
const diEdges = (serviceLinks && serviceLinks.edges) || [];
const fanIn = new Map(((serviceLinks && serviceLinks.fan_in_top) || []).map((r) => [r.service, r.fan_in]));
const bridgeProv = (bridges && bridges.provenance) || [];

// ---- source-level import scan (VERIFIED, authoritative) ---------------------
// DI edges only exist for @Injectable providers. Plain-function modules (e.g.
// operations/command-safety.ts) have ZERO DI edges yet real production
// consumers - the first dry run proved this blind spot. So we also scan the
// SOURCE for import statements resolving to each target file. Source outranks
// every derived artifact in the authority hierarchy, and this stays correct
// even when the graph is stale.
const IMPORT_RE = /import\s+(?:type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
function walkTs(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', 'dist', '.next', 'test', 'tests'].includes(e.name)) walkTs(p, out);
    } else if (/\.(ts|tsx|mts|cts)$/.test(e.name) && !/\.(test|spec|d)\.ts$/.test(e.name)) out.push(p);
  }
}
const prodSources = [];
walkTs(path.join(ROOT, 'apps'), prodSources);
walkTs(path.join(ROOT, 'packages'), prodSources);
// importersOf: target relpath -> sorted list of importing relpaths
const importersOf = new Map();
for (const src of prodSources) {
  const rel = slash(path.relative(ROOT, src));
  let text;
  try {
    text = fs.readFileSync(src, 'utf8');
  } catch {
    continue;
  }
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(text)) !== null) {
    const spec = m[1] || m[2] || m[3];
    if (!spec || !spec.startsWith('.')) continue; // relative imports only
    const base = path.resolve(path.dirname(src), spec);
    for (const cand of [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts')]) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        const target = slash(path.relative(ROOT, cand));
        if (target !== rel) {
          if (!importersOf.has(target)) importersOf.set(target, new Set());
          importersOf.get(target).add(rel);
        }
        break;
      }
    }
  }
}

const perFile = [];
for (const file of sortBy(files, (f) => f)) {
  // VERIFIED tests: a test file imports this production file.
  const verifiedTests = sortBy(
    uniq(testEdges.filter((e) => slash(e.target_file) === file).map((e) => slash(e.test))),
    (x) => x,
  );
  // INFERRED tests: filename-stem convention only (NOT proof of coverage).
  const conventionTests = sortBy(
    uniq(testConvention.filter((e) => slash(e.target_file) === file).map((e) => slash(e.test))),
    (x) => x,
  );
  // VERIFIED DI: who this file's service consumes, and who consumes it.
  const dependsOn = sortBy(
    uniq(diEdges.filter((e) => slash(e.consumer_file) === file).map((e) => e.provider)),
    (x) => x,
  );
  const dependents = sortBy(
    uniq(diEdges.filter((e) => slash(e.provider_file) === file).map((e) => e.consumer)),
    (x) => x,
  );
  const ownServices = sortBy(
    uniq([
      ...diEdges.filter((e) => slash(e.consumer_file) === file).map((e) => e.consumer),
      ...diEdges.filter((e) => slash(e.provider_file) === file).map((e) => e.provider),
    ]),
    (x) => x,
  );
  // VERIFIED tables via table<->service bridges.
  const tables = sortBy(
    uniq(bridgeProv.filter((p) => p.type === 'table<->service' && slash(p.source_file) === file).map((p) => p.target_symbol)),
    (x) => x,
  );
  // DERIVED: other services that touch the same tables (blast radius).
  const coConsumers = sortBy(
    uniq(
      bridgeProv
        .filter((p) => p.type === 'table<->service' && tables.includes(p.target_symbol) && slash(p.source_file) !== file)
        .map((p) => `${p.source_symbol} (${slash(p.source_file)})`),
    ),
    (x) => x,
  );
  // Entity<->table, when schema.ts itself changed.
  const entityTables = sortBy(
    uniq(bridgeProv.filter((p) => p.type === 'entity<->table' && slash(p.source_file) === file).map((p) => p.target_symbol)),
    (x) => x,
  );

  // VERIFIED source-level importers (covers non-DI plain-function modules).
  const importers = sortBy([...(importersOf.get(file) || [])], (x) => x);

  const maxFanIn = Math.max(0, ...ownServices.map((s) => fanIn.get(s) || 0));
  const reasons = [];
  if (HIGH_RISK_PATH_RE.test(file)) reasons.push('migration/database path');
  if (HIGH_RISK_FILE_RE.test(file)) reasons.push('financial/auth/security-sensitive name');
  if (SHARED_INFRA_RE.test(file)) reasons.push('shared infrastructure');
  if (tables.some((t) => HIGH_RISK_TABLE_RE.test(t)) || entityTables.some((t) => HIGH_RISK_TABLE_RE.test(t)))
    reasons.push('touches high-risk table');
  if (dependents.length >= 5) reasons.push(`${dependents.length} DI dependents`);
  if (importers.length >= 5) reasons.push(`${importers.length} source-level importers`);
  if (maxFanIn >= 10) reasons.push(`hub service (fan-in ${maxFanIn})`);
  // A plain-function module with real importers but no DI edges: the importers
  // ARE the blast radius - flag any security/command-building consumer path.
  if (!dependents.length && importers.length && /command|safety|shell|ssh|sanitiz/i.test(file))
    reasons.push(`command-safety surface consumed by ${importers.length} source importer(s)`);
  if (verifiedTests.length === 0 && /^apps\/|^packages\//.test(file) && !/\.(test|spec)\.ts$/.test(file))
    reasons.push('NO verified test link (absence is not proof of no dependency)');

  const risk = reasons.some((r) => /migration|financial|high-risk table|shared infrastructure|hub service/.test(r))
    ? 'HIGH'
    : reasons.length
      ? 'MEDIUM'
      : 'LOW';

  perFile.push({
    file,
    risk,
    risk_reasons: reasons,
    services: ownServices,
    depends_on: dependsOn,
    dependents,
    importers,
    tables,
    entity_tables: entityTables,
    co_consumers: coConsumers,
    tests_verified: verifiedTests,
    tests_convention: conventionTests,
    fixtures: sortBy(uniq(testFixtures.filter((e) => slash(e.target_file) === file).map((e) => slash(e.test))), (x) => x),
  });
}

// ---- aggregate --------------------------------------------------------------
const allVerifiedTests = sortBy(uniq(perFile.flatMap((f) => f.tests_verified)), (x) => x);
const allConventionTests = sortBy(uniq(perFile.flatMap((f) => f.tests_convention)), (x) => x);
const overallRisk = perFile.some((f) => f.risk === 'HIGH') ? 'HIGH' : perFile.some((f) => f.risk === 'MEDIUM') ? 'MEDIUM' : 'LOW';

// Checklist 8: when the blast radius is large or the surface is sensitive, the
// targeted set is NOT sufficient - escalate to the full backend suite.
const broaderReasons = [];
if (overallRisk === 'HIGH') broaderReasons.push('HIGH risk file in the change set');
if (perFile.some((f) => f.entity_tables.length)) broaderReasons.push('schema/entity definition changed');
if (perFile.some((f) => HIGH_RISK_PATH_RE.test(f.file))) broaderReasons.push('migration/database path changed');
if (perFile.some((f) => SHARED_INFRA_RE.test(f.file))) broaderReasons.push('shared infrastructure changed');
if (perFile.some((f) => f.co_consumers.length >= 5)) broaderReasons.push('table shared by >=5 services');
if (files.some((f) => /^tests\/e2e\//.test(f) || /^apps\/(dashboard|web|client)\//.test(f)))
  broaderReasons.push('frontend/e2e surface changed - run E2E');
const needBroader = broaderReasons.length > 0;

const report = {
  schema: 'afrows-impact-report/v1',
  freshness: {
    state: freshness,
    manifest_source_sha: manifestSha ? manifestSha.slice(0, 12) : null,
    head_sha: headSha ? headSha.slice(0, 12) : null,
    rule: hintsOnly
      ? 'STALE/UNKNOWN: every derived finding below is HINTS ONLY - re-verify against source before acting.'
      : 'FRESH: derived findings describe the current revision.',
  },
  missing_artifacts: missing,
  changed_files: files,
  overall_risk: overallRisk,
  fact_types: {
    VERIFIED: 'tests_verified, depends_on, dependents, importers, tables, entity_tables (source-backed)',
    DERIVED: 'co_consumers, risk, broader-validation decision',
    INFERRED: 'tests_convention (filename-stem match, NOT verified coverage)',
    AMBIGUOUS: 'anything absent - absence of a link is not proof of no dependency',
  },
  per_file: perFile,
  targeted_tests: { verified: allVerifiedTests, convention_hints: allConventionTests },
  broader_validation: { required: needBroader, reasons: broaderReasons },
  commands: {
    typecheck: 'npm run typecheck --workspaces --if-present',
    targeted_backend: allVerifiedTests.length
      ? `node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON ${allVerifiedTests
          .filter((t) => t.startsWith('apps/backend/'))
          .map((t) => `"${t.replace(/^apps\/backend\//, '')}"`)
          .join(' ')}`
      : null,
    full_backend: 'npm run test:backend',
    e2e: 'npm run test:e2e',
    build: 'npm run build --workspaces --if-present',
  },
};

// ---- output -----------------------------------------------------------------
if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const L = (s = '') => console.log(s);
  L('Afrows impact report');
  L('====================');
  L(`Freshness: ${freshness}  (manifest ${report.freshness.manifest_source_sha} vs HEAD ${report.freshness.head_sha})`);
  if (hintsOnly) L(`  !! ${report.freshness.rule}`);
  if (missing.length) L(`  !! missing artifacts: ${missing.join(', ')} - run the knowledge generators.`);
  L(`Overall risk: ${overallRisk}`);
  L('');
  for (const f of perFile) {
    L(`- ${f.file}   [risk ${f.risk}]`);
    if (f.risk_reasons.length) L(`    why: ${f.risk_reasons.join('; ')}`);
    if (f.services.length) L(`    services: ${f.services.join(', ')}`);
    if (f.depends_on.length) L(`    depends on (VERIFIED DI): ${f.depends_on.join(', ')}`);
    if (f.dependents.length) L(`    dependents (VERIFIED DI): ${f.dependents.join(', ')}`);
    if (f.importers.length) L(`    importers (VERIFIED source scan): ${f.importers.join(', ')}`);
    if (f.tables.length) L(`    tables (VERIFIED): ${f.tables.join(', ')}`);
    if (f.entity_tables.length) L(`    entity->table (VERIFIED): ${f.entity_tables.join(', ')}`);
    if (f.co_consumers.length) L(`    co-consumers of those tables (DERIVED): ${f.co_consumers.length}`);
    L(`    tests VERIFIED: ${f.tests_verified.length ? f.tests_verified.join(', ') : '(none - AMBIGUOUS, read the source)'}`);
    if (f.tests_convention.length) L(`    tests INFERRED (convention, not coverage): ${f.tests_convention.join(', ')}`);
  }
  L('');
  L(`Targeted tests (VERIFIED): ${allVerifiedTests.length ? allVerifiedTests.join(', ') : '(none)'}`);
  L(`Broader validation required: ${needBroader ? 'YES - ' + broaderReasons.join('; ') : 'no'}`);
}
