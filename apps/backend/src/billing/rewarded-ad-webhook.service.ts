import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { RewardedAdProviderWebhookDto } from './dto/rewarded-ad-webhook.dto';

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
  private static readonly defaultToleranceSeconds = 300;

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
    this.assertFreshTimestamp(timestamp);

    const signature = this.normalizeSignature(headers.signature);
    const canonicalPayload = this.canonicalJson(payload);
    const expected = createHmac('sha256', secret).update(`${timestamp}.${canonicalPayload}`, 'utf8').digest('hex');
    if (!this.secureCompare(signature, expected)) {
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

  canonicalJson(value: unknown): string {
    return JSON.stringify(this.sortValue(value));
  }

  private assertFreshTimestamp(value: string): void {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new UnauthorizedException('Rewarded ad webhook timestamp is invalid');
    }

    const toleranceSeconds = this.parseToleranceSeconds(this.config.get<string>('AFROGATE_REWARDED_AD_WEBHOOK_TOLERANCE_SECONDS'));
    const ageSeconds = Math.abs(Date.now() - date.getTime()) / 1000;
    if (ageSeconds > toleranceSeconds) {
      throw new UnauthorizedException('Rewarded ad webhook timestamp is outside the allowed window');
    }
  }

  private normalizeSignature(value: string | undefined): string {
    const normalized = value?.trim().replace(/^sha256=/i, '') ?? '';
    if (!/^[a-f0-9]{64}$/i.test(normalized)) {
      throw new UnauthorizedException('Rewarded ad webhook signature is invalid');
    }
    return normalized.toLowerCase();
  }

  private secureCompare(leftHex: string, rightHex: string): boolean {
    const left = Buffer.from(leftHex, 'hex');
    const right = Buffer.from(rightHex, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sortValue(item));
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, this.sortValue(item)]),
    );
  }

  private normalizeNullableString(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized || null;
  }

  private parseToleranceSeconds(value: string | undefined): number {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed)) return RewardedAdWebhookService.defaultToleranceSeconds;
    return Math.min(Math.max(parsed, 30), 3600);
  }
}
