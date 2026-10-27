/**
 * The route-quality aggregation timer must never leak a rejected promise: an
 * unhandled rejection terminates Node (default since v15), taking the whole API
 * down on a transient Postgres error.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bundledSkipReason, loadBundled } from './helpers/load-bundled.ts';

type Service = { runScheduled(): Promise<void>; aggregateRecent(): Promise<unknown> };
type ServiceCtor = new (db: unknown) => Service;

describe('RouteQualityAggregationService scheduled run', { skip: bundledSkipReason }, () => {
  const { RouteQualityAggregationService } = loadBundled<{ RouteQualityAggregationService: ServiceCtor }>(
    'operations/route-quality-aggregation.service.ts',
    { quiet: true },
  );
  const failingDb = {
    query: async () => {
      throw new Error('connection terminated');
    },
  };

  it('aggregateRecent still rejects for HTTP callers', async () => {
    await assert.rejects(new RouteQualityAggregationService(failingDb).aggregateRecent(), /connection terminated/);
  });

  it('runScheduled swallows (and logs) the failure and releases the in-flight flag', async () => {
    const service = new RouteQualityAggregationService(failingDb);
    await service.runScheduled();
    await assert.rejects(service.aggregateRecent(), /connection terminated/, 'not stuck in isRunning');
  });
});
