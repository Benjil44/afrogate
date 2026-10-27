/**
 * Interval-driven cursor jobs must never overlap: GatewayBillingService.runCycle
 * reads each peer cursor, then advances it, then adds the delta to
 * customer_accounts.used_bytes, so two concurrent passes would charge the same
 * bytes twice.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { singleFlight } from '../src/common/single-flight.ts';
import { bundledSkipReason, loadBundled } from './helpers/load-bundled.ts';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('singleFlight', () => {
  it('joins a call made while a run is in flight, then allows the next run', async () => {
    let runs = 0;
    let gate = deferred();
    const run = singleFlight(async () => {
      runs += 1;
      await gate.promise;
    });
    const first = run();
    const second = run();
    assert.equal(first, second);
    assert.equal(runs, 1);
    gate.resolve();
    await first;
    gate = deferred();
    const third = run();
    assert.equal(runs, 2);
    gate.resolve();
    await third;
  });

  it('releases the slot after a rejected run', async () => {
    let runs = 0;
    const run = singleFlight(async () => {
      runs += 1;
      if (runs === 1) throw new Error('boom');
    });
    await assert.rejects(run(), /boom/);
    await run();
    assert.equal(runs, 2);
  });
});

type Runner = { runOnce(): Promise<void> };
type RunnerCtor = new (dep: unknown) => Runner;

describe('interval runners do not overlap', { skip: bundledSkipReason }, () => {
  it('GatewayBillingRunnerService runs one billing cycle at a time and swallows failures', async () => {
    const { GatewayBillingRunnerService } = loadBundled<{ GatewayBillingRunnerService: RunnerCtor }>(
      'routers/gateway-billing.runner.ts',
      { quiet: true },
    );
    let cycles = 0;
    const gate = deferred();
    const runner = new GatewayBillingRunnerService({
      async runCycle() {
        cycles += 1;
        await gate.promise;
      },
    });
    const a = runner.runOnce();
    const b = runner.runOnce();
    assert.equal(cycles, 1);
    gate.reject(new Error('db down'));
    await Promise.all([a, b]); // failure is logged, never an unhandled rejection
    await runner.runOnce();
    assert.equal(cycles, 2);
  });

  it('RouterUsageSamplerService runs one sampling pass at a time', async () => {
    const { RouterUsageSamplerService } = loadBundled<{ RouterUsageSamplerService: RunnerCtor }>(
      'routers/router-usage-sampler.service.ts',
      { quiet: true },
    );
    let passes = 0;
    const gate = deferred();
    const sampler = new RouterUsageSamplerService({
      async sampleUsage() {
        passes += 1;
        await gate.promise;
      },
    });
    const a = sampler.runOnce();
    void sampler.runOnce();
    assert.equal(passes, 1);
    gate.resolve();
    await a;
  });
});
