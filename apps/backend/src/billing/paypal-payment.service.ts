import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboundHttpService } from '../outbound/outbound-http.service';

export interface CreatePayPalCheckoutInput {
  paymentOrderId: string;
  packageName: string;
  amount: number;
  currency: string;
  returnUrl?: string | null;
  cancelUrl?: string | null;
  idempotencyKey?: string | null;
}

export interface PayPalCheckoutResult {
  providerOrderId: string;
  checkoutUrl: string;
  providerStatus: string | null;
}

export interface CapturePayPalOrderInput {
  paymentOrderId: string;
  providerOrderId: string;
  idempotencyKey?: string | null;
}

export interface PayPalCaptureResult {
  providerOrderId: string;
  providerCaptureId: string | null;
  providerStatus: string | null;
  providerCaptureStatus: string | null;
}

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

interface PayPalRuntimeConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  webhookId: string | null;
  timeoutMs: number;
  returnUrl: string | null;
  cancelUrl: string | null;
}

interface PayPalAccessTokenResponse {
  access_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
}

interface PayPalOrderLink {
  rel?: unknown;
  href?: unknown;
}

interface PayPalOrderResponse {
  id?: unknown;
  status?: unknown;
  links?: unknown;
  purchase_units?: unknown;
}

interface PayPalWebhookVerificationResponse {
  verification_status?: unknown;
}

@Injectable()
export class PayPalPaymentService {
  private static readonly defaultSandboxBaseUrl = 'https://api-m.sandbox.paypal.com';
  private static readonly defaultLiveBaseUrl = 'https://api-m.paypal.com';
  private static readonly defaultTimeoutMs = 12000;
  private static readonly maxRequestIdLength = 38;
  private static readonly zeroDecimalCurrencies = new Set([
    'BIF',
    'CLP',
    'DJF',
    'GNF',
    'JPY',
    'KMF',
    'KRW',
    'MGA',
    'PYG',
    'RWF',
    'UGX',
    'VND',
    'VUV',
    'XAF',
    'XOF',
    'XPF',
  ]);

  constructor(
    private readonly config: ConfigService,
    private readonly outboundHttp: OutboundHttpService,
  ) {}

