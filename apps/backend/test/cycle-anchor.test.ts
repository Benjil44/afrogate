import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resetCycleOnPaidCredit } from '../src/billing/cycle-anchor.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

describe('resetCycleOnPaidCredit', () => {
  it('re-anchors cycle_start, clears the mask + lapsed_at, and NEVER touches quota_limit_bytes', async () => {
    const executor = createFakeExecutor([{ rows: [] }]);
    await resetCycleOnPaidCredit(executor, 'acct-1', 21_000_000_000);

    assert.equal(executor.calls.length, 1);
    const call = executor.calls[0];
    assert.match(call.text, /cycle_start_used_bytes = LEAST\(used_bytes, \$2::bigint\)/);
    assert.match(call.text, /renewal_notice_mask = 0/);
    assert.match(call.text, /lapsed_at = NULL/);
    // C1: this must be its own statement — it must NOT write quota_limit_bytes.
    assert.equal(/quota_limit_bytes/.test(call.text), false);
    assert.deepEqual(call.values, ['acct-1', 21_000_000_000]);
  });
});
