#!/usr/bin/env node
// Afrows orchestration telemetry — truthful, local, no external infra.
//
//   node scripts/orchestration/telemetry.mjs record --json '<metrics-json>'
//   node scripts/orchestration/telemetry.mjs record --file <metrics.json>
//   node scripts/orchestration/telemetry.mjs summary [--json]
//   node scripts/orchestration/telemetry.mjs health [--json] [--window N]   (F10 priors/trend)
//
// Records live in graphify-out/telemetry/runs.jsonl (gitignored / local /
// regenerable). Workflow scripts have no filesystem access, so the main loop
// feeds a run's metrics here AFTER it completes, taken from the task
// notification usage block + observed stage outcomes. This module is pure and
// deterministic given its inputs: same records in -> same summary out.

import fs from 'node:fs';
import path from 'node:path';
import { computePriors, healthSignal } from './telemetry-priors.mjs';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'graphify-out', 'telemetry');
const LOG = path.join(DIR, 'runs.jsonl');

const NUM = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// The record shape the CLI validates/normalizes. Missing fields default to 0/[]
// so partial telemetry is still recorded rather than rejected.
function normalizeRecord(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    schema: 'afrows-telemetry/v1',
    task: String(r.task || '(unnamed)'),
    complexity: String(r.complexity || 'UNKNOWN'),
    execution_mode: String(r.execution_mode || 'unknown'),
    outcome: String(r.outcome || 'unknown'), // COMPLETE | BLOCKED | FALLBACK | DIRECT
    // costs
    total_tokens: NUM(r.total_tokens),
    context_tokens: NUM(r.context_tokens),
    coordination_tokens: NUM(r.coordination_tokens),
    implementation_tokens: NUM(r.implementation_tokens),
    review_tokens: NUM(r.review_tokens),
    validation_tokens: NUM(r.validation_tokens),
    wall_clock_ms: NUM(r.wall_clock_ms),
    tool_calls: NUM(r.tool_calls),
    // agents
    agents: NUM(r.agents),
    parallel_groups: NUM(r.parallel_groups),
    worktrees: NUM(r.worktrees),
    // reliability
    retries: NUM(r.retries),
    conflicts: NUM(r.conflicts),
    fallback: Boolean(r.fallback),
    fallback_reason: r.fallback_reason ? String(r.fallback_reason) : null,
    barrier_findings: Array.isArray(r.barrier_findings) ? r.barrier_findings : [],
    human_interventions: NUM(r.human_interventions),
    // validation
    validation_selected: Array.isArray(r.validation_selected) ? r.validation_selected : [],
    validation_executed: Array.isArray(r.validation_executed) ? r.validation_executed : [],
    commits: Array.isArray(r.commits) ? r.commits : [],
    // provenance (NOT time-based — supplied by caller for reproducibility)
    head: r.head ? String(r.head) : null,
    run_id: r.run_id ? String(r.run_id) : null,
    recorded_stamp: r.recorded_stamp ? String(r.recorded_stamp) : null,
  };
}

