import { BadRequestException } from '@nestjs/common';

export const DEFAULT_REWARDED_AD_PROVIDER = 'mvp_rewarded_ad';
/** 10 GiB, expressed in bytes (1024**3 per GiB) — matches quota-math's BYTES_PER_GB. */
export const MAX_REWARDED_AD_REWARD_BYTES = 10 * 1024 ** 3;
export const MAX_REWARDED_AD_DAILY_LIMIT = 1000;

/** Normalizes a rewarded-ad provider id to a safe slug, falling back to a provided/default value. */
export function normalizeRewardedAdProvider(value: string | null | undefined, fallback: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  const normalized = trimmed ? trimmed.toLowerCase().replace(/[^a-z0-9_.:-]/g, '_') : null;
  const provider = normalized || fallback || DEFAULT_REWARDED_AD_PROVIDER;
  if (!provider || provider.length > 80) throw new BadRequestException('Rewarded ad provider is invalid');
  return provider;
}

/** Guards rewarded-ad reward size and daily-limit bounds. */
export function assertRewardedAdSettingsLimits(rewardBytes: number, dailyLimit: number): void {
  if (!Number.isSafeInteger(rewardBytes) || rewardBytes <= 0 || rewardBytes > MAX_REWARDED_AD_REWARD_BYTES) {
    throw new BadRequestException('Rewarded ad reward amount is outside the allowed range');
  }
  if (!Number.isInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > MAX_REWARDED_AD_DAILY_LIMIT) {
    throw new BadRequestException('Rewarded ad daily limit is outside the allowed range');
  }
}
