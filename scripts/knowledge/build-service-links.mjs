#!/usr/bin/env node
// Deterministic NestJS service -> service dependency analyzer (constructor DI).
// READ-ONLY over the repo; writes only graphify-out/service_links.json.
//
//   node scripts/knowledge/build-service-links.mjs
//
// Evidence (never LLM/semantic):
//   SERVICE_DI            VERIFIED_DIRECT_DI   — constructor param typed as a known @Injectable/@Controller provider class
//   SERVICE_TOKEN_DI      VERIFIED_TOKEN_DI    — @Inject(TOKEN) resolved to a provider via a module `{ provide: TOKEN, useClass: X }`
//   SERVICE_FORWARD_REF_DI VERIFIED_FORWARD_REF — forwardRef(() => X) constructor injection
//   (unresolved)          AMBIGUOUS            — @Inject of a token that resolves to a factory / unknown provider
//
// "DI means A depends on B, not necessarily A calls B" — no SERVICE_CALLS is emitted.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'apps/backend/src');
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const sortBy = (a, f) => [...a].sort((x, y) => (f(x) < f(y) ? -1 : f(x) > f(y) ? 1 : 0));

if (!fs.existsSync(SRC)) { console.error('FATAL: apps/backend/src not found.'); process.exit(1); }
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'dist'].includes(e.name)) walk(p); }
    else if (/\.ts$/.test(e.name) && !/\.(test|spec|d)\.ts$/.test(e.name)) files.push(p);
  }
})(SRC);

