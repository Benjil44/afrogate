import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TelegramSelfServiceProvisioner,
  type ReferralAttribution,
  type SelfServiceAccount,
  type TelegramSelfServiceDeps,
} from '../src/telegram/telegram-self-service.ts';
import { buildConfigLabel } from '../src/telegram/telegram-format.ts';

interface Captured {
  createAccount: number;
  createNamedVlessConfig: number;
  lastCreateInput: Parameters<TelegramSelfServiceDeps['createAccount']>[0] | null;
  lastConfigLabel: string | null;
  attributeCalls: number;
}

function makeDeps(overrides: Partial<TelegramSelfServiceDeps> = {}): {
  deps: TelegramSelfServiceDeps;
  captured: Captured;
} {
  const captured: Captured = {
    createAccount: 0,
    createNamedVlessConfig: 0,
    lastCreateInput: null,
    lastConfigLabel: null,
    attributeCalls: 0,
  };
  const deps: TelegramSelfServiceDeps = {
    findAccountByTelegramId: async () => null,
    generateReferralCode: async () => 'REFCODE1',
    createAccount: async (input) => {
      captured.createAccount += 1;
      captured.lastCreateInput = input;
      return {
        id: 'acct-new',
        displayName: input.displayName,
        status: 'active',
        quotaLimitBytes: input.quotaLimitBytes,
        telegramId: input.telegramId,
      };
    },
    createNamedVlessConfig: async (_accountId, label) => {
      captured.createNamedVlessConfig += 1;
      captured.lastConfigLabel = label;
      return { id: 'cfg-1' };
    },
    getEntryLink: async () => 'vless://link',
    findPrimaryVlessConfigId: async () => 'cfg-existing',
    attributeAndCreditReferral: async () => {
      captured.attributeCalls += 1;
      return null;
    },
    buildConfigLabel: (name, phone) => buildConfigLabel(name, phone),
    ...overrides,
  };
  return { deps, captured };
}

describe('TelegramSelfServiceProvisioner.register (v2, 0 GB + named config)', () => {
  it('is idempotent per telegram_id: an existing account is returned without creating a second', async () => {
    const existing: SelfServiceAccount = {
      id: 'acct-1',
      displayName: 'Hani',
      status: 'active',
      quotaLimitBytes: 0,
      telegramId: '555',
    };
    const { deps, captured } = makeDeps({ findAccountByTelegramId: async () => existing });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.register({ telegramId: '555', displayName: 'Hani', phone: '989121234567' });

    assert.equal(result.created, false);
    assert.equal(result.account.id, 'acct-1');
    assert.equal(captured.createAccount, 0, 'no second account for a known telegram_id');
    assert.equal(captured.createNamedVlessConfig, 0);
  });

  it('creates a 0 GB account with the entered name + a user-derived config label', async () => {
    const { deps, captured } = makeDeps();
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.register({
      telegramId: '777',
      telegramUsername: 'neo',
      displayName: 'Hani',
      phone: '989121234567',
    });

    assert.equal(result.created, true);
    assert.equal(result.account.quotaLimitBytes, 0, 'NO trial: signup account is 0 GB');
    assert.equal(captured.lastCreateInput?.displayName, 'Hani');
    assert.equal(captured.lastCreateInput?.phone, '989121234567');
    assert.equal(captured.lastCreateInput?.referralCode, 'REFCODE1');
    assert.equal(captured.lastConfigLabel, 'Hani-09121234567', 'config is named after the user');
    assert.equal(result.entryLink, 'vless://link');
    assert.equal(captured.attributeCalls, 0, 'no referral attributed without a code');
  });

  it('attributes + credits a referral when a code was captured', async () => {
    const attribution: ReferralAttribution = {
      inviterAccountId: 'inviter-1',
      inviterTelegramId: '999',
      inviterTelegramChatId: 'chat-inv',
      friendName: 'Hani',
      signupGems: 50,
      inviterGemsBalance: 50,
      milestone: null,
    };
    const { deps, captured } = makeDeps({ attributeAndCreditReferral: async () => (captured.attributeCalls++, attribution) });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.register({
      telegramId: '888',
      displayName: 'Hani',
      phone: '989121234567',
      referralCode: 'FRIEND22',
    });

    assert.equal(captured.attributeCalls, 1);
    assert.equal(result.referral?.inviterAccountId, 'inviter-1');
    assert.equal(result.referral?.signupGems, 50);
  });

  it('resolves a concurrent-create race (unique violation) to the winning account', async () => {
    let calls = 0;
    const winner: SelfServiceAccount = { id: 'acct-win', status: 'active', quotaLimitBytes: 0, telegramId: '999' };
    const { deps, captured } = makeDeps({
      findAccountByTelegramId: async () => (calls++ === 0 ? null : winner),
      createAccount: async () => {
        const error = new Error('duplicate key') as Error & { code: string };
        error.code = '23505';
        throw error;
      },
    });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.register({ telegramId: '999', displayName: 'Hani', phone: '989121234567' });

    assert.equal(result.created, false);
    assert.equal(result.account.id, 'acct-win');
    assert.equal(captured.createNamedVlessConfig, 0, 'the loser does not create a config');
  });
});