  async createCheckout(input: CreatePayPalCheckoutInput): Promise<PayPalCheckoutResult> {
    const paypal = this.requirePayPalConfig(false);
    const accessToken = await this.getAccessToken(paypal);
    const currencyCode = this.normalizePayPalCurrency(input.currency);
    const amountValue = this.formatPayPalAmount(input.amount, currencyCode);
    const returnUrl = this.normalizeOptionalUrl(input.returnUrl ?? paypal.returnUrl, 'PayPal return URL');
    const cancelUrl = this.normalizeOptionalUrl(input.cancelUrl ?? paypal.cancelUrl, 'PayPal cancel URL');
    const applicationContext =
      returnUrl || cancelUrl
        ? {
            ...(returnUrl ? { return_url: returnUrl } : {}),
            ...(cancelUrl ? { cancel_url: cancelUrl } : {}),
            user_action: 'PAY_NOW',
          }
        : undefined;

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: input.paymentOrderId,
          description: this.truncateText(input.packageName, 127),
          amount: {
            currency_code: currencyCode,
            value: amountValue,
          },
        },
      ],
      ...(applicationContext ? { application_context: applicationContext } : {}),
    };

    const response = await this.requestJson<PayPalOrderResponse>(
      paypal,
      accessToken,
      '/v2/checkout/orders',
      'POST',
      payload,
      {
        'PayPal-Request-Id': this.normalizeRequestId(input.idempotencyKey, input.paymentOrderId),
      },
      'create PayPal order',
    );

    const providerOrderId = this.stringProperty(response, 'id');
    const checkoutUrl = this.findOrderLink(response, 'approve');
    if (!providerOrderId || !checkoutUrl) {
      throw new ServiceUnavailableException('PayPal did not return an order id and approval URL');
    }

    return {
      providerOrderId,
      checkoutUrl,
      providerStatus: this.stringProperty(response, 'status'),
    };
  }

  async captureOrder(input: CapturePayPalOrderInput): Promise<PayPalCaptureResult> {
    const paypal = this.requirePayPalConfig(false);
    const accessToken = await this.getAccessToken(paypal);
    const providerOrderId = this.normalizeProviderOrderId(input.providerOrderId);

    const response = await this.requestJson<PayPalOrderResponse>(
      paypal,
      accessToken,
      `/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`,
      'POST',
      {},
      {
        'PayPal-Request-Id': this.normalizeRequestId(input.idempotencyKey, input.paymentOrderId),
      },
      'capture PayPal order',
    );

    const providerStatus = this.stringProperty(response, 'status');
    if (providerStatus !== 'COMPLETED') {
      throw new BadRequestException(`PayPal capture is not completed; provider status is ${providerStatus ?? 'unknown'}`);
    }

    const capture = this.findFirstCapture(response);

    return {
      providerOrderId,
      providerCaptureId: capture.id,
      providerStatus,
      providerCaptureStatus: capture.status,
    };
  }

  async verifyWebhook(
    headers: PayPalWebhookSignatureHeaders,
    webhookEvent: Record<string, unknown>,
  ): Promise<VerifiedPayPalWebhook> {
    const paypal = this.requirePayPalConfig(true);
    const accessToken = await this.getAccessToken(paypal);
    const authAlgo = this.requireHeader(headers.authAlgo, 'PAYPAL-AUTH-ALGO');
    const certUrl = this.requireHeader(headers.certUrl, 'PAYPAL-CERT-URL');
    const transmissionId = this.requireHeader(headers.transmissionId, 'PAYPAL-TRANSMISSION-ID');
    const transmissionSig = this.requireHeader(headers.transmissionSig, 'PAYPAL-TRANSMISSION-SIG');
    const transmissionTime = this.requireHeader(headers.transmissionTime, 'PAYPAL-TRANSMISSION-TIME');

    const response = await this.requestJson<PayPalWebhookVerificationResponse>(
      paypal,
      accessToken,
      '/v1/notifications/verify-webhook-signature',
      'POST',
      {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: paypal.webhookId,
        webhook_event: webhookEvent,
      },
      {},
      'verify PayPal webhook signature',
    );

    if (response.verification_status !== 'SUCCESS') {
      throw new UnauthorizedException('PayPal webhook signature verification failed');
    }

    return {
      eventId: this.stringProperty(webhookEvent, 'id'),
      eventType: this.stringProperty(webhookEvent, 'event_type'),
    };
  }

  private requirePayPalConfig(requireWebhookId: boolean): PayPalRuntimeConfig {
    if (!this.isEnabled(this.config.get<string>('AFROGATE_PAYPAL_ENABLED'))) {
      throw new ServiceUnavailableException('PayPal integration is disabled');
    }

    const clientId = this.config.get<string>('AFROGATE_PAYPAL_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('AFROGATE_PAYPAL_CLIENT_SECRET')?.trim();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('PayPal client id and client secret are required');
    }

    const environment = this.config.get<string>('AFROGATE_PAYPAL_ENVIRONMENT')?.trim().toLowerCase() ?? 'sandbox';
    const configuredBaseUrl = this.config.get<string>('AFROGATE_PAYPAL_API_BASE_URL')?.trim();
    const baseUrl =
      configuredBaseUrl ||
      (environment === 'live' ? PayPalPaymentService.defaultLiveBaseUrl : PayPalPaymentService.defaultSandboxBaseUrl);
    const parsedBaseUrl = new URL(baseUrl);
    if (parsedBaseUrl.protocol !== 'https:') {
      throw new ServiceUnavailableException('AFROGATE_PAYPAL_API_BASE_URL must use HTTPS');
    }

    const webhookId = this.config.get<string>('AFROGATE_PAYPAL_WEBHOOK_ID')?.trim() || null;
    if (requireWebhookId && !webhookId) {
      throw new ServiceUnavailableException('AFROGATE_PAYPAL_WEBHOOK_ID is required for PayPal webhooks');
    }

    return {
      baseUrl: parsedBaseUrl.toString().replace(/\/+$/, ''),
      clientId,
      clientSecret,
      webhookId,
      timeoutMs: this.parseTimeoutMs(this.config.get<string>('AFROGATE_PAYPAL_TIMEOUT_MS')),
      returnUrl: this.config.get<string>('AFROGATE_PAYPAL_RETURN_URL')?.trim() || null,
      cancelUrl: this.config.get<string>('AFROGATE_PAYPAL_CANCEL_URL')?.trim() || null,
    };
  }

  private async getAccessToken(paypal: PayPalRuntimeConfig): Promise<string> {
    const credentials = Buffer.from(`${paypal.clientId}:${paypal.clientSecret}`, 'utf8').toString('base64');
    const response = await this.outboundHttp.request(`${paypal.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      timeoutMs: paypal.timeoutMs,
      body: 'grant_type=client_credentials',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`PayPal OAuth failed with status ${response.statusCode}`);
    }

    const parsed = this.parseJson<PayPalAccessTokenResponse>(response.body, 'PayPal OAuth response');
    if (typeof parsed.access_token !== 'string' || !parsed.access_token.trim()) {
      throw new ServiceUnavailableException('PayPal OAuth response did not include an access token');
    }

    return parsed.access_token;
  }

  private async requestJson<T>(
    paypal: PayPalRuntimeConfig,
    accessToken: string,
    path: string,
    method: 'POST' | 'GET',
    payload: unknown,
    headers: Record<string, string>,
    context: string,
  ): Promise<T> {
    const body = method === 'POST' ? JSON.stringify(payload) : undefined;
    const response = await this.outboundHttp.request(`${paypal.baseUrl}${path}`, {
      method,
      timeoutMs: paypal.timeoutMs,
      body,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(`PayPal ${context} failed with status ${response.statusCode}`);
    }

    return this.parseJson<T>(response.body, `PayPal ${context} response`);
  }

  private parseJson<T>(body: string, context: string): T {
    try {
      return JSON.parse(body || '{}') as T;
    } catch {
      throw new ServiceUnavailableException(`${context} was not valid JSON`);
    }
  }

  private normalizePayPalCurrency(value: string): string {
    const currencyCode = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      throw new BadRequestException('PayPal payment orders must use a three-letter ISO currency such as USD or EUR');
    }
    return currencyCode;
  }

  private formatPayPalAmount(amount: number, currencyCode: string): string {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('PayPal payment order amount must be a positive safe integer');
    }

    const fractionDigits = PayPalPaymentService.zeroDecimalCurrencies.has(currencyCode) ? 0 : 2;
    return amount.toFixed(fractionDigits);
  }

  private normalizeProviderOrderId(value: string): string {
    const normalized = value.trim();
    if (!normalized) throw new BadRequestException('PayPal provider order id is required');
    if (normalized.length > 160) throw new BadRequestException('PayPal provider order id is too long');
    return normalized;
  }

  private normalizeRequestId(value: string | null | undefined, fallback: string): string {
    const normalized = (value?.trim() || fallback.trim()).replace(/[^a-zA-Z0-9._~-]+/g, '-');
    const clipped = normalized.slice(0, PayPalPaymentService.maxRequestIdLength);
    return clipped || fallback.slice(0, PayPalPaymentService.maxRequestIdLength);
  }

  private normalizeOptionalUrl(value: string | null | undefined, context: string): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException(`${context} must be a valid URL`);
    }

    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      throw new BadRequestException(`${context} must use HTTPS`);
    }

    return parsed.toString();
  }

  private findOrderLink(response: PayPalOrderResponse, rel: string): string | null {
    if (!Array.isArray(response.links)) return null;

    for (const link of response.links as PayPalOrderLink[]) {
      if (link?.rel === rel && typeof link.href === 'string' && link.href.trim()) {
        return link.href.trim();
      }
    }

    return null;
  }

  private findFirstCapture(response: PayPalOrderResponse): { id: string | null; status: string | null } {
    if (!Array.isArray(response.purchase_units)) return { id: null, status: null };

    for (const unit of response.purchase_units) {
      const unitRecord = this.asRecord(unit);
      const payments = this.asRecord(unitRecord?.payments);
      const captures = payments?.captures;
      if (!Array.isArray(captures)) continue;

      for (const capture of captures) {
        const captureRecord = this.asRecord(capture);
        const id = this.stringProperty(captureRecord, 'id');
        if (id) {
          return {
            id,
            status: this.stringProperty(captureRecord, 'status'),
          };
        }
      }
    }

    return { id: null, status: null };
  }

  private stringProperty(value: unknown, key: string): string | null {
    const record = this.asRecord(value);
    const raw = record?.[key];
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private requireHeader(value: string | undefined, name: string): string {
    const normalized = value?.trim();
    if (!normalized) throw new UnauthorizedException(`Missing PayPal webhook signature header ${name}`);
    return normalized;
  }

  private parseTimeoutMs(value: string | undefined): number {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed)) return PayPalPaymentService.defaultTimeoutMs;
    return Math.min(Math.max(parsed, 1000), 30000);
  }

  private truncateText(value: string, maxLength: number): string {
    const trimmed = value.trim();
    return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
  }

  private isEnabled(value: string | undefined): boolean {
    return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
  }
}
