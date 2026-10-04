import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DE_MGMT_BACKOFF_DEFAULTS,
  DeMgmtBackoff,
  isDeLinkFailure,
  resolveDeMgmtBackoffConfig,
} from '../src/client/germany-mgmt-backoff.ts';

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('isDeLinkFailure', () => {
  it('counts ssh exit 255, timeouts and spawn errors as link failures', () => {
    assert.equal(isDeLinkFailure({ code: 255 }), true);
    assert.equal(isDeLinkFailure({ killed: true, signal: 'SIGTERM', code: null }), true);
    assert.equal(isDeLinkFailure({ code: 'ENOENT' }), true);
    assert.equal(isDeLinkFailure(undefined), true);
  });

  it('does NOT count a remote command exit (e.g. rmu of an absent user) as a link failure', () => {
    assert.equal(isDeLinkFailure({ code: 1, killed: false, signal: null }), false);
    assert.equal(isDeLinkFailure({ code: 2 }), false);
  });
});

describe('resolveDeMgmtBackoffConfig', () => {
  it('defaults to a 300 s cap and clamps 30..3600 s', () => {
    assert.equal(resolveDeMgmtBackoffConfig({}).maxMs, 300_000);
    assert.equal(resolveDeMgmtBackoffConfig({ AFROWS_DE_MGMT_BACKOFF_MAX_SECONDS: '5' }).maxMs, 30_000);
    assert.equal(resolveDeMgmtBackoffConfig({ AFROWS_DE_MGMT_BACKOFF_MAX_SECONDS: '99999' }).maxMs, 3_600_000);
    assert.equal(resolveDeMgmtBackoffConfig({ AFROWS_DE_MGMT_BACKOFF_MAX_SECONDS: 'x' }).maxMs, 300_000);
  });
});

describe('DeMgmtBackoff', () => {
  it('runs normally below the failure threshold', () => {
    const b = new DeMgmtBackoff(DE_MGMT_BACKOFF_DEFAULTS, clock().now);
    assert.equal(b.gate(), 'run');
    assert.deepEqual(b.onFailure(), { opened: false, windowMs: 0 });
    assert.equal(b.gate(), 'run');
    b.onFailure();
    assert.equal(b.gate(), 'run');
  });

  it('opens on the 3rd consecutive link failure and skips calls during the window', () => {
    const c = clock();
    const b = new DeMgmtBackoff(DE_MGMT_BACKOFF_DEFAULTS, c.now);
    b.onFailure();
    b.onFailure();
    assert.deepEqual(b.onFailure(), { opened: true, windowMs: 15_000 });
    assert.equal(b.gate(), 'skip');
    c.advance(14_999);
    assert.equal(b.gate(), 'skip');
  });

  it('lets exactly ONE probe through after the window; concurrent calls still skip', () => {
    const c = clock();
    const b = new DeMgmtBackoff(DE_MGMT_BACKOFF_DEFAULTS, c.now);
    for (let i = 0; i < 3; i += 1) b.onFailure();
    c.advance(15_000);
    assert.equal(b.gate(), 'probe');
    assert.equal(b.gate(), 'skip');
  });

  it('doubles the window on each failed probe and caps it', () => {
    const c = clock();
    const b = new DeMgmtBackoff(DE_MGMT_BACKOFF_DEFAULTS, c.now);
    for (let i = 0; i < 2; i += 1) b.onFailure();
    const windows: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const { windowMs } = b.onFailure();
      windows.push(windowMs);
      c.advance(windowMs);
      assert.equal(b.gate(), 'probe');
    }
    assert.deepEqual(windows, [15_000, 30_000, 60_000, 120_000, 240_000, 300_000, 300_000, 300_000]);
  });

  it('a success closes the breaker and reports how many calls were skipped', () => {
    const c = clock();
    const b = new DeMgmtBackoff(DE_MGMT_BACKOFF_DEFAULTS, c.now);
    for (let i = 0; i < 3; i += 1) b.onFailure();
    b.gate();
    b.gate();
    c.advance(15_000);
    assert.equal(b.gate(), 'probe');
    assert.deepEqual(b.onSuccess(), { closed: true, suppressed: 2 });
    assert.equal(b.gate(), 'run');
    assert.deepEqual(b.onSuccess(), { closed: false, suppressed: 0 });
  });

  it('bounds a day-long outage to ~1 attempt per cap window instead of one per call', () => {
    const c = clock();
    const b = new DeMgmtBackoff(DE_MGMT_BACKOFF_DEFAULTS, c.now);
    let attempts = 0;
    // 50 calls every 60 s (e.g. a membership sweep of 50 users) for 24 h, link down.
    for (let tick = 0; tick < 24 * 60; tick += 1) {
      for (let call = 0; call < 50; call += 1) {
        if (b.gate() !== 'skip') {
          attempts += 1;
          b.onFailure();
        }
      }
      c.advance(60_000);
    }
    assert.ok(attempts < 300, `attempts=${attempts}`); // vs 72 000 unguarded
  });
});
