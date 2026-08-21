import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
// The F9 failure-aware state machine is a pure JS module shared by the
// orchestrator. These tests pin its deterministic behavior — especially the
// observed failure mode where parallel writers do not materialize.
import {
  STATE,
  FALLBACK,
  classifyExecutionState,
  // @ts-expect-error — .mjs import resolved by the node --test loader
} from '../../../scripts/orchestration/execution-state.mjs';
// @ts-expect-error
import { decideFallback } from '../../../scripts/orchestration/execution-state.mjs';

describe('classifyExecutionState (F9)', () => {
  it('analyze mode is ANALYSIS_COMPLETE regardless of writers', () => {
    assert.equal(classifyExecutionState({ mode: 'analyze', expectedWriters: 2 }), STATE.ANALYSIS_COMPLETE);
  });

  it('detects IMPLEMENTATION_MISSING when writers were expected but nothing materialized (the observed bug)', () => {
    assert.equal(
      classifyExecutionState({ mode: 'implement', expectedWriters: 2, worktreesFound: 0, changedOwnedFiles: 0 }),
      STATE.IMPLEMENTATION_MISSING,
    );
  });

  it('worktrees present but zero owned-file changes is still MISSING', () => {
    assert.equal(
      classifyExecutionState({ mode: 'implement', expectedWriters: 2, worktreesFound: 2, changedOwnedFiles: 0 }),
      STATE.IMPLEMENTATION_MISSING,
    );
  });

  it('real changes -> IMPLEMENTATION_COMPLETE', () => {
    assert.equal(
      classifyExecutionState({ mode: 'implement', expectedWriters: 2, worktreesFound: 2, changedOwnedFiles: 3 }),
      STATE.IMPLEMENTATION_COMPLETE,
    );
  });

  it('a reported conflict -> IMPLEMENTATION_BLOCKED', () => {
    assert.equal(
      classifyExecutionState({ mode: 'implement', expectedWriters: 2, conflictReported: true, changedOwnedFiles: 1 }),
      STATE.IMPLEMENTATION_BLOCKED,
    );
  });

  it('a forbidden path touched -> INTEGRATION_BLOCKED (outranks everything)', () => {
    assert.equal(
      classifyExecutionState({ mode: 'implement', expectedWriters: 2, forbiddenTouched: ['.rsc'], changedOwnedFiles: 5 }),
      STATE.INTEGRATION_BLOCKED,
    );
  });

  it('zero expected writers is analysis-only', () => {
    assert.equal(classifyExecutionState({ mode: 'implement', expectedWriters: 0 }), STATE.ANALYSIS_COMPLETE);
  });
});

describe('decideFallback (F9)', () => {
  it('MISSING with retries left -> RETRY, and never spends a review cycle', () => {
    const d = decideFallback({ state: STATE.IMPLEMENTATION_MISSING, riskTier: 'MEDIUM', attempt: 1, maxAttempts: 2 });
    assert.equal(d.action, FALLBACK.RETRY);
    assert.match(d.reason, /skip review/);
  });

  it('MISSING after retries on HIGH risk -> HUMAN (no silent downgrade)', () => {
    const d = decideFallback({ state: STATE.IMPLEMENTATION_MISSING, riskTier: 'HIGH', attempt: 2, maxAttempts: 2 });
    assert.equal(d.action, FALLBACK.HUMAN);
  });

  it('MISSING after retries on low risk -> SERIALIZE', () => {
    const d = decideFallback({ state: STATE.IMPLEMENTATION_MISSING, riskTier: 'SMALL', attempt: 2, maxAttempts: 2 });
    assert.equal(d.action, FALLBACK.SERIALIZE);
  });

  it('COMPLETE -> PROCEED to review', () => {
    assert.equal(decideFallback({ state: STATE.IMPLEMENTATION_COMPLETE }).action, FALLBACK.PROCEED);
  });

  it('forbidden path (INTEGRATION_BLOCKED) always requires HUMAN, never auto-fix', () => {
    assert.equal(decideFallback({ state: STATE.INTEGRATION_BLOCKED, riskTier: 'SMALL' }).action, FALLBACK.HUMAN);
  });

  it('CRITICAL scope conflict -> HUMAN; non-high conflict -> SERIALIZE', () => {
    assert.equal(decideFallback({ state: STATE.IMPLEMENTATION_BLOCKED, riskTier: 'CRITICAL' }).action, FALLBACK.HUMAN);
    assert.equal(decideFallback({ state: STATE.IMPLEMENTATION_BLOCKED, riskTier: 'MEDIUM' }).action, FALLBACK.SERIALIZE);
  });
});
