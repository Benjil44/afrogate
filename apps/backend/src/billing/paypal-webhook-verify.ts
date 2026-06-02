import { UnauthorizedException } from '@nestjs/common';

export interface PayPalWebhookSignatureHeaders {
  authAlgo?: string;
  certUrl?: string;
  transmissionId?: string;
  transmissionSig?: string;
  transmissionTime?: string;
}

export interface VerifiedPayPalWebhook {
  eventId: string | null;
  eventType: string | null;
}

/** Trim a required PayPal signature header, throwing UnauthorizedException when missing. */
export function requirePayPalWebhookHeader(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new UnauthorizedException(`Missing PayPal webhook signature header ${name}`);
  return normalized;
}

/** Extract a trimmed string property from an unknown record, or null. */
export function stringProperty(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/**
 * Builds the body for PayPal's `/v1/notifications/verify-webhook-signature` call,
 * requiring all five signature headers (throws if any is missing).
 */
export function buildPayPalSignatureVerificationRequest(
  headers: PayPalWebhookSignatureHeaders,
  webhookId: string,
  webhookEvent: Record<string, unknown>,
): Record<string, unknown> {
  return {
    auth_algo: requirePayPalWebhookHeader(headers.authAlgo, 'PAYPAL-AUTH-ALGO'),
    cert_url: requirePayPalWebhookHeader(headers.certUrl, 'PAYPAL-CERT-URL'),
    transmission_id: requirePayPalWebhookHeader(headers.transmissionId, 'PAYPAL-TRANSMISSION-ID'),
    transmission_sig: requirePayPalWebhookHeader(headers.transmissionSig, 'PAYPAL-TRANSMISSION-SIG'),
    transmission_time: requirePayPalWebhookHeader(headers.transmissionTime, 'PAYPAL-TRANSMISSION-TIME'),
    webhook_id: webhookId,
    webhook_event: webhookEvent,
  };
}

/**
 * Interprets PayPal's verification response: throws UnauthorizedException unless
 * `verification_status === 'SUCCESS'`, otherwise returns the event id/type.
 */
export function interpretPayPalVerificationResponse(
  verificationStatus: unknown,
  webhookEvent: Record<string, unknown>,
): VerifiedPayPalWebhook {
  if (verificationStatus !== 'SUCCESS') {
    throw new UnauthorizedException('PayPal webhook signature verification failed');
  }
  return {
    eventId: stringProperty(webhookEvent, 'id'),
    eventType: stringProperty(webhookEvent, 'event_type'),
  };
}
