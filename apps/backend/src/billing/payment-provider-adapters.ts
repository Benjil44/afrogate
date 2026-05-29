import { BadRequestException } from '@nestjs/common';
import type {
  AdminPaymentProviderAdapterSummary,
  PaymentProviderAdapterStatus,
  PaymentProviderSettlementMode,
} from '@afrogate/shared';

const PAYMENT_PROVIDER_ADAPTER_VERSION = 1;

export interface PaymentProviderAdapterOrderInput {
  id: string;
  packageName: string;
  packageSlug: string;
  amount: number;
  currency: string;
  provider: string;
  providerOrderId?: string | null;
}

export interface PaymentProviderAdapterMethodInput {
  id: string;
  name: string;
  slug: string;
  provider: string;
  checkoutMode: string;
  publicConfig: Record<string, unknown>;
  instructions?: string | null;
}

export interface PreparePaymentProviderCheckoutInput {
  order: PaymentProviderAdapterOrderInput;
  method: PaymentProviderAdapterMethodInput;
  returnUrl?: string | null;
  cancelUrl?: string | null;
  idempotencyKey?: string | null;
}

export interface PreparedPaymentProviderCheckout {
  adapterVersion: number;
  provider: string;
  paymentReference: string;
  checkoutUrl: string | null;
  instructions: string | null;
  adapterStatus: PaymentProviderAdapterStatus;
  settlementMode: PaymentProviderSettlementMode;
}

export function listPaymentProviderAdapters(): AdminPaymentProviderAdapterSummary[] {
  return [
    {
      provider: 'paypal',
      checkoutMode: 'hosted_redirect',
      settlementMode: 'auto_capture',
      status: 'implemented',
      supportsHostedCheckout: true,
      supportsPaymentReference: true,
      supportsWebhookVerification: true,
      requiresSecretRef: true,
      publicConfigKeys: [],
      safetyNotes: ['deployment_secret_required', 'verified_webhook_before_state_change'],
    },
    {
      provider: 'card',
      checkoutMode: 'hosted_redirect',
      settlementMode: 'hosted_gateway',
      status: 'verification_adapter_required',
      supportsHostedCheckout: true,
      supportsPaymentReference: true,
      supportsWebhookVerification: false,
      requiresSecretRef: true,
      publicConfigKeys: ['checkoutUrl'],
      safetyNotes: ['provider_specific_verification_required_before_paid'],
    },
    {
      provider: 'local_gateway',
      checkoutMode: 'hosted_redirect',
      settlementMode: 'hosted_gateway',
      status: 'verification_adapter_required',
      supportsHostedCheckout: true,
      supportsPaymentReference: true,
      supportsWebhookVerification: false,
      requiresSecretRef: true,
      publicConfigKeys: ['checkoutUrl'],
      safetyNotes: ['local_gateway_callback_must_be_verified_before_paid'],
    },
    {
      provider: 'bank_transfer',
      checkoutMode: 'manual',
      settlementMode: 'manual_verification',
      status: 'manual_settlement',
      supportsHostedCheckout: false,
      supportsPaymentReference: true,
      supportsWebhookVerification: false,
      requiresSecretRef: false,
      publicConfigKeys: ['bankName', 'accountName', 'iban', 'cardNumber'],
      safetyNotes: ['manual_receipt_verification_required_before_paid'],
    },
    {
      provider: 'crypto',
      checkoutMode: 'manual',
      settlementMode: 'manual_verification',
      status: 'manual_settlement',
      supportsHostedCheckout: false,
      supportsPaymentReference: true,
      supportsWebhookVerification: false,
      requiresSecretRef: false,
      publicConfigKeys: ['asset', 'network', 'address', 'memoTag'],
      safetyNotes: ['manual_chain_confirmation_required_before_paid'],
    },
  ];
}

export function prepareAdditionalPaymentProviderCheckout(
  input: PreparePaymentProviderCheckoutInput,
): PreparedPaymentProviderCheckout {
  const provider = normalizeProvider(input.order.provider || input.method.provider);
  if (provider !== normalizeProvider(input.method.provider)) {
    throw new BadRequestException('Payment order provider does not match the payment method provider');
  }
  if (provider === 'paypal') {
    throw new BadRequestException('Use the PayPal checkout adapter for PayPal payment orders');
  }

  const paymentReference = normalizeExistingReference(input.order.providerOrderId) ?? `afrogate-${input.order.id}`;

  if (provider === 'card' || provider === 'local_gateway') {
    return prepareHostedGatewayCheckout(input, provider, paymentReference);
  }
  if (provider === 'bank_transfer') {
    return prepareBankTransferCheckout(input, paymentReference);
  }
  if (provider === 'crypto') {
    return prepareCryptoCheckout(input, paymentReference);
  }

  throw new BadRequestException(`Payment provider adapter is not implemented for ${provider}`);
}

