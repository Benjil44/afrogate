import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_REWARDED_AD_PROVIDER,
  MAX_REWARDED_AD_DAILY_LIMIT,
  MAX_REWARDED_AD_REWARD_BYTES,
  assertRewardedAdSettingsLimits,
  normalizeRewardedAdProvider,
} from '../src/billing/rewarded-ad.ts';

describe('normalizeRewardedAdProvider', () => {
  it('lowercases and slugifies disallowed characters', () => {
    assert.equal(normalizeRewardedAdProvider('AdMob Rewarded!', 'fallback'), 'admob_rewarded_');
    assert.equal(normalizeRewardedAdProvider('keep_me.1:2-3', 'fallback'), 'keep_me.1:2-3');
  });

  it('falls back to the provided fallback, then the default, when blank', () => {
    assert.equal(normalizeRewardedAdProvider(null, 'fallback'), 'fallback');
    assert.equal(normalizeRewardedAdProvider('   ', ''), DEFAULT_REWARDED_AD_PROVIDER);
  });

  it('rejects an over-length provider', () => {
    assert.throws(() => normalizeRewardedAdProvider('a'.repeat(81), 'fallback'), BadRequestException);
  });
});

describe('assertRewardedAdSettingsLimits', () => {
  it('accepts values within range', () => {
    assert.doesNotThrow(() => assertRewardedAdSettingsLimits(1024, 20));
    assert.doesNotThrow(() => assertRewardedAdSettingsLimits(MAX_REWARDED_AD_REWARD_BYTES, MAX_REWARDED_AD_DAILY_LIMIT));
    assert.doesNotThrow(() => assertRewardedAdSettingsLimits(1, 0));
  });

  it('rejects reward bytes that are non-positive, non-integer, or over the cap', () => {
    for (const reward of [0, -1, 1.5, MAX_REWARDED_AD_REWARD_BYTES + 1]) {
      assert.throws(() => assertRewardedAdSettingsLimits(reward, 20), BadRequestException);
    }
  });

  it('rejects a daily limit that is negative, non-integer, or over the cap', () => {
    for (const limit of [-1, 2.5, MAX_REWARDED_AD_DAILY_LIMIT + 1]) {
      assert.throws(() => assertRewardedAdSettingsLimits(1024, limit), BadRequestException);
    }
  });
});

describe('rewarded-ad constants', () => {
  it('exposes the 10 GiB reward cap and default provider', () => {
    assert.equal(MAX_REWARDED_AD_REWARD_BYTES, 10 * 1024 ** 3);
    assert.equal(DEFAULT_REWARDED_AD_PROVIDER, 'mvp_rewarded_ad');
  });
});
