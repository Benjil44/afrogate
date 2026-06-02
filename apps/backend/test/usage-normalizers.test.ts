import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  normalizeClientUsageDirection,
  normalizeClientUsageSource,
  normalizeCurrentPanelChargeClientIds,
  normalizeCurrentPanelVolumeChargeScope,
} from '../src/billing/usage-normalizers.ts';

describe('normalizeClientUsageSource', () => {
  it('lowercases and accepts known sources, defaulting blank to admin', () => {
    assert.equal(normalizeClientUsageSource('AGENT'), 'agent');
    assert.equal(normalizeClientUsageSource(undefined), 'admin');
    assert.equal(normalizeClientUsageSource('  '), 'admin');
  });

  it('rejects unknown sources', () => {
    assert.throws(() => normalizeClientUsageSource('hacker'), BadRequestException);
  });
});

describe('normalizeClientUsageDirection', () => {
  it('accepts rx/tx/combined, defaulting blank to combined', () => {
    assert.equal(normalizeClientUsageDirection('RX'), 'rx');
    assert.equal(normalizeClientUsageDirection('tx'), 'tx');
    assert.equal(normalizeClientUsageDirection(undefined), 'combined');
  });

  it('rejects unknown directions', () => {
    assert.throws(() => normalizeClientUsageDirection('sideways'), BadRequestException);
  });
});

describe('normalizeCurrentPanelVolumeChargeScope', () => {
  it('accepts known scopes, defaulting blank to account_quota', () => {
    assert.equal(normalizeCurrentPanelVolumeChargeScope('selected_clients'), 'selected_clients');
    assert.equal(normalizeCurrentPanelVolumeChargeScope(null), 'account_quota');
  });

  it('rejects unknown scopes', () => {
    assert.throws(() => normalizeCurrentPanelVolumeChargeScope('everything'), BadRequestException);
  });
});

describe('normalizeCurrentPanelChargeClientIds', () => {
  it('trims, drops blanks, de-duplicates, and sorts', () => {
    assert.deepEqual(normalizeCurrentPanelChargeClientIds([' b ', 'a', '', 'a', 'c']), ['a', 'b', 'c']);
    assert.deepEqual(normalizeCurrentPanelChargeClientIds([]), []);
  });
});
