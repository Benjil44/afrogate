import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RewardedAdProviderWebhookDto } from './dto/rewarded-ad-webhook.dto';
import {
  canonicalJson,
  clampToleranceSeconds,
  computeRewardedAdSignature,
  isTimestampFresh,
  normalizeHexSignature,
  secureHexCompare,
} from './rewarded-ad-webhook.crypto';

export interface RewardedAdWebhookSignatureHeaders {
  signature?: string;
  timestamp?: string;
}

export interface VerifiedRewardedAdWebhook {
  provider?: string | null;
  clientConfigId: string;
  adSessionId: string | null;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
}

@Injectable()
export class RewardedAdWebhookService {
  constructor(private readonly config: ConfigService) {}

  verify(
    headers: RewardedAdWebhookSignatureHeaders,
    payload: RewardedAdProviderWebhookDto,
  ): VerifiedRewardedAdWebhook {
    const secret = this.config.get<string>('AFROGATE_REWARDED_AD_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      throw new ServiceUnavailableException('Rewarded ad webhook secret is not configured');
    }

    const timestamp = headers.timestamp?.trim() || payload.eventTimestamp?.trim();
    if (!timestamp) throw new UnauthorizedException('Rewarded ad webhook timestamp is required');
    const toleranceSeconds = clampToleranceSeconds(this.config.get<string>('AFROGATE_REWARDED_AD_WEBHOOK_TOLERANCE_SECONDS'));
    if (!isTimestampFresh(timestamp, toleranceSeconds)) {
      throw new UnauthorizedException('Rewarded ad webhook timestamp is invalid or outside the allowed window');
    }

    const signature = normalizeHexSignature(headers.signature);
    const expected = computeRewardedAdSignature(secret, timestamp, canonicalJson(payload));
    if (!secureHexCompare(signature, expected)) {
      throw new UnauthorizedException('Rewarded ad webhook signature verification failed');
    }

    const idempotencyKey =
      this.normalizeNullableString(payload.idempotencyKey) ??
      this.normalizeNullableString(payload.providerEventId) ??
      this.normalizeNullableString(payload.adSessionId);
    if (!idempotencyKey) {
      throw new UnauthorizedException('Rewarded ad webhook requires idempotencyKey, providerEventId, or adSessionId');
    }

    return {
      provider: this.normalizeNullableString(payload.provider),
      clientConfigId: payload.clientConfigId,
      adSessionId: this.normalizeNullableString(payload.adSessionId),
      idempotencyKey,
      metadata: {
        signedWebhook: true,
        signatureTimestamp: timestamp,
        providerEventId: this.normalizeNullableString(payload.providerEventId),
        adUnitId: this.normalizeNullableString(payload.adUnitId),
        placementId: this.normalizeNullableString(payload.placementId),
        rewardAmount: typeof payload.rewardAmount === 'number' ? payload.rewardAmount : null,
        rewardCurrency: this.normalizeNullableString(payload.rewardCurrency),
        eventTimestamp: this.normalizeNullableString(payload.eventTimestamp),
      },
    };
  }

  private normalizeNullableString(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized || null;
  }
}
