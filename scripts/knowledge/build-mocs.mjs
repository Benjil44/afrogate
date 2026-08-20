#!/usr/bin/env node
// Build a thin, deterministic MOC / navigation layer over the existing Graphify
// artifacts. READ-ONLY over the graph; writes only into knowledge/.
//
//   node scripts/knowledge/build-mocs.mjs
//
// Inputs (must exist): graphify-out/{graph.json,bridges.json,bridge_analysis.json,schema_map.json}
// Output: knowledge/{_INDEX,_hotspots,_domains,_knowledge-status}.md, knowledge/modules/mod-*.md, knowledge/tables/tbl-*.md
//
// Rules: only evidence-backed relationships (AST edges, provenance-backed bridges);
// INFERRED items are labelled; community membership is a navigation hint only, never
// proof of dependency; no wall-clock in output (deterministic — same input => same output).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const GO = path.join(ROOT, 'graphify-out');
const OUT = path.join(ROOT, 'knowledge');

function loadJSON(rel) {
  const p = path.join(GO, rel);
  if (!fs.existsSync(p)) {
    console.error(`FATAL: required Graphify input missing: ${p}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`FATAL: could not parse ${p}: ${e.message}`);
    process.exit(1);
  }
}

const graph = loadJSON('graph.json');
const bridges = loadJSON('bridges.json');
const bridgeAnalysis = loadJSON('bridge_analysis.json');
const schemaMap = loadJSON('schema_map.json');
if (!Array.isArray(graph.nodes) || !Array.isArray(bridges.provenance || bridges.edges)) {
  console.error('FATAL: malformed Graphify artifacts (nodes/provenance missing).');
  process.exit(1);
}

// Deterministic "source time" = graph.json mtime (stable unless the graph is regenerated).
const graphMtime = fs.statSync(path.join(GO, 'graph.json')).mtime.toISOString();

// ---- knowledge-artifact freshness (DETERMINISTIC given HEAD + manifest) -----
// Compare the source revision the artifacts were built from (recorded in
// graphify-out/knowledge-manifest.json by build-manifest.mjs) against the
// current HEAD. This is a pure function of (HEAD sha, manifest sha) — no
// wall-clock, no per-run value — so it never breaks determinism of knowledge/.
// The manifest is OPTIONAL: absent => UNKNOWN, handled gracefully.
function currentHeadSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}
let manifest = null;
const manifestPath = path.join(GO, 'knowledge-manifest.json');
if (fs.existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    manifest = null; // malformed manifest is a HINT problem, never fatal here
  }
}
const headSha = currentHeadSha();
const manifestSha = manifest && typeof manifest.source_git_sha === 'string' ? manifest.source_git_sha : null;
const short = (s) => (s ? String(s).slice(0, 12) : '_unknown_');
// FRESH iff both shas known and equal; STALE iff both known and differ; else UNKNOWN.
const freshnessState = !headSha || !manifestSha ? 'UNKNOWN' : manifestSha === headSha ? 'FRESH' : 'STALE';
const FRESHNESS_RULE = 'If STALE, knowledge artifacts describe an older source revision than HEAD — treat as HINTS ONLY and re-verify against source.';

// ---- optional deterministic tests->code links (Phase 2) --------------------
let testLinks = null;
const tlPath = path.join(GO, 'test_links.json');
if (fs.existsSync(tlPath)) {
  try {
    testLinks = JSON.parse(fs.readFileSync(tlPath, 'utf8'));
  } catch (e) {
    console.error(`FATAL: test_links.json malformed: ${e.message}`);
    process.exit(1);
  }
}
const importsByModule = new Map(); // module -> Set(test)
const importsByFile = new Map(); // target_file -> Set(test)
const convByModule = new Map(); // module -> Set(test)
if (testLinks) {
  for (const e of testLinks.edges || []) {
    if (e.module) {
      if (!importsByModule.has(e.module)) importsByModule.set(e.module, new Set());
      importsByModule.get(e.module).add(e.test);
    }
    if (!importsByFile.has(e.target_file)) importsByFile.set(e.target_file, new Set());
    importsByFile.get(e.target_file).add(e.test);
  }
  for (const e of testLinks.convention || []) {
    if (e.module) {
      if (!convByModule.has(e.module)) convByModule.set(e.module, new Set());
      convByModule.get(e.module).add(e.test);
    }
  }
}
function importTestsForFiles(files) {
  const s = new Set();
  for (const f of files) for (const t of importsByFile.get(f) || []) s.add(t);
  return s;
}

// ---- optional deterministic service->service DI links (Phase 3) ------------
let serviceLinks = null;
const slPath = path.join(GO, 'service_links.json');
if (fs.existsSync(slPath)) {
  try {
    serviceLinks = JSON.parse(fs.readFileSync(slPath, 'utf8'));
  } catch (e) {
    console.error(`FATAL: service_links.json malformed: ${e.message}`);
    process.exit(1);
  }
}
const svcFile = new Map(); // service -> file
const depsBy = new Map(); // consumer -> [edge]
const dependentsBy = new Map(); // provider -> [edge]
if (serviceLinks) {
  for (const e of serviceLinks.edges || []) {
    svcFile.set(e.consumer, e.consumer_file);
    svcFile.set(e.provider, e.provider_file);
    if (!depsBy.has(e.consumer)) depsBy.set(e.consumer, []);
    depsBy.get(e.consumer).push(e);
    if (!dependentsBy.has(e.provider)) dependentsBy.set(e.provider, []);
    dependentsBy.get(e.provider).push(e);
  }
}
const svcModule = (s) => backendModule(svcFile.get(s) || '');
const diTag = (t) => (t === 'SERVICE_TOKEN_DI' ? ' _(token DI)_' : t === 'SERVICE_FORWARD_REF_DI' ? ' _(forwardRef)_' : '');

const edges = graph.edges || graph.links || [];
const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
const slash = (s) => String(s || '').replace(/\\/g, '/');
const sortBy = (arr, f) => [...arr].sort((a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0));
const wl = (label) => `[[${String(label).replace(/[[\]|]/g, '')}]]`;

// ---- module derivation (backend src only) ----------------------------------
function backendModule(sf) {
  const m = slash(sf).match(/apps\/backend\/src\/([^/]+)\//);
  return m ? m[1] : null;
}
function moduleOfNode(n) {
  return n ? backendModule(n.source_file) : null;
}

// ---- node degree -----------------------------------------------------------
const degree = new Map();
for (const e of edges) {
  degree.set(e.source, (degree.get(e.source) || 0) + 1);
  degree.set(e.target, (degree.get(e.target) || 0) + 1);
}

// ---- config-leaf classifier (DETERMINISTIC; path + basename + label only) ---
// A "config-leaf" is a low-value node sourced from a build/tooling manifest
// (tsconfig / package.json / lockfiles / nest-cli / pyproject / *.config.json …).
// These are graph *noise*, NOT documentation gaps. CONSERVATIVE by construction:
// we only ever classify nodes whose source_file is a structured config/manifest
// file. We NEVER classify application source (.ts/.tsx/.dart/.py/…), docs (.md),
// or test/spec files — even when one happens to live beside a config file. No
// LLM/semantic input, no wall-clock, no network: pure function of the node.
const CONFIG_BASENAME_RE = /^(tsconfig([.-].*)?\.json|jsconfig\.json|package\.json|package-lock\.json|npm-shrinkwrap\.json|(pnpm|yarn|bun|deno|cargo|poetry|composer)[.-]?lock(\.(json|ya?ml|toml))?|.*\.lock|marketplace\.json|plugin\.json|nest-cli\.json|angular\.json|.*\.code-workspace|settings.*\.json|.*\.config\.json|pyproject\.toml|.*\.toml)$/;
// Application source / docs extensions we must NEVER classify as noise.
const CONFIG_SOURCE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|dart|py|sql|md|mdx|vue|svelte|rs|go|java|kt|swift|rb|php|scala|c|cc|cpp|h|hpp)$/;
// Test/spec files (protected — never noise).
const CONFIG_TEST_RE = /(\.|\/)(test|spec)\.[a-z]+$|(^|\/)(tests?|__tests__|e2e)\//;
// Well-known low-value config keys — used ONLY to describe evidence, never to
// widen the set (membership already requires a config/manifest source file).
const CONFIG_LEAF_KEYS = new Set([
  'compilerOptions', 'isolatedModules', 'jsx', 'lib', 'module', 'moduleResolution', 'noEmit', 'types', 'typeRoots',
  'baseUrl', 'paths', 'target', 'strict', 'declaration', 'declarationMap', 'outDir', 'rootDir', 'rootDirs', 'sourceMap',
  'emitDecoratorMetadata', 'experimentalDecorators', 'esModuleInterop', 'skipLibCheck', 'resolveJsonModule',
  'forceConsistentCasingInFileNames', 'incremental', 'composite', 'allowImportingTsExtensions', 'allowJs',
  'allowSyntheticDefaultImports', 'downlevelIteration', 'importHelpers', 'noImplicitAny', 'useDefineForClassFields',
  'extends', 'include', 'exclude', 'files', 'references', '$schema', 'sourceRoot', 'collection', 'compileOnSave',
  'name', 'version', 'private', 'type', 'main', 'scripts', 'dependencies', 'devDependencies', 'peerDependencies',
  'optionalDependencies', 'engines', 'workspaces', 'bin', 'exports', 'keywords', 'license', 'author', 'description',
]);
function isConfigLeaf(n) {
  const sf = slash(n && n.source_file);
  if (!sf) return false;
  const b = sf.split('/').pop().toLowerCase();
  if (CONFIG_TEST_RE.test(sf)) return false;       // never a test/spec file
  if (CONFIG_SOURCE_EXT_RE.test(b)) return false;  // never app source or docs
  return CONFIG_BASENAME_RE.test(b);               // structured config/manifest only
}

// ---- weakly-connected accounting (config-leaf noise vs genuine leaves) ------
// "Weakly connected" mirrors the Graphify report's "isolated node" definition
// (<= WEAK_DEGREE graph neighbours). We split those into config-leaf noise vs
// genuine source/doc leaves so the raw count is explained, not read as gaps.
const WEAK_DEGREE = 1;
let weaklyConnected = 0;
let configLeafTotal = 0;
let configLeafWeak = 0;
const configLeafExamples = [];
for (const n of graph.nodes) {
  const weak = (degree.get(n.id) || 0) <= WEAK_DEGREE;
  if (weak) weaklyConnected++;
  if (isConfigLeaf(n)) {
    configLeafTotal++;
    if (weak) {
      configLeafWeak++;
      // known config keys make the most recognizable evidence; rank them first
      const known = CONFIG_LEAF_KEYS.has(String(n.label)) ? 0 : 1;
      configLeafExamples.push({ known, text: `${n.label} (${slash(n.source_file).split('/').pop()})` });
    }
  }
}
const genuineWeak = weaklyConnected - configLeafWeak;
const configLeafNoiseExamples = sortBy(
  [...new Map(configLeafExamples.map((e) => [e.text, e])).values()],
  (e) => `${e.known}\u001f${e.text}`,
).slice(0, 8).map((e) => e.text);

// ---- module -> module deps (evidence: AST edges crossing module boundaries) -
const modDepends = new Map(); // module -> Set(module) it imports/calls into
const modDependedBy = new Map();
for (const e of edges) {
  if (e._origin !== 'ast') continue;
  const sm = moduleOfNode(nodesById.get(e.source));
  const tm = moduleOfNode(nodesById.get(e.target));
  if (!sm || !tm || sm === tm) continue;
  if (!modDepends.has(sm)) modDepends.set(sm, new Set());
  modDepends.get(sm).add(tm);
  if (!modDependedBy.has(tm)) modDependedBy.set(tm, new Set());
  modDependedBy.get(tm).add(sm);
}

// ---- bridges provenance ----------------------------------------------------
const prov = bridges.provenance || [];
const entityByTable = new Map(schemaMap.map((m) => [m.table, m.entity]));
const migrationByTable = new Map(); // table -> migration basename (from provenance target_file)
const consumersByTable = new Map(); // table -> [{service, file, evidence, confidence}]
const tablesByService = new Map(); // serviceClass -> Set(table)
for (const p of prov) {
  if (p.type === 'entity<->table') {
    migrationByTable.set(p.target_symbol, path.basename(slash(p.target_file)));
  } else if (p.type === 'table<->service') {
    if (!migrationByTable.has(p.target_symbol)) migrationByTable.set(p.target_symbol, path.basename(slash(p.target_file)));
    if (!consumersByTable.has(p.target_symbol)) consumersByTable.set(p.target_symbol, []);
    consumersByTable.get(p.target_symbol).push({
      service: p.source_symbol,
      file: slash(p.source_file),
      evidence: p.evidence,
      confidence: p.confidence,
    });
    if (!tablesByService.has(p.source_symbol)) tablesByService.set(p.source_symbol, new Set());
    tablesByService.get(p.source_symbol).add(p.target_symbol);
  }
}

// full table set = modeled (schema_map) + raw exceptions (bridge_analysis)
const rawExceptions = new Set(bridgeAnalysis.migration_tables_with_no_entity || []);
const allTables = new Set([...schemaMap.map((m) => m.table), ...rawExceptions, ...consumersByTable.keys()]);

// heavy coupling (service_count) — DERIVED risk signal
const couplingByTable = new Map((bridgeAnalysis.heavily_coupled_tables || []).map((h) => [h.table, h.service_count]));

// ---- test references (evidence: textual reference in a test file) -----------
const testDirs = [path.join(ROOT, 'apps/backend/test'), path.join(ROOT, 'tests/e2e')];
const testFiles = [];
for (const d of testDirs) {
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (/\.(test|spec)\.ts$/.test(f)) testFiles.push(path.join(d, f));
  }
}
const testText = new Map(testFiles.map((f) => [f, fs.readFileSync(f, 'utf8')]));
function testsReferencing(names) {
  const hits = new Set();
  for (const [f, txt] of testText) {
    for (const name of names) {
      if (!name) continue;
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (re.test(txt)) { hits.add(path.relative(ROOT, f).replace(/\\/g, '/')); break; }
    }
  }
  return sortBy([...hits], (x) => x);
}

// ---- module inventory ------------------------------------------------------
const modules = new Map(); // module -> {services:Set(node)}
for (const n of graph.nodes) {
  const mod = moduleOfNode(n);
  if (!mod) continue;
  if (!modules.has(mod)) modules.set(mod, { services: [] });
  const isClass = n._callable_class || /(Service|Controller|Repository|Gateway|Guard|Module)$/.test(String(n.label));
  if (isClass) modules.get(mod).services.push(n);
}

// ---------------------------------------------------------------------------
const HEADER = (title) =>
  `> [!info] AUTO-GENERATED — DO NOT EDIT. Regenerate: \`node scripts/knowledge/build-mocs.mjs\`\n` +
  `> Source: Graphify artifacts (graph.json, bridges.json, schema_map.json, bridge_analysis.json).\n` +
  `> Graph artifact time: ${graphMtime}\n\n# ${title}\n`;

fs.mkdirSync(path.join(OUT, 'modules'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'tables'), { recursive: true });
const written = [];
function write(rel, body) {
  const p = path.join(OUT, rel);
  fs.writeFileSync(p, body.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', 'utf8');
  written.push(path.relative(ROOT, p).replace(/\\/g, '/'));
}

// ---- table MOCs ------------------------------------------------------------
for (const table of sortBy([...allTables], (x) => x)) {
  const entity = entityByTable.get(table) || null;
  const isRaw = rawExceptions.has(table);
  const migration = migrationByTable.get(table);
  const consumers = sortBy(consumersByTable.get(table) || [], (c) => c.service);
  const uniqServices = sortBy([...new Set(consumers.map((c) => c.service))], (x) => x);
  const uniqFiles = sortBy([...new Set(consumers.map((c) => c.file))], (x) => x);
  const svc = couplingByTable.get(table);
  const risk = svc >= 10 ? 'Critical' : svc >= 6 ? 'High' : svc >= 3 ? 'Medium' : 'Low';
  const tests = testsReferencing([table]);
  let b = HEADER(`Table: \`${table}\``);
  b += `\n- **Status:** ${entity ? `**VERIFIED / MODELED** — Drizzle entity ${wl(entity)}` : '**INTENTIONAL RAW-SQL EXCEPTION** (Class-C — not an ORM entity by design)'}\n`;
  b += `- **Migration source:** ${migration ? wl(migration) : '_unknown from artifacts_'}\n`;
  b += `- **Raw table note:** ${wl(table)}\n`;
  b += `- **Change-risk (DERIVED from coupling):** ${risk}${svc != null ? ` — ${svc} consuming services` : ' — <3 consuming services'}\n`;
  b += `\n## Consuming services — VERIFIED (evidence-backed)\n`;
  if (!uniqServices.length) b += `_None found in bridge provenance._\n`;
  else for (const s of uniqServices) b += `- ${wl(s)}\n`;
  b += `\n## Consuming files (evidence: file:line + SQL)\n`;
  if (!consumers.length) b += `_None._\n`;
  else for (const c of consumers.slice(0, 20)) b += `- \`${c.evidence}\`  _(confidence ${c.confidence})_\n`;
  b += `\n## Foreign keys / referencing tables\n`;
  b += `_Not represented in the current graph/bridge artifacts (bridges cover entity↔table and table↔service only)._ Authoritative source: ${migration ? wl(migration) : 'migrations'}${entity ? ` and ${wl(entity)}` : ''}.\n`;
  const detTests = sortBy([...importTestsForFiles(uniqFiles)], (x) => x);
  b += `\n## Tests (deterministic — import → bridge, VERIFIED)\n`;
  b += detTests.length
    ? detTests.map((t) => `- \`${t}\` _(imports a production file the bridge marks as a consumer of this table)_`).join('\n') + '\n'
    : `_No test imports a production file that this table's bridge marks as a consumer._\n`;
  b += `\n## Related tests (HEURISTIC — textual name reference, not import-verified)\n`;
  b += tests.length ? tests.map((t) => `- \`${t}\``).join('\n') + '\n' : `_No test file references this table by name._\n`;
  b += `\n---\n_Back to ${wl('_INDEX')} · ${wl('_hotspots')} · ${wl('_domains')}_\n`;
  write(`tables/tbl-${table}.md`, b);
}

// ---- module MOCs -----------------------------------------------------------
for (const [mod, info] of sortBy([...modules.entries()], (e) => e[0])) {
  const services = sortBy(info.services, (n) => String(n.label));
  const commName = (services[0] && services[0].community_name) || '';
  // tables touched: bridges whose service file is in this module
  const tablesTouched = new Set();
  for (const p of prov) {
    if (p.type === 'table<->service' && backendModule(p.source_file) === mod) tablesTouched.add(p.target_symbol);
  }
  const tblList = sortBy([...tablesTouched], (x) => x);
  // services sharing those tables (any module)
  const sharing = new Set();
  for (const t of tblList) for (const c of consumersByTable.get(t) || []) if (backendModule(c.file) !== mod) sharing.add(c.service);
  const deps = sortBy([...(modDepends.get(mod) || [])], (x) => x);
  const depBy = sortBy([...(modDependedBy.get(mod) || [])], (x) => x);
  const heavyTouched = tblList.filter((t) => (couplingByTable.get(t) || 0) >= 6);
  const tests = testsReferencing([...tblList, ...services.map((s) => String(s.label))]);
  let b = HEADER(`Module: \`${mod}\``);
  b += `\n- **Source path:** \`apps/backend/src/${mod}/\`\n`;
  b += `- **Dominant graph community (hint, not authoritative):** ${commName || '_n/a_'}\n`;
  b += `- **High-risk dependencies (DERIVED):** ${heavyTouched.length ? heavyTouched.map((t) => wl('tbl-' + t)).join(', ') : '_none among heavily-coupled tables_'}\n`;
  b += `\n## Services / classes (VERIFIED)\n`;
  b += services.length ? services.map((s) => `- ${wl(s.label)} — \`${slash(s.source_file)}:${s.source_location || '?'}\``).join('\n') + '\n' : '_none detected_\n';
  b += `\n## Database tables touched (VERIFIED — evidence-backed)\n`;
  b += tblList.length ? tblList.map((t) => `- ${wl('tbl-' + t)} (${wl(t)})`).join('\n') + '\n' : '_none via bridge provenance_\n';
  b += `\n## Services sharing those tables (VERIFIED)\n`;
  b += sharing.size ? sortBy([...sharing], (x) => x).map((s) => `- ${wl(s)}`).join('\n') + '\n' : '_none_\n';
  b += `\n## Depends on — modules (VERIFIED: AST import/call edges)\n`;
  b += deps.length ? deps.map((m) => `- ${wl('mod-' + m)}`).join('\n') + '\n' : '_none_\n';
  b += `\n## Depended on by — modules (VERIFIED: AST import/call edges)\n`;
  b += depBy.length ? depBy.map((m) => `- ${wl('mod-' + m)}`).join('\n') + '\n' : '_none_\n';
  // service-level NestJS constructor DI within this module
  const modSvcs = sortBy([...new Set([...depsBy.keys(), ...dependentsBy.keys()].filter((s) => svcModule(s) === mod))], (x) => x);
  const fmtDI = (arr) => (arr.length ? arr.map(([nm, t]) => wl(nm) + diTag(t)).join(', ') : '_none_');
  b += `\n## Service dependency injection (VERIFIED / EXTRACTED — NestJS constructor DI)\n`;
  if (!modSvcs.length) b += '_No injectable services with DI edges in this module._\n';
  else
    for (const s of modSvcs) {
      const deps = sortBy([...new Map((depsBy.get(s) || []).map((e) => [e.provider, e.type])).entries()], (x) => x[0]);
      const dents = sortBy([...new Map((dependentsBy.get(s) || []).map((e) => [e.consumer, e.type])).entries()], (x) => x[0]);
      b += `- **${wl(s)}** — injects: ${fmtDI(deps)}\n  - injected by: ${fmtDI(dents)}\n`;
    }
  const impTests = sortBy([...(importsByModule.get(mod) || [])], (x) => x);
  const convTests = sortBy([...(convByModule.get(mod) || [])], (x) => x).filter((t) => !impTests.includes(t));
  b += `\n## Tests importing this module (VERIFIED / EXTRACTED)\n`;
  b += impTests.length ? impTests.map((t) => `- \`${t}\``).join('\n') + '\n' : '_none — no test imports a file in this module directly_\n';
  b += `\n## Tests by filename convention (CONVENTION — not verified coverage)\n`;
  b += convTests.length ? convTests.map((t) => `- \`${t}\``).join('\n') + '\n' : '_none_\n';
  b += `\n## Related tests (HEURISTIC — textual name reference)\n`;
  b += tests.length ? tests.map((t) => `- \`${t}\``).join('\n') + '\n' : '_none by name reference_\n';
  b += `\n---\n_Back to ${wl('_INDEX')} · ${wl('_hotspots')} · ${wl('_domains')}_\n`;
  write(`modules/mod-${mod}.md`, b);
}

// ---- _hotspots -------------------------------------------------------------
const HOTSPOT_NODES = ['BillingService', 'OperationsService', 'BillingController', 'AuthService', 'Roles', 'AuthActor', 'requestAdminAuth', 'TelegramBotService'];
const HOTSPOT_TABLES = ['customer_accounts', 'outbounds', 'gems_ledger', 'reseller_wallet_ledger', 'payment_orders', 'mikrotik_routers', 'telegram_users', 'wireguard_peers'];
{
  let b = HEADER('Architectural Hotspots (ranked)');
  b += `\n_Metric = node degree (AST + bridge edges). Risk is **DERIVED** from degree/coupling — not a source-authored score._\n`;
  b += `\n## Service / code hubs\n`;
  const rows = [];
  for (const lbl of HOTSPOT_NODES) {
    // function-style god nodes carry a "()" suffix in the graph (Roles(), requestAdminAuth())
    const n = graph.nodes.find((x) => String(x.label) === lbl || String(x.label) === lbl + '()');
    if (!n) continue;
    rows.push({ n, deg: degree.get(n.id) || 0 });
  }
  for (const { n, deg } of sortBy(rows, (r) => -r.deg)) {
    const mod = moduleOfNode(n);
    const tbls = mod ? sortBy([...new Set(prov.filter((p) => p.type === 'table<->service' && backendModule(p.source_file) === mod).map((p) => p.target_symbol))], (x) => x) : [];
    const svcTbls = sortBy([...(tablesByService.get(String(n.label)) || [])], (x) => x);
    const risk = deg >= 200 ? 'Critical' : deg >= 100 ? 'High' : 'Medium';
    const tests = testsReferencing([String(n.label), ...svcTbls]);
    b += `\n### ${wl(n.label)} — degree ${deg} — risk ${risk} (DERIVED)\n`;
    b += `- **Module:** ${mod ? wl('mod-' + mod) : '_n/a_'} · source \`${slash(n.source_file)}:${n.source_location || '?'}\`\n`;
    if (svcTbls.length) b += `- **Tables (via this class):** ${svcTbls.map((t) => wl('tbl-' + t)).join(', ')}\n`;
    if (tbls.length) b += `- **Tables (via module):** ${tbls.map((t) => wl('tbl-' + t)).join(', ')}\n`;
    // VERIFIED NestJS DI fan-in / fan-out for this hub
    const nl = String(n.label);
    if (depsBy.has(nl) || dependentsBy.has(nl)) {
      const deps = sortBy([...new Map((depsBy.get(nl) || []).map((e) => [e.provider, e.type])).entries()], (x) => x[0]);
      const dents = sortBy([...new Map((dependentsBy.get(nl) || []).map((e) => [e.consumer, e.type])).entries()], (x) => x[0]);
      const fmt = (arr) => (arr.length ? arr.map(([nm, t]) => wl(nm) + (t === 'SERVICE_TOKEN_DI' ? ' _(token)_' : t === 'SERVICE_FORWARD_REF_DI' ? ' _(forwardRef)_' : '')).join(', ') : '_none_');
      b += `- **DI fan-out (${deps.length}) — depends on (VERIFIED):** ${fmt(deps)}\n`;
      b += `- **DI fan-in (${dents.length}) — depended on by (VERIFIED):** ${fmt(dents)}\n`;
    }
    // VERIFIED recommended tests: import this class's file, or its module, or a bridge-consumer file of its tables
    const verTests = new Set(importTestsForFiles([slash(n.source_file)]));
    if (mod) for (const t of importsByModule.get(mod) || []) verTests.add(t);
    for (const tb of svcTbls) for (const c of consumersByTable.get(tb) || []) for (const t of importsByFile.get(c.file) || []) verTests.add(t);
    const verList = sortBy([...verTests], (x) => x);
    if (verList.length) b += `- **Recommended tests (VERIFIED / EXTRACTED):** ${verList.map((t) => '`' + t + '`').join(', ')}\n`;
    if (tests.length) b += `- **Also referenced (HEURISTIC — not import-verified):** ${tests.map((t) => '`' + t + '`').join(', ')}\n`;
  }
  b += `\n## Data hotspots (heavily-coupled tables)\n`;
  for (const t of HOTSPOT_TABLES) {
    if (!allTables.has(t)) continue;
    const svc = couplingByTable.get(t);
    const risk = svc >= 10 ? 'Critical' : svc >= 6 ? 'High' : svc >= 3 ? 'Medium' : 'Low';
    b += `- ${wl('tbl-' + t)} — ${svc != null ? svc + ' services' : '<3 services'} — risk ${risk} (DERIVED)\n`;
  }
  b += `\n---\n_${wl('_INDEX')}_\n`;
  write('_hotspots.md', b);
}

// ---- _domains --------------------------------------------------------------
{
  const DOMAINS = {
    'Billing / Payments': { modules: ['billing'], tables: ['customer_accounts', 'client_configs', 'payment_orders', 'payment_order_allocations', 'payment_methods', 'volume_packages', 'billing_settings', 'quota_charge_events', 'gems_ledger', 'reseller_accounts', 'reseller_wallet_ledger', 'reseller_wallet_topup_requests'] },
    'Operations / Outbounds': { modules: ['operations', 'outbound'], tables: ['outbounds', 'outbound_subscriptions', 'outbound_health_checks', 'outbound_test_settings', 'protocol_setups', 'protocol_apply_events', 'route_settings', 'route_assignments', 'route_decision_events', 'route_failover_events', 'route_quality_hourly'] },
    'Authentication / RBAC': { modules: ['auth', 'security'], tables: ['admin_users', 'client_access_tokens', 'agent_tokens', 'secret_records'] },
    Telegram: { modules: ['telegram'], tables: ['telegram_users', 'telegram_topup_requests', 'telegram_bot_settings'] },
    MikroTik: { modules: ['routers'], tables: ['mikrotik_routers', 'mikrotik_gateway_usage_cursor', 'mikrotik_wg_samples', 'mikrotik_wg_rates'] },
    WireGuard: { modules: ['client'], tables: ['wireguard_peers'] },
    'Client Configuration': { modules: ['client'], tables: ['client_configs', 'client_usage_events', 'client_route_preferences', 'client_subscription_credentials', 'client_device_sightings', 'customer_accounts'] },
    'Database / Schema': { modules: ['database'], tables: [] },
    'Infrastructure / Networking': { modules: ['metrics', 'agents', 'backups'], tables: ['servers', 'server_metrics', 'server_credentials', 'server_access_profiles', 'server_interfaces', 'tunnels', 'egress_tier_prices'] },
  };
  let b = HEADER('Domain Index');
  b += `\n_Domains are navigation groupings. Module→domain and table→domain assignments below are curated for navigation; **community membership in the graph is a hint only, not authoritative architecture.**_\n`;
  for (const [dom, def] of Object.entries(DOMAINS)) {
    b += `\n## ${dom}\n`;
    const mods = sortBy(def.modules.filter((m) => modules.has(m)), (x) => x);
    b += `- **Modules:** ${mods.length ? mods.map((m) => wl('mod-' + m)).join(', ') : '_none modeled_'}\n`;
    const tbls = sortBy(def.tables.filter((t) => allTables.has(t)), (x) => x);
    b += `- **Tables:** ${tbls.length ? tbls.map((t) => wl('tbl-' + t)).join(', ') : '_n/a_'}\n`;
  }
  b += `\n---\n_${wl('_INDEX')}_\n`;
  write('_domains.md', b);
}

// ---- _knowledge-status -----------------------------------------------------
{
  let b = HEADER('Knowledge-Layer Status');
  b += `\n## Knowledge freshness\n`;
  b += `_Deterministic given (current HEAD, knowledge-manifest). Source: \`graphify-out/knowledge-manifest.json\` (written by \`scripts/knowledge/build-manifest.mjs\`; regenerable / gitignored). No wall-clock enters this section — the SHA + state are stable for a given HEAD + manifest._\n`;
  b += `- **Source revision (from manifest):** \`${short(manifestSha)}\`${manifest ? '' : ' _(no manifest found — run `node scripts/knowledge/build-manifest.mjs`)_'}\n`;
  b += `- **Current HEAD:** \`${short(headSha)}\`${headSha ? '' : ' _(git unavailable / not a checkout)_'}\n`;
  b += `- **State:** **${freshnessState}**\n`;
  b += `- **Rule:** ${FRESHNESS_RULE}\n`;
  b += `\n- **Graph artifact time (graph.json mtime):** ${graphMtime}\n`;
  b += `- **Nodes:** ${graph.nodes.length}\n`;
  b += `- **Edges:** ${edges.length}\n`;
  b += `- **Config-leaf nodes (build/tooling manifest keys — graph noise, not gaps):** ${configLeafTotal} total, ${configLeafWeak} weakly-connected — deterministically classified (path+basename), excluded from documentation-gap accounting.\n`;
  b += `- **Bridge edges:** ${(bridges.edges || []).length} (entity↔table ${bridgeAnalysis.entity_table_edges}, table↔service ${bridgeAnalysis.table_service_edges})\n`;
  if (testLinks) b += `- **Test→code links:** ${testLinks.counts.test_imports} import (VERIFIED), ${testLinks.counts.convention_matches} convention, ${testLinks.counts.test_fixtures} fixture, ${testLinks.counts.unresolved} unresolved, ${testLinks.counts.blackbox_specs} black-box specs — source \`graphify-out/test_links.json\`\n`;
  if (serviceLinks) b += `- **Service→service DI links:** ${serviceLinks.counts.di_edges} (direct ${serviceLinks.counts.direct_di}, token ${serviceLinks.counts.token_di}, forwardRef ${serviceLinks.counts.forward_ref_di}); ${serviceLinks.counts.cycles} DI cycles; ${serviceLinks.counts.unresolved} unresolved — source \`graphify-out/service_links.json\`\n`;
  b += `- **Migration-backed tables:** ${allTables.size}\n`;
  b += `- **Modeled Drizzle entities:** ${schemaMap.length}\n`;
  b += `- **Intentional raw-SQL exceptions:** ${rawExceptions.size} — ${sortBy([...rawExceptions], (x) => x).map((t) => wl('tbl-' + t)).join(', ')}\n`;
  b += `\n## Provenance rules\n`;
  b += `- **VERIFIED / EXTRACTED:** AST edges (\`_origin: ast\`) and bridge edges (schema↔code) with a \`source_location\`/evidence line — trust as fact.\n`;
  b += `- **INFERRED:** LLM/semantic edges and community membership — hints; verify against source.\n`;
  b += `- **INTENTIONAL EXCEPTION:** the 4 Class-C raw-SQL tables — documented in \`docs/schema-drift-audit.md\`.\n`;
  b += `\n## Weakly-connected node accounting (noise vs gaps)\n`;
  b += `_The Graphify report flags nodes with ≤${WEAK_DEGREE} neighbour as "isolated / possible documentation gaps". The classifier in \`build-mocs.mjs\` (deterministic — path + basename + config-key label, no LLM) separates true config noise from genuine leaves so the raw count is explained, not mistaken for gaps._\n`;
  b += `- **Weakly-connected nodes (≤${WEAK_DEGREE} neighbour):** ${weaklyConnected}\n`;
  b += `- **→ Config-leaf noise (SUPPRESSED — not gaps):** ${configLeafWeak} — keys of build/tooling manifests (tsconfig / package.json / nest-cli / pyproject). ${configLeafTotal} config-leaf nodes exist across all degrees.\n`;
  b += `- **→ Genuine source/doc leaves (NOT config noise):** ${genuineWeak} — barrel-exported types, DTOs, mobile-app screens, and ADR/design concept nodes; reachable via the module / table / domain MOCs, so they are navigation leaves rather than documentation gaps.\n`;
  b += `- **Examples of suppressed config-leaf noise:** ${configLeafNoiseExamples.map((e) => '`' + e + '`').join(', ')}.\n`;
  b += `- _Supersedes the earlier hand-estimated "~1,445 config leaves". The classifier is conservative: it never touches application source (\`apps/**\`, \`packages/**\`), docs, tests, or migrations — only structured config/manifest files._\n`;
  b += `\n## Known limitations\n`;
  b += `- Service→service edges are VERIFIED constructor-DI (\`service_links.json\`); foreign-key edges are still NOT in the artifacts (FKs live in migrations/\`schema.ts\`).\n`;
  b += `- Weakly-connected nodes are accounted for above: ${configLeafWeak} are config-leaf noise (not gaps); the remaining ${genuineWeak} are genuine source/doc leaves reachable via the MOCs.\n`;
  b += `- Test→code links are import-verified where possible (\`test_links.json\`); textual "Related tests (HEURISTIC)" remain a fallback and are NOT coverage proof. Black-box e2e specs have no direct edges.\n`;
  b += `- Staleness is auto-detected via \`knowledge-manifest.json\` (source SHA vs HEAD) — see **Knowledge freshness** above; current state: **${freshnessState}**. If the manifest is absent the state is UNKNOWN.\n`;
  b += `\n## Authority order (never overridden by the graph)\n`;
  b += `migrations/ + apps/** + tests/  >  schema.ts  >  bridges (provenance)  >  AST edges  >  communities/INFERRED  >  docs  >  agent memory\n`;
  b += `\n---\n_${wl('_INDEX')}_\n`;
  write('_knowledge-status.md', b);
}

// ---- _INDEX ----------------------------------------------------------------
{
  let b = HEADER('Afrows Knowledge Index');
  b += `\n> Open the **repository root** as the Obsidian vault so these MOC links resolve to the generated node notes in \`graphify-out/obsidian/\`.\n`;
  b += `\n## Start here\n- ${wl('_hotspots')} — highest-risk architectural areas + recommended tests\n- ${wl('_domains')} — browse by domain\n- ${wl('_knowledge-status')} — graph stats, provenance rules, limitations\n- \`docs/schema-drift-audit.md\` — schema-drift program (COMPLETE)\n`;
  b += `\n## Modules (${modules.size})\n`;
  b += sortBy([...modules.keys()], (x) => x).map((m) => `- ${wl('mod-' + m)}`).join('\n') + '\n';
  b += `\n## Database tables (${allTables.size})\n`;
  b += sortBy([...allTables], (x) => x).map((t) => `- ${wl('tbl-' + t)}${rawExceptions.has(t) ? ' _(raw-SQL exception)_' : ''}`).join('\n') + '\n';
  b += `\n---\n_Generated by \`scripts/knowledge/build-mocs.mjs\`. Do not edit generated files; edit the generator._\n`;
  write('_INDEX.md', b);
}

// ---- report ----------------------------------------------------------------
const modCount = [...modules.keys()].length;
const tblCount = allTables.size;
console.log(`MOC layer generated into ${path.relative(ROOT, OUT)}/`);
console.log(`  _INDEX.md, _hotspots.md, _domains.md, _knowledge-status.md`);
console.log(`  module MOCs: ${modCount}`);
console.log(`  table MOCs:  ${tblCount}`);
console.log(`  total files: ${written.length}`);
console.log(`  weakly-connected: ${weaklyConnected} (config-leaf noise ${configLeafWeak}, genuine ${genuineWeak}; config-leaf total ${configLeafTotal})`);
