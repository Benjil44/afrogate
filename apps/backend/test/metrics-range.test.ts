/**
 * The public GET /metrics/timeseries `range` query param must only ever reach
 * the repository as one of the four known ranges. Inherited object keys
 * (`toString`, `constructor`, `__proto__`) used to pass the `in` check and made
 * the repository bind a function as `$1::int` (500 on an unauthenticated route).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bundledSkipReason, loadBundled } from './helpers/load-bundled.ts';

type MetricsServiceCtor = new (repo: unknown) => {
  listTimeseries(range?: string, serverId?: string): Promise<{ range: string }>;
};

describe('MetricsService.listTimeseries range normalisation', { skip: bundledSkipReason }, () => {
  const { MetricsService } = loadBundled<{ MetricsService: MetricsServiceCtor }>('metrics/metrics.service.ts');
  const seen: string[] = [];
  const service = new MetricsService({
    async listTimeseries(query: { range: string }) {
      seen.push(query.range);
      return [];
    },
  });

  it('keeps the known ranges', async () => {
    for (const range of ['15m', '1h', '6h', '24h']) {
      assert.equal((await service.listTimeseries(range)).range, range);
    }
  });

  it('falls back to 1h for inherited object keys and unknown values', async () => {
    seen.length = 0;
    for (const range of ['toString', 'constructor', '__proto__', 'hasOwnProperty', '7d', '']) {
      assert.equal((await service.listTimeseries(range)).range, '1h', range);
    }
    assert.deepEqual(seen, Array(6).fill('1h'));
  });
});