// ---- index classes + their kind (@Injectable / @Controller) ---------------
const classInfo = new Map(); // className -> { file, kind }
const CLASS_RE = /export\s+(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/g;
const fileText = new Map();
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  fileText.set(f, txt);
  const lines = txt.split('\n');
  let m;
  CLASS_RE.lastIndex = 0;
  while ((m = CLASS_RE.exec(txt)) !== null) {
    const name = m[1];
    const declLine = txt.slice(0, m.index).split('\n').length; // 1-based
    // look back up to 6 non-empty lines for @Injectable / @Controller
    let kind = 'class';
    for (let i = declLine - 2; i >= 0 && i >= declLine - 8; i--) {
      const l = (lines[i] || '').trim();
      if (l === '') continue;
      if (/@Injectable\(/.test(l)) { kind = 'injectable'; break; }
      if (/@Controller\(/.test(l)) { kind = 'controller'; break; }
      if (!l.startsWith('@')) break; // stop at first non-decorator, non-blank line
    }
    if (!classInfo.has(name)) classInfo.set(name, { file: rel(f), kind });
  }
}

// ---- token -> provider class (from module `provide/useClass`) --------------
const tokenToClass = new Map();
const tokenFactory = new Set();
for (const f of files) {
  if (!/\.module\.ts$/.test(f)) continue;
  const txt = fileText.get(f);
  for (const m of txt.matchAll(/\{\s*provide:\s*([A-Za-z_$][\w$]*)\s*,\s*useClass:\s*([A-Za-z_$][\w$]*)/g)) tokenToClass.set(m[1], m[2]);
  for (const m of txt.matchAll(/\{\s*provide:\s*([A-Za-z_$][\w$]*)\s*,\s*useExisting:\s*([A-Za-z_$][\w$]*)/g)) tokenToClass.set(m[1], m[2]);
  for (const m of txt.matchAll(/\{\s*provide:\s*([A-Za-z_$][\w$]*)\s*,\s*useFactory/g)) tokenFactory.add(m[1]);
}

// ---- balanced-paren constructor param extraction --------------------------
function constructorParams(txt, fromIdx) {
  const open = txt.indexOf('(', fromIdx);
  if (open < 0) return null;
  let depth = 0, i = open;
  for (; i < txt.length; i++) {
    if (txt[i] === '(') depth++;
    else if (txt[i] === ')') { depth--; if (depth === 0) break; }
  }
  return { body: txt.slice(open + 1, i), start: open };
}
function splitTopLevel(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if ('([{<'.includes(ch)) depth++;
    else if (')]}>'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// ---- build DI edges --------------------------------------------------------
const EXTERNAL = new Set(['ConfigService', 'JwtService', 'Reflector', 'HttpService', 'ModuleRef', 'EventEmitter2', 'SchedulerRegistry']);
const edges = [];
const unresolved = [];
for (const f of files) {
  const txt = fileText.get(f);
  // attribute each constructor to the nearest preceding class decl
  const decls = [];
  CLASS_RE.lastIndex = 0; let cm;
  while ((cm = CLASS_RE.exec(txt)) !== null) decls.push({ name: cm[1], idx: cm.index });
  for (const km of txt.matchAll(/\bconstructor\s*\(/g)) {
    const ctorIdx = km.index;
    const owner = [...decls].reverse().find((d) => d.idx < ctorIdx);
    if (!owner) continue;
    const info = classInfo.get(owner.name);
    if (!info || (info.kind !== 'injectable' && info.kind !== 'controller')) continue; // only DI consumers
    const params = constructorParams(txt, ctorIdx);
    if (!params) continue;
    for (const raw of splitTopLevel(params.body)) {
      const p = raw.trim();
      if (!p) continue;
      const injectTok = p.match(/@Inject\(\s*([A-Za-z_$][\w$]*)\s*\)/);
      const optional = /@Optional\(/.test(p);
      const fwd = p.match(/forwardRef\(\s*\(\)\s*=>\s*([A-Za-z_$][\w$]*)\s*\)/);
      // strip decorators, then match `<name>: <Type>`
      const stripped = p.replace(/@\w+\([^)]*\)/g, '').replace(/@\w+/g, '');
      const nm = stripped.match(/(?:private|public|protected|readonly|\s)*\s*([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/);
      if (!nm) continue;
      const paramName = nm[1];
      let providerClass = null, type, evidence, token = null;
      if (fwd) { providerClass = fwd[1]; type = 'SERVICE_FORWARD_REF_DI'; evidence = 'VERIFIED_FORWARD_REF'; }
      else if (injectTok) {
        token = injectTok[1];
        if (tokenToClass.has(token)) { providerClass = tokenToClass.get(token); type = 'SERVICE_TOKEN_DI'; evidence = 'VERIFIED_TOKEN_DI'; }
        else { unresolved.push({ consumer: owner.name, consumer_file: rel(f), param: paramName, token, reason: tokenFactory.has(token) ? 'token bound to a factory provider' : 'token not resolved to a useClass provider' }); continue; }
      } else { providerClass = nm[2]; type = 'SERVICE_DI'; evidence = 'VERIFIED_DIRECT_DI'; }
      if (!providerClass || providerClass === owner.name) continue;
      if (EXTERNAL.has(providerClass)) continue; // framework/external providers
      const provInfo = classInfo.get(providerClass);
      if (!provInfo || provInfo.kind !== 'injectable') { // not one of our injectable providers -> not a service edge
        if (injectTok || fwd) unresolved.push({ consumer: owner.name, consumer_file: rel(f), param: paramName, token, provider: providerClass, reason: 'provider class not a known @Injectable' });
        continue;
      }
      const line = txt.slice(0, params.start + params.body.indexOf(raw)).split('\n').length;
      edges.push({
        consumer: owner.name, consumer_file: rel(f), consumer_kind: info.kind,
        provider: providerClass, provider_file: provInfo.file,
        type, evidence, source_file: rel(f), source_location: `${rel(f)}:${line}`,
        param: paramName, token, optional, confidence: 1.0,
      });
    }
  }
}
// dedupe (consumer|provider|type)
const seen = new Set();
const dedup = [];
for (const e of sortBy(edges, (e) => e.consumer + '|' + e.provider + '|' + e.type)) {
  const k = e.consumer + '|' + e.provider + '|' + e.type;
  if (seen.has(k)) continue; seen.add(k); dedup.push(e);
}

// ---- fan-in / fan-out + cycles --------------------------------------------
const adj = new Map(); // consumer -> Set(provider)
const rev = new Map(); // provider -> Set(consumer)
const services = new Set([...classInfo].filter(([, v]) => v.kind === 'injectable').map(([n]) => n));
for (const e of dedup) {
  if (!adj.has(e.consumer)) adj.set(e.consumer, new Set());
  adj.get(e.consumer).add(e.provider);
  if (!rev.has(e.provider)) rev.set(e.provider, new Set());
  rev.get(e.provider).add(e.consumer);
}
const fanOut = (s) => (adj.get(s) ? adj.get(s).size : 0);
const fanIn = (s) => (rev.get(s) ? rev.get(s).size : 0);
// cycle detection (DFS) on the DI graph
const cycles = [];
const WHITE = 0, GRAY = 1, BLACK = 2;
const color = new Map();
function dfs(node, stack) {
  color.set(node, GRAY); stack.push(node);
  for (const nb of sortBy([...(adj.get(node) || [])], (x) => x)) {
    if (color.get(nb) === GRAY) {
      const i = stack.indexOf(nb);
      cycles.push(stack.slice(i).concat(nb));
    } else if ((color.get(nb) || WHITE) === WHITE) dfs(nb, stack);
  }
  stack.pop(); color.set(node, BLACK);
}
for (const s of sortBy([...adj.keys()], (x) => x)) if ((color.get(s) || WHITE) === WHITE) dfs(s, []);

const byCountThenName = (get) => (a, b) => get(b) - get(a) || (a < b ? -1 : a > b ? 1 : 0);
const topFanIn = [...services].filter((s) => fanIn(s) > 0).sort(byCountThenName(fanIn)).slice(0, 12).map((s) => ({ service: s, fan_in: fanIn(s) }));
const topFanOut = [...services].filter((s) => fanOut(s) > 0).sort(byCountThenName(fanOut)).slice(0, 12).map((s) => ({ service: s, fan_out: fanOut(s) }));

const out = {
  schema: 'afrows-service-links/v1',
  note: 'Deterministic NestJS constructor-DI edges (A depends-on B). VERIFIED only; no SERVICE_CALLS, no community/semantic inference.',
  injectable_services: services.size,
  counts: {
    di_edges: dedup.length,
    direct_di: dedup.filter((e) => e.type === 'SERVICE_DI').length,
    forward_ref_di: dedup.filter((e) => e.type === 'SERVICE_FORWARD_REF_DI').length,
    token_di: dedup.filter((e) => e.type === 'SERVICE_TOKEN_DI').length,
    unresolved: unresolved.length,
    cycles: cycles.length,
  },
  edges: dedup,
  unresolved: sortBy(unresolved, (u) => u.consumer + '|' + u.param),
  fan_in_top: topFanIn,
  fan_out_top: topFanOut,
  services_zero_deps: sortBy([...services].filter((s) => fanOut(s) === 0), (x) => x),
  services_zero_dependents: sortBy([...services].filter((s) => fanIn(s) === 0), (x) => x),
  cycles: sortBy(cycles.map((c) => c.join(' -> ')), (x) => x),
};
const OUT = path.join(ROOT, 'graphify-out', 'service_links.json');
if (!fs.existsSync(path.dirname(OUT))) { console.error('FATAL: graphify-out/ missing.'); process.exit(1); }
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

console.log(`service_links.json written: ${rel(OUT)}`);
console.log(`  injectable services:  ${out.injectable_services}`);
console.log(`  DI edges:             ${out.counts.di_edges} (direct ${out.counts.direct_di}, token ${out.counts.token_di}, forwardRef ${out.counts.forward_ref_di})`);
console.log(`  unresolved providers: ${out.counts.unresolved}`);
console.log(`  DI cycles:            ${out.counts.cycles}`);
console.log(`  top fan-in:  ${topFanIn.slice(0, 5).map((x) => x.service + '(' + x.fan_in + ')').join(', ')}`);
console.log(`  top fan-out: ${topFanOut.slice(0, 5).map((x) => x.service + '(' + x.fan_out + ')').join(', ')}`);
