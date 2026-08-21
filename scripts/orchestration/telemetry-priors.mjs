#!/usr/bin/env node
// Afrows F10 — closed-loop telemetry priors (feeds the F2/F3 router).
//
//   node scripts/orchestration/telemetry-priors.mjs [--json] [--window N]
//
// Reads the same graphify-out/telemetry/runs.jsonl the F8 recorder writes and
// turns it into DECISION PRIORS the router can layer on top of its deterministic
// base score: per-complexity-tier reliability, a recent-vs-prior trend/health
// signal, and a budget-calibration hint. This module is PURE and DETERMINISTIC
// given its input records — no wall-clock, no randomness. Record APPEND ORDER is
// the time proxy (identical to how F8 `summary` already treats the log), so the
// "recent window" is simply the tail of the list.
//
// It is ADVISORY ONLY. It never recomputes impact and never mutates the router's
// auditable base score/tier — it annotates the recommendation surface.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const LOG = path.join(ROOT, 'graphify-out', 'telemetry', 'runs.jsonl');

const NUM = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round3 = (v) => +Number(v).toFixed(3);

// Tuning constants — documented so the thresholds are auditable, not magic.
export const PRIORS_CONFIG = {
  MIN_RUNS_FOR_PRIOR: 3, // below this a tier prior is LOW_CONFIDENCE
  DEFAULT_WINDOW: 5, // recent-window size for the trend signal
  DEGRADE_DELTA: 0.2, // success drop / fallback rise that flags DEGRADING
  HIGH_FALLBACK_RATE: 0.34, // tier fallback rate that raises a reliability caution
  BUDGET_OVER: 1.2, // avg tokens > budget*1.2 => recommend raising the budget
  BUDGET_UNDER: 0.5, // avg tokens < budget*0.5 => recommend lowering the budget
  BUDGET_ROUND: 10000, // round budget recommendations to this granularity
};

const isSuccess = (r) => r.outcome === 'COMPLETE' || r.outcome === 'DIRECT';
const didFallback = (r) => Boolean(r.fallback) || r.outcome === 'FALLBACK' || r.outcome === 'BLOCKED';

function rateOf(records, pred) {
  return records.length ? round3(records.filter(pred).length / records.length) : 0;
}
function avgOf(records, f) {
  return records.length ? round3(records.reduce((a, r) => a + NUM(f(r)), 0) / records.length) : 0;
}