function readRecords() {
  if (!fs.existsSync(LOG)) return [];
  return fs
    .readFileSync(LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function recordRun(raw) {
  fs.mkdirSync(DIR, { recursive: true });
  const rec = normalizeRecord(raw);
  fs.appendFileSync(LOG, JSON.stringify(rec) + '\n', 'utf8');
  return rec;
}

// Deterministic aggregation — pure function of the record list.
function summarize(records) {
  const n = records.length;
  const sum = (f) => records.reduce((a, r) => a + NUM(f(r)), 0);
  const byOutcome = {};
  for (const r of records) byOutcome[r.outcome] = (byOutcome[r.outcome] || 0) + 1;
  const fallbacks = records.filter((r) => r.fallback).length;
  const successful = records.filter((r) => r.outcome === 'COMPLETE' || r.outcome === 'DIRECT').length;
  const totalTokens = sum((r) => r.total_tokens);
  return {
    schema: 'afrows-telemetry-summary/v1',
    runs: n,
    by_outcome: byOutcome,
    fallback_rate: n ? +(fallbacks / n).toFixed(3) : 0,
    success_rate: n ? +(successful / n).toFixed(3) : 0,
    totals: {
      tokens: totalTokens,
      context_tokens: sum((r) => r.context_tokens),
      coordination_tokens: sum((r) => r.coordination_tokens),
      implementation_tokens: sum((r) => r.implementation_tokens),
      review_tokens: sum((r) => r.review_tokens),
      validation_tokens: sum((r) => r.validation_tokens),
      wall_clock_ms: sum((r) => r.wall_clock_ms),
      tool_calls: sum((r) => r.tool_calls),
      agents: sum((r) => r.agents),
      human_interventions: sum((r) => r.human_interventions),
    },
    averages: {
      tokens_per_run: n ? Math.round(totalTokens / n) : 0,
      tokens_per_successful_run: successful ? Math.round(totalTokens / successful) : 0,
      agents_per_run: n ? +(sum((r) => r.agents) / n).toFixed(1) : 0,
      human_interventions_per_run: n ? +(sum((r) => r.human_interventions) / n).toFixed(2) : 0,
    },
  };
}

// ---- CLI --------------------------------------------------------------------
const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'record') {
  let raw;
  const jsonIdx = rest.indexOf('--json');
  const fileIdx = rest.indexOf('--file');
  if (jsonIdx >= 0) raw = JSON.parse(rest[jsonIdx + 1]);
  else if (fileIdx >= 0) raw = JSON.parse(fs.readFileSync(rest[fileIdx + 1], 'utf8'));
  else {
    console.error('record needs --json <json> or --file <path>');
    process.exit(2);
  }
  const rec = recordRun(raw);
  console.log(`recorded: ${rec.task} [${rec.complexity}/${rec.outcome}] ${rec.total_tokens} tok -> ${path.relative(ROOT, LOG).replace(/\\/g, '/')}`);
} else if (cmd === 'summary') {
  const s = summarize(readRecords());
  if (rest.includes('--json')) console.log(JSON.stringify(s, null, 2));
  else {
    console.log(`runs=${s.runs} success_rate=${s.success_rate} fallback_rate=${s.fallback_rate}`);
    console.log(`total tokens=${s.totals.tokens} avg/run=${s.averages.tokens_per_run} avg/success=${s.averages.tokens_per_successful_run}`);
    console.log(`avg agents/run=${s.averages.agents_per_run} avg human-interventions/run=${s.averages.human_interventions_per_run}`);
    console.log(`by outcome: ${JSON.stringify(s.by_outcome)}`);
  }
} else if (cmd === 'health') {
  // F10 — the consumer side of the loop: per-tier priors + recent-vs-prior trend.
  const records = readRecords();
  const wIdx = rest.indexOf('--window');
  const window = wIdx >= 0 ? NUM(rest[wIdx + 1]) || 5 : 5;
  const priors = computePriors(records);
  const health = healthSignal(records, window);
  if (rest.includes('--json')) {
    console.log(JSON.stringify({ schema: 'afrows-telemetry-health/v1', runs: records.length, priors, health }, null, 2));
  } else {
    console.log(`runs=${records.length} health=${health.state}${health.recent ? ` (recent success ${health.recent.success_rate} vs prior ${health.prior.success_rate})` : ''}`);
    for (const t of Object.keys(priors)) {
      const p = priors[t];
      console.log(`  ${t.padEnd(9)} runs=${p.runs} fallback=${p.fallback_rate} success=${p.success_rate} avg_tok=${p.avg_tokens} interventions=${p.avg_human_interventions} [${p.confidence}]`);
    }
  }
} else {
  console.error('usage: telemetry.mjs record --json <json> | record --file <path> | summary [--json] | health [--json] [--window N]');
  process.exit(2);
}

export { normalizeRecord, summarize };
