import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyUsageDelta } from '../src/client/usage-accounting.ts';
import { createFakeExecutor } from './helpers/fake-db.ts';

describe('applyUsageDelta (shared by metering + edge usage)', () => {
  it('adds the delta to client_configs AND rolls it up to customer_accounts, id/bytes bound as params', async () => {
    const executor = createFakeExecutor([{ rows: [{}] }]);

    const rows = await applyUsageDelta(executor, 'cc-1', 1234);

    assert.equal(rows, 1);
    assert.equal(executor.calls.length, 1);
    const { text, values } = executor.calls[0];
    assert.match(text, /UPDATE client_configs/);
    assert.match(text, /used_bytes = used_bytes \+ \$2/);
    assert.match(text, /UPDATE customer_accounts/);
    assert.match(text, /used_bytes = ca\.used_bytes \+ \$2/);
    assert.deepEqual(values, ['cc-1', 1234]);
  });

  it('returns 0 when the clientConfigId is unknown (no customer_account row updated)', async () => {
    const executor = createFakeExecutor([{ rows: [] }]);
    assert.equal(await applyUsageDelta(executor, 'ghost', 100), 0);
  });
});
