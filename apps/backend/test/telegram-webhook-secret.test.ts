import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { telegramWebhookSecretMatches } from '../src/telegram/telegram-webhook-secret.ts';

describe('telegramWebhookSecretMatches', () => {
  it('matches an identical configured secret', () => {
    assert.equal(telegramWebhookSecretMatches('s3cret-token', 's3cret-token'), true);
  });

  it('rejects a wrong or length-mismatched value', () => {
    assert.equal(telegramWebhookSecretMatches('s3cret-token', 's3cret-toknown'), false);
    assert.equal(telegramWebhookSecretMatches('aaaa', 'aaab'), false);
  });

  it('rejects when either side is missing/empty (no unconfigured-secret bypass)', () => {
    assert.equal(telegramWebhookSecretMatches(undefined, 'anything'), false);
    assert.equal(telegramWebhookSecretMatches('expected', undefined), false);
    assert.equal(telegramWebhookSecretMatches('', ''), false);
  });
});