function prepareHostedGatewayCheckout(
  input: PreparePaymentProviderCheckoutInput,
  provider: 'card' | 'local_gateway',
  paymentReference: string,
): PreparedPaymentProviderCheckout {
  const baseUrl = getPublicString(input.method.publicConfig, ['checkoutUrl', 'checkoutBaseUrl', 'paymentUrl']);
  if (!baseUrl) {
    throw new BadRequestException(`${provider} payment method public config must include checkoutUrl`);
  }

  const checkoutUrl = buildHostedCheckoutUrl(baseUrl, input, paymentReference);
  const configuredInstructions = normalizeNullableString(input.method.instructions);
  const fallbackInstructions = `${input.method.name} reference: ${paymentReference}`;

  return {
    adapterVersion: PAYMENT_PROVIDER_ADAPTER_VERSION,
    provider,
    paymentReference,
    checkoutUrl,
    instructions: configuredInstructions ?? fallbackInstructions,
    adapterStatus: 'verification_adapter_required',
    settlementMode: 'hosted_gateway',
  };
}

function prepareBankTransferCheckout(
  input: PreparePaymentProviderCheckoutInput,
  paymentReference: string,
): PreparedPaymentProviderCheckout {
  const bankName = getPublicString(input.method.publicConfig, ['bankName', 'bank']);
  const accountName = getPublicString(input.method.publicConfig, ['accountName', 'holderName']);
  const iban = getPublicString(input.method.publicConfig, ['iban', 'sheba']);
  const cardNumber = getPublicString(input.method.publicConfig, ['cardNumber']);
  const accountNumber = getPublicString(input.method.publicConfig, ['accountNumber']);

  const details = [
    normalizeNullableString(input.method.instructions),
    bankName ? `Bank: ${bankName}` : null,
    accountName ? `Account: ${accountName}` : null,
    iban ? `IBAN: ${iban}` : null,
    cardNumber ? `Card: ${cardNumber}` : null,
    accountNumber ? `Account number: ${accountNumber}` : null,
    `Reference: ${paymentReference}`,
  ].filter((item): item is string => Boolean(item));

  return {
    adapterVersion: PAYMENT_PROVIDER_ADAPTER_VERSION,
    provider: 'bank_transfer',
    paymentReference,
    checkoutUrl: null,
    instructions: details.join('\n'),
    adapterStatus: 'manual_settlement',
    settlementMode: 'manual_verification',
  };
}

function prepareCryptoCheckout(
  input: PreparePaymentProviderCheckoutInput,
  paymentReference: string,
): PreparedPaymentProviderCheckout {
  const asset = getPublicString(input.method.publicConfig, ['asset', 'symbol'])?.toUpperCase() ?? null;
  const network = getPublicString(input.method.publicConfig, ['network', 'chain']);
  const address = getPublicString(input.method.publicConfig, ['address', 'walletAddress']);
  const memoTag = getPublicString(input.method.publicConfig, ['memoTag', 'memo', 'tag']);
  if (!asset || !network || !address) {
    throw new BadRequestException('Crypto payment method public config must include asset, network, and address');
  }

  const details = [
    normalizeNullableString(input.method.instructions),
    `Asset: ${asset}`,
    `Network: ${network}`,
    `Address: ${address}`,
    memoTag ? `Memo/tag: ${memoTag}` : null,
    `Reference: ${paymentReference}`,
  ].filter((item): item is string => Boolean(item));

  return {
    adapterVersion: PAYMENT_PROVIDER_ADAPTER_VERSION,
    provider: 'crypto',
    paymentReference,
    checkoutUrl: null,
    instructions: details.join('\n'),
    adapterStatus: 'manual_settlement',
    settlementMode: 'manual_verification',
  };
}

function buildHostedCheckoutUrl(
  baseUrl: string,
  input: PreparePaymentProviderCheckoutInput,
  paymentReference: string,
): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new BadRequestException('Payment method checkoutUrl must be a valid URL');
  }

  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new BadRequestException('Payment method checkoutUrl must use HTTPS');
  }

  const params: Record<string, string> = {
    afrogate_order_id: input.order.id,
    amount: String(input.order.amount),
    currency: input.order.currency,
    package: input.order.packageSlug,
    reference: paymentReference,
  };
  const returnUrl = normalizeOptionalUrl(input.returnUrl, 'Payment return URL');
  const cancelUrl = normalizeOptionalUrl(input.cancelUrl, 'Payment cancel URL');
  if (returnUrl) params.return_url = returnUrl;
  if (cancelUrl) params.cancel_url = cancelUrl;

  for (const [key, value] of Object.entries(params)) {
    if (!parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
  }

  return parsed.toString();
}

function normalizeOptionalUrl(value: string | null | undefined, context: string): string | null {
  const normalized = normalizeNullableString(value);
  if (!normalized) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new BadRequestException(`${context} must be a valid URL`);
  }

  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new BadRequestException(`${context} must use HTTPS`);
  }

  return parsed.toString();
}

function getPublicString(value: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const normalized = normalizeNullableString(value[key]);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeExistingReference(value: string | null | undefined): string | null {
  const normalized = normalizeNullableString(value);
  if (!normalized) return null;
  if (normalized.length > 160) throw new BadRequestException('Payment reference is too long');
  return normalized;
}

function normalizeProvider(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}
