import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  interpretTelegramApiError,
  isTelegramResponseOk,
  parseTelegramResultField,
  planTelegramProfileUpdate,
  tokenNotConfiguredState,
  TELEGRAM_PROFILE_LIMITS,
  type TelegramBotProfile,
} from '../src/telegram/telegram-profile.ts';

const empty: TelegramBotProfile = { name: null, shortDescription: null, description: null };

describe('planTelegramProfileUpdate (only changed provided fields publish)', () => {
  it('emits one setter call per provided, changed, non-empty field with the right method + body key', () => {
    const calls = planTelegramProfileUpdate(empty, {
      name: 'afroWS',
      shortDescription: 'Fast, private access',
      description: 'Welcome to afroWS.',
    });

    assert.deepEqual(calls, [
      { field: 'name', method: 'setMyName', bodyKey: 'name', value: 'afroWS' },
      { field: 'shortDescription', method: 'setMyShortDescription', bodyKey: 'short_description', value: 'Fast, private access' },
      { field: 'description', method: 'setMyDescription', bodyKey: 'description', value: 'Welcome to afroWS.' },
    ]);
  });

  it('skips fields that are undefined', () => {
    const calls = planTelegramProfileUpdate(empty, { name: 'afroWS' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].field, 'name');
  });

  it('skips empty / whitespace-only fields (never clears an existing value)', () => {
    const current: TelegramBotProfile = { name: 'afroWS', shortDescription: 'hi', description: 'desc' };
    const calls = planTelegramProfileUpdate(current, { name: '', shortDescription: '   ', description: '' });
    assert.deepEqual(calls, []);
  });

  it('skips fields whose value is unchanged (after trim) — no needless Telegram call', () => {
    const current: TelegramBotProfile = { name: 'afroWS', shortDescription: 'hi', description: 'desc' };
    const calls = planTelegramProfileUpdate(current, {
      name: '  afroWS  ',
      shortDescription: 'hi',
      description: 'desc v2',
    });
    assert.deepEqual(calls, [
      { field: 'description', method: 'setMyDescription', bodyKey: 'description', value: 'desc v2' },
    ]);
  });

  it('rejects over-length values per the Telegram caps (64 / 120 / 512)', () => {
    assert.throws(
      () => planTelegramProfileUpdate(empty, { name: 'a'.repeat(TELEGRAM_PROFILE_LIMITS.name + 1) }),
      BadRequestException,
    );
    assert.throws(
      () => planTelegramProfileUpdate(empty, { shortDescription: 'b'.repeat(TELEGRAM_PROFILE_LIMITS.shortDescription + 1) }),
      BadRequestException,
    );
    assert.throws(
      () => planTelegramProfileUpdate(empty, { description: 'c'.repeat(TELEGRAM_PROFILE_LIMITS.description + 1) }),
      BadRequestException,
    );
  });

  it('accepts values exactly at the cap', () => {
    const calls = planTelegramProfileUpdate(empty, { name: 'a'.repeat(TELEGRAM_PROFILE_LIMITS.name) });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].value.length, TELEGRAM_PROFILE_LIMITS.name);
  });
});

describe('parseTelegramResultField (getMy* response parsing)', () => {
  it('returns the trimmed field from an ok response', () => {
    assert.equal(parseTelegramResultField('{"ok":true,"result":{"name":"afroWS"}}', 'name'), 'afroWS');
    assert.equal(
      parseTelegramResultField('{"ok":true,"result":{"short_description":" hi "}}', 'short_description'),
      'hi',
    );
  });

  it('returns null for an unset field (ok:true, empty string)', () => {
    assert.equal(parseTelegramResultField('{"ok":true,"result":{"description":""}}', 'description'), null);
  });

  it('returns null for a not-ok or malformed body', () => {
    assert.equal(parseTelegramResultField('{"ok":false,"error_code":401}', 'name'), null);
    assert.equal(parseTelegramResultField('not json', 'name'), null);
    assert.equal(parseTelegramResultField('{"ok":true}', 'name'), null);
  });
});

describe('isTelegramResponseOk', () => {
  it('is true only when the body reports ok:true', () => {
    assert.equal(isTelegramResponseOk('{"ok":true,"result":true}'), true);
    assert.equal(isTelegramResponseOk('{"ok":false,"description":"nope"}'), false);
    assert.equal(isTelegramResponseOk('garbage'), false);
  });
});

describe('interpretTelegramApiError (helpful messages, not raw 500s)', () => {
  it('maps 401 / Unauthorized to an invalid-token message', () => {
    const fromCode = interpretTelegramApiError(401, '{"ok":false,"error_code":401,"description":"Unauthorized"}');
    assert.equal(fromCode.code, 'telegram_unauthorized');
    assert.match(fromCode.message, /invalid or revoked/i);
  });

  it('maps 429 to a rate-limit message', () => {
    const rate = interpretTelegramApiError(429, '{"ok":false,"error_code":429,"description":"Too Many Requests"}');
    assert.equal(rate.code, 'telegram_rate_limited');
  });

  it('falls back to a generic status message carrying Telegram description', () => {
    const generic = interpretTelegramApiError(400, '{"ok":false,"error_code":400,"description":"NAME_TOO_LONG"}');
    assert.equal(generic.code, 'telegram_status_400');
    assert.match(generic.message, /NAME_TOO_LONG/);
  });
});

describe('tokenNotConfiguredState (missing token handled gracefully)', () => {
  it('returns null fields with tokenConfigured false (no 500 on GET)', () => {
    assert.deepEqual(tokenNotConfiguredState(), {
      name: null,
      shortDescription: null,
      description: null,
      tokenConfigured: false,
    });
  });
});