// Most common non-null fallback_reason in a set (ties -> first seen, so
// deterministic given append order).
function commonFallbackReason(records) {
  const counts = new Map();
  for (const r of records) {
    const reason = r.fallback_reason ? String(r.fallback_reason) : null;
    if (!reason) continue;
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  let best = null;
  let bestN = 0;
  for (const [reason, n] of counts) {
    if (n > bestN) {
      best = reason;
      bestN = n;
    }
  }
  return best ? { reason: best, count: bestN } : null;
}

// ---- per-tier priors --------------------------------------------------------
export function tierPrior(records, tier) {
  const rows = records.filter((r) => String(r.complexity) === String(tier));
  const successCompleted = rows.filter(isSuccess);
  return {
    tier,
    runs: rows.length,
    confidence: rows.length >= PRIORS_CONFIG.MIN_RUNS_FOR_PRIOR ? 'OK' : 'LOW_CONFIDENCE',
    fallback_rate: rateOf(rows, didFallback),
    success_rate: rateOf(rows, isSuccess),
    avg_human_interventions: avgOf(rows, (r) => r.human_interventions),
    avg_tokens: rows.length ? Math.round(avgOf(rows, (r) => r.total_tokens)) : 0,
    avg_tokens_successful: successCompleted.length
      ? Math.round(avgOf(successCompleted, (r) => r.total_tokens))
      : 0,
    common_fallback_reason: commonFallbackReason(rows),
  };
}

export function computePriors(records) {
  const tiers = ['TRIVIAL', 'SMALL', 'MEDIUM', 'HIGH', 'CRITICAL'];
  // Only include tiers that actually appear, in fixed tier order (deterministic).
  const seen = new Set(records.map((r) => String(r.complexity)));
  const byTier = {};
  for (const t of tiers) if (seen.has(t)) byTier[t] = tierPrior(records, t);
  // Any records with an unrecognized/unknown tier bucket.
  const other = records.filter((r) => !tiers.includes(String(r.complexity)));
  if (other.length) byTier.UNKNOWN = tierPrior(records, other[0].complexity);
  return byTier;
}

// ---- recent-vs-prior trend (health) -----------------------------------------
// Splits the tail window of size `window` (recent) against the window before it
// (prior) and compares success/fallback rates. Needs >= 2*window records for a
// real signal, else INSUFFICIENT_DATA.
export function healthSignal(records, window = PRIORS_CONFIG.DEFAULT_WINDOW) {
  const w = Math.max(1, NUM(window) || PRIORS_CONFIG.DEFAULT_WINDOW);
  if (records.length < 2 * w) {
    return {
      state: 'INSUFFICIENT_DATA',
      window: w,
      have: records.length,
      need: 2 * w,
      recent: null,
      prior: null,
    };
  }
  const recent = records.slice(-w);
  const prior = records.slice(-2 * w, -w);
  const recentSuccess = rateOf(recent, isSuccess);
  const priorSuccess = rateOf(prior, isSuccess);
  const recentFallback = rateOf(recent, didFallback);
  const priorFallback = rateOf(prior, didFallback);
  const successDelta = round3(recentSuccess - priorSuccess);
  const fallbackDelta = round3(recentFallback - priorFallback);

  let state = 'STABLE';
  if (successDelta <= -PRIORS_CONFIG.DEGRADE_DELTA || fallbackDelta >= PRIORS_CONFIG.DEGRADE_DELTA) {
    state = 'DEGRADING';
  } else if (successDelta >= PRIORS_CONFIG.DEGRADE_DELTA || fallbackDelta <= -PRIORS_CONFIG.DEGRADE_DELTA) {
    state = 'IMPROVING';
  }
  return {
    state,
    window: w,
    recent: { success_rate: recentSuccess, fallback_rate: recentFallback, runs: recent.length },
    prior: { success_rate: priorSuccess, fallback_rate: priorFallback, runs: prior.length },
    success_delta: successDelta,
    fallback_delta: fallbackDelta,
  };
}

// ---- budget calibration (needs the router's static budget for the tier) ------
export function budgetCalibration(records, tier, staticBudget) {
  const budget = NUM(staticBudget);
  const prior = tierPrior(records, tier);
  const base = {
    tier,
    runs: prior.runs,
    static_budget: budget,
    observed_avg_tokens: prior.avg_tokens,
  };
  if (prior.runs < PRIORS_CONFIG.MIN_RUNS_FOR_PRIOR || !budget) {
    return { ...base, verdict: 'INSUFFICIENT_DATA', recommended_budget: budget || null };
  }
  const roundTo = (v) => Math.max(PRIORS_CONFIG.BUDGET_ROUND, Math.round(v / PRIORS_CONFIG.BUDGET_ROUND) * PRIORS_CONFIG.BUDGET_ROUND);
  if (prior.avg_tokens > budget * PRIORS_CONFIG.BUDGET_OVER) {
    return { ...base, verdict: 'UNDER_BUDGETED', recommended_budget: roundTo(prior.avg_tokens) };
  }
  if (prior.avg_tokens < budget * PRIORS_CONFIG.BUDGET_UNDER) {
    return { ...base, verdict: 'OVER_BUDGETED', recommended_budget: roundTo(prior.avg_tokens) };
  }
  return { ...base, verdict: 'WELL_CALIBRATED', recommended_budget: budget };
}

// ---- the overlay the router attaches ----------------------------------------
// Advisory: priors + health + human-readable cautions + a budget hint. Given the
// routed tier and that tier's static budget, produce everything the router needs
// to annotate its decision WITHOUT changing the base score.
export function routingAdvice(records, tier, staticBudget, window = PRIORS_CONFIG.DEFAULT_WINDOW) {
  if (!records.length) {
    return { available: false, reason: 'no telemetry records yet', runs: 0 };
  }
  const prior = tierPrior(records, tier);
  const health = healthSignal(records, window);
  const budget = budgetCalibration(records, tier, staticBudget);
  const cautions = [];

  if (prior.runs >= PRIORS_CONFIG.MIN_RUNS_FOR_PRIOR && prior.fallback_rate >= PRIORS_CONFIG.HIGH_FALLBACK_RATE) {
    cautions.push(
      `tier ${tier} historically fell back ${Math.round(prior.fallback_rate * 100)}% of ${prior.runs} runs` +
        (prior.common_fallback_reason ? ` (most common: "${prior.common_fallback_reason.reason}")` : '') +
        ' — consider serialized execution or human oversight',
    );
  }
  if (health.state === 'DEGRADING') {
    cautions.push(
      `orchestration health is DEGRADING: recent success ${health.recent.success_rate} vs prior ${health.prior.success_rate}` +
        ` (fallback ${health.recent.fallback_rate} vs ${health.prior.fallback_rate}) — investigate before scaling parallelism`,
    );
  }
  if (budget.verdict === 'UNDER_BUDGETED') {
    cautions.push(`tier ${tier} averaged ${budget.observed_avg_tokens} tokens vs a ${budget.static_budget} budget — recommend ~${budget.recommended_budget}`);
  }

  return {
    available: true,
    runs: records.length,
    tier_prior: prior,
    health,
    budget_calibration: budget,
    cautions,
  };
}

// ---- IO helper (best-effort; never throws) ----------------------------------
export function readRecordsSafe(logPath = LOG) {
  try {
    if (!fs.existsSync(logPath)) return [];
    return fs
      .readFileSync(logPath, 'utf8')
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
  } catch {
    return [];
  }
}

// ---- CLI --------------------------------------------------------------------
// Only runs when invoked directly, not on import (the router imports the fns).
// Windows-safe main detection: fileURLToPath, not `.pathname` (which yields a
// leading-slash drive path like /D:/... that never matches argv[1]).
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const wIdx = argv.indexOf('--window');
  const window = wIdx >= 0 ? NUM(argv[wIdx + 1]) || PRIORS_CONFIG.DEFAULT_WINDOW : PRIORS_CONFIG.DEFAULT_WINDOW;
  const records = readRecordsSafe();
  const priors = computePriors(records);
  const health = healthSignal(records, window);
  if (asJson) {
    console.log(JSON.stringify({ schema: 'afrows-telemetry-priors/v1', runs: records.length, priors, health }, null, 2));
  } else {
    console.log('Afrows telemetry priors (F10)');
    console.log('=============================');
    console.log(`runs=${records.length}  health=${health.state}${health.recent ? ` (recent success ${health.recent.success_rate} vs prior ${health.prior.success_rate})` : ''}`);
    const tiers = Object.keys(priors);
    if (!tiers.length) console.log('  (no per-tier priors yet)');
    for (const t of tiers) {
      const p = priors[t];
      console.log(
        `  ${t.padEnd(9)} runs=${String(p.runs).padStart(2)} ` +
          `fallback=${p.fallback_rate} success=${p.success_rate} ` +
          `avg_tok=${p.avg_tokens} interventions=${p.avg_human_interventions} ` +
          `[${p.confidence}]${p.common_fallback_reason ? ` reason="${p.common_fallback_reason.reason}"` : ''}`,
      );
    }
  }
}
