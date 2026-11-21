import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MASK_EXHAUSTED,
  MASK_EXPIRY_1D,
  MASK_EXPIRY_3D,
  MASK_USAGE_80,
  MASK_USAGE_95,
  decideRenewalNotice,
  resolveRenewalLadderEnabled,
  type RenewalNoticeInput,
} from '../src/notifications/renewal-ladder.ts';

const GB = 1_000_000_000;
const NOW = new Date('2026-11-13T00:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function input(over: Partial<RenewalNoticeInput>): RenewalNoticeInput {
  return {
    quota: 100 * GB,
    used: 0,
    cycleStart: 0,
    expiresAt: null,
    mask: 0,
    hasPendingReceipt: false,
    hasChat: true,
    status: 'active',
    deletedAt: null,
    now: NOW,
    ...over,
  };
}

describe('resolveRenewalLadderEnabled', () => {
  it('defaults on; 0/false/no/off disable', () => {
    assert.equal(resolveRenewalLadderEnabled(undefined), true);
    for (const off of ['0', 'false', 'no', 'off']) assert.equal(resolveRenewalLadderEnabled(off), false);
  });
});

describe('decideRenewalNotice — skips', () => {
  it('skips an unlimited account, inactive/deleted, no chat, a pending receipt, and an empty cycle', () => {
    assert.equal(decideRenewalNotice(input({ quota: null })), null);
    assert.equal(decideRenewalNotice(input({ status: 'suspended', used: 90 * GB })), null);
    assert.equal(decideRenewalNotice(input({ deletedAt: NOW, used: 90 * GB })), null);
    assert.equal(decideRenewalNotice(input({ hasChat: false, used: 90 * GB })), null);
    assert.equal(decideRenewalNotice(input({ hasPendingReceipt: true, used: 90 * GB })), null);
    // cycle_empty: quota <= cycleStart
    assert.equal(decideRenewalNotice(input({ quota: 50 * GB, cycleStart: 50 * GB, used: 50 * GB })), null);
  });
});

describe('decideRenewalNotice — usage rungs', () => {
  it('fires the highest newly-crossed usage rung only, setting all lower bits', () => {
    // 97% of the cycle, nothing sent → fire 95 (not 80), set bits 80|95.
    const d = decideRenewalNotice(input({ used: 97 * GB }));
    assert.equal(d?.rung, 'usage95');
    assert.equal(d?.newMask, MASK_USAGE_80 | MASK_USAGE_95);
  });

  it('fires 80 when only 80 is crossed', () => {
    const d = decideRenewalNotice(input({ used: 82 * GB }));
    assert.equal(d?.rung, 'usage80');
    assert.equal(d?.newMask, MASK_USAGE_80);
  });

  it('fires exhausted (used >= quota), setting 80|95|exhausted', () => {
    const d = decideRenewalNotice(input({ used: 100 * GB }));
    assert.equal(d?.rung, 'exhausted');
    assert.equal(d?.newMask, MASK_USAGE_80 | MASK_USAGE_95 | MASK_EXHAUSTED);
  });

  it('does not re-fire a rung already in the mask', () => {
    // 96% but 95 already sent → nothing (80 is also already set via newMask semantics).
    assert.equal(decideRenewalNotice(input({ used: 96 * GB, mask: MASK_USAGE_80 | MASK_USAGE_95 })), null);
  });

  it('measures the CURRENT paid cycle, not lifetime usage', () => {
    // cycle starts at 50 GB used; cycle size 50 GB; 82% of the cycle = 91 GB used.
    const d = decideRenewalNotice(input({ quota: 100 * GB, cycleStart: 50 * GB, used: 91 * GB }));
    assert.equal(d?.rung, 'usage80');
  });
});

describe('decideRenewalNotice — expiry rungs & precedence', () => {
  it('usage outranks expiry on the same tick', () => {
    // 96% used AND expiry in 2 days → the usage rung wins.
    const d = decideRenewalNotice(input({ used: 96 * GB, expiresAt: new Date(NOW.getTime() + 2 * 24 * HOUR) }));
    assert.equal(d?.rung, 'usage95');
  });

  it('fires T-3d when under 80% usage and expiry within 3 days', () => {
    const d = decideRenewalNotice(input({ used: 10 * GB, expiresAt: new Date(NOW.getTime() + 2 * 24 * HOUR) }));
    assert.equal(d?.rung, 'expiry3d');
    assert.equal(d?.newMask, MASK_EXPIRY_3D);
  });

  it('fires T-1d (setting the T-3d bit too) when expiry within 24h', () => {
    const d = decideRenewalNotice(input({ used: 10 * GB, expiresAt: new Date(NOW.getTime() + 12 * HOUR) }));
    assert.equal(d?.rung, 'expiry1d');
    assert.equal(d?.newMask, MASK_EXPIRY_3D | MASK_EXPIRY_1D);
  });

  it('never fires an expiry rung for an exhausted account (exhausted rung owns it)', () => {
    const d = decideRenewalNotice(input({ used: 100 * GB, expiresAt: new Date(NOW.getTime() + 12 * HOUR) }));
    assert.equal(d?.rung, 'exhausted');
  });

  it('no rung when plenty of data and expiry far away', () => {
    assert.equal(decideRenewalNotice(input({ used: 10 * GB, expiresAt: new Date(NOW.getTime() + 20 * 24 * HOUR) })), null);
  });
});
