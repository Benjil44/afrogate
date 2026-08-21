// Afrows failure-aware execution state machine (F9). PURE + DETERMINISTIC +
// UNIT-TESTABLE — no I/O. The workflow calls classifyExecutionState() AFTER the
// parallel implement stage and BEFORE paying for the adversarial review, so an
// empty/failed materialization is caught early (observed twice: SSRF and ReDoS
// runs both produced empty deliverables yet still ran a full review cycle).
//
// decideFallback() maps a state to a safe next action; the reason is recorded in
// telemetry. High-risk tasks never silently downgrade — they require a human.

export const STATE = {
  ANALYSIS_COMPLETE: 'ANALYSIS_COMPLETE', // analyze mode, or discovery-only
  IMPLEMENTATION_STARTED: 'IMPLEMENTATION_STARTED',
  IMPLEMENTATION_MISSING: 'IMPLEMENTATION_MISSING', // writers didn't materialize
  IMPLEMENTATION_BLOCKED: 'IMPLEMENTATION_BLOCKED', // agent reported a conflict/blocker
  IMPLEMENTATION_COMPLETE: 'IMPLEMENTATION_COMPLETE',
  INTEGRATION_BLOCKED: 'INTEGRATION_BLOCKED',
  VALIDATION_BLOCKED: 'VALIDATION_BLOCKED',
};

export const FALLBACK = {
  PROCEED: 'proceed', // to review/validation — real work exists
  RETRY: 'retry', // re-dispatch the writers within budget
  SERIALIZE: 'serialize', // replace parallel writers with one serial specialist
  DOWNGRADE: 'downgrade', // reduce orchestration depth (only when safe)
  HUMAN: 'human', // require a human decision (high-risk / budget exhausted)
};

/**
 * Classify what actually happened in the implement stage.
 * @param {object} m
 *   mode: 'analyze' | 'implement'
 *   expectedWriters: number of packages that should have written files
 *   worktreesFound: number of agent worktrees actually present
 *   changedOwnedFiles: number of owned files that actually changed (harvested)
 *   forbiddenTouched: string[] forbidden paths that were modified
 *   conflictReported: boolean (an agent set conflict_detected)
 *   anyReady: boolean (any agent returned ready_for_integration)
 */
export function classifyExecutionState(m) {
  const s = m || {};
  if (s.mode === 'analyze') return STATE.ANALYSIS_COMPLETE;
  if (Array.isArray(s.forbiddenTouched) && s.forbiddenTouched.length) return STATE.INTEGRATION_BLOCKED;
  if (s.conflictReported) return STATE.IMPLEMENTATION_BLOCKED;
  const expected = Number(s.expectedWriters) || 0;
  if (expected === 0) return STATE.ANALYSIS_COMPLETE; // nothing was meant to be written
  // The core guard: writers were expected, but nothing materialized.
  if ((Number(s.worktreesFound) || 0) === 0 && (Number(s.changedOwnedFiles) || 0) === 0) {
    return STATE.IMPLEMENTATION_MISSING;
  }
  if ((Number(s.changedOwnedFiles) || 0) === 0) return STATE.IMPLEMENTATION_MISSING;
  return STATE.IMPLEMENTATION_COMPLETE;
}

/**
 * Decide the safe next action for a given state.
 * @param {object} ctx
 *   state: one of STATE
 *   riskTier: 'TRIVIAL'|'SMALL'|'MEDIUM'|'HIGH'|'CRITICAL'
 *   attempt: how many implement attempts already spent
 *   maxAttempts: budget (default 1 retry)
 */
export function decideFallback(ctx) {
  const c = ctx || {};
  const risk = String(c.riskTier || 'MEDIUM');
  const highRisk = risk === 'HIGH' || risk === 'CRITICAL';
  const attempt = Number(c.attempt) || 1;
  const maxAttempts = Number(c.maxAttempts) || 2;

  switch (c.state) {
    case STATE.IMPLEMENTATION_COMPLETE:
      return { action: FALLBACK.PROCEED, reason: 'real owned-file changes materialized; proceed to review' };
    case STATE.ANALYSIS_COMPLETE:
      return { action: FALLBACK.PROCEED, reason: 'analysis/dry-run complete; return plan (no review needed)' };
    case STATE.IMPLEMENTATION_BLOCKED:
      // an agent reported a scope conflict -> re-decompose (human for high-risk)
      return highRisk
        ? { action: FALLBACK.HUMAN, reason: 'scope conflict on a high-risk task; human must re-decompose' }
        : { action: FALLBACK.SERIALIZE, reason: 'scope conflict; serialize a single specialist to avoid overlap' };
    case STATE.INTEGRATION_BLOCKED:
      return { action: FALLBACK.HUMAN, reason: 'forbidden path touched; human review required, do not auto-fix' };
    case STATE.IMPLEMENTATION_MISSING:
      // The key F9 win: do NOT run a review cycle on nothing.
      if (attempt < maxAttempts) return { action: FALLBACK.RETRY, reason: `implementation did not materialize (attempt ${attempt}/${maxAttempts}); retry the writers, skip review` };
      if (highRisk) return { action: FALLBACK.HUMAN, reason: 'implementation missing after retries on a high-risk task; require human' };
      return { action: FALLBACK.SERIALIZE, reason: 'implementation missing after retries; serialize one specialist' };
    default:
      return { action: FALLBACK.HUMAN, reason: `unhandled state ${c.state}; require human` };
  }
}
