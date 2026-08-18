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
  b += `\n## Related tests (by reference)\n`;
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
  b += `\n## Related tests (by reference)\n`;
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
    if (tests.length) b += `- **Recommended tests (by reference):** ${tests.map((t) => '`' + t + '`').join(', ')}\n`;
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
  b += `\n- **Graph artifact time (graph.json mtime):** ${graphMtime}\n`;
  b += `- **Source git SHA:** _not stamped in Graphify artifacts — UNKNOWN_ (treat graph as a HINT if it may predate current HEAD).\n`;
  b += `- **Nodes:** ${graph.nodes.length}\n`;
  b += `- **Edges:** ${edges.length}\n`;
  b += `- **Bridge edges:** ${(bridges.edges || []).length} (entity↔table ${bridgeAnalysis.entity_table_edges}, table↔service ${bridgeAnalysis.table_service_edges})\n`;
  b += `- **Migration-backed tables:** ${allTables.size}\n`;
  b += `- **Modeled Drizzle entities:** ${schemaMap.length}\n`;
  b += `- **Intentional raw-SQL exceptions:** ${rawExceptions.size} — ${sortBy([...rawExceptions], (x) => x).map((t) => wl('tbl-' + t)).join(', ')}\n`;
  b += `\n## Provenance rules\n`;
  b += `- **VERIFIED / EXTRACTED:** AST edges (\`_origin: ast\`) and bridge edges (schema↔code) with a \`source_location\`/evidence line — trust as fact.\n`;
  b += `- **INFERRED:** LLM/semantic edges and community membership — hints; verify against source.\n`;
  b += `- **INTENTIONAL EXCEPTION:** the 4 Class-C raw-SQL tables — documented in \`docs/schema-drift-audit.md\`.\n`;
  b += `\n## Known limitations\n`;
  b += `- Foreign-key and service→service edges are NOT in the current artifacts; FKs live in migrations/\`schema.ts\`.\n`;
  b += `- ~1,445 weakly-connected nodes are config leaves (tsconfig/package keys), not documentation gaps.\n`;
  b += `- "Related tests" are textual-reference matches, not import-verified.\n`;
  b += `- No git-SHA stamp: staleness cannot be auto-detected — regenerate the graph if source may have changed.\n`;
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
