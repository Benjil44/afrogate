import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TelegramSelfServiceProvisioner,
  type SelfServiceAccount,
  type TelegramSelfServiceDeps,
} from '../src/telegram/telegram-self-service.ts';

function makeDeps(overrides: Partial<TelegramSelfServiceDeps> = {}): {
  deps: TelegramSelfServiceDeps;
  counters: { createAccount: number; createVlessConfig: number };
} {
  const counters = { createAccount: 0, createVlessConfig: 0 };
  const deps: TelegramSelfServiceDeps = {
    findAccountByTelegramId: async () => null,
    createAccount: async (input) => {
      counters.createAccount += 1;
      return {
        id: 'acct-new',
        displayName: 'Customer-NEW',
        status: 'active',
        quotaLimitBytes: input.quotaLimitBytes,
        telegramId: input.telegramId,
      };
    },
    createVlessConfig: async () => {
      counters.createVlessConfig += 1;
      return { id: 'cfg-1' };
    },
    getEntryLink: async () => 'vless://link',
    findPrimaryVlessConfigId: async () => 'cfg-existing',
    ...overrides,
  };
  return { deps, counters };
}

describe('TelegramSelfServiceProvisioner.ensureAccount', () => {
  it('is idempotent per telegram_id: an existing account is returned without creating a second', async () => {
    const existing: SelfServiceAccount = {
      id: 'acct-1',
      displayName: 'Customer-EXIST',
      status: 'active',
      quotaLimitBytes: 1_000_000_000,
      telegramId: '555',
    };
    const { deps, counters } = makeDeps({ findAccountByTelegramId: async () => existing });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.ensureAccount({ telegramId: '555' }, 1_000_000_000);

    assert.equal(result.created, false);
    assert.equal(result.account.id, 'acct-1');
    assert.equal(counters.createAccount, 0, 'no second account is created for a known telegram_id');
    assert.equal(counters.createVlessConfig, 0);
  });

  it('creates an account + VLESS config with the given 1 GB trial when unseen', async () => {
    const { deps, counters } = makeDeps();
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.ensureAccount({ telegramId: '777', telegramUsername: 'neo' }, 1_000_000_000);

    assert.equal(result.created, true);
    assert.equal(result.account.quotaLimitBytes, 1_000_000_000, 'trial is the 1 GB decimal default');
    assert.equal(result.entryLink, 'vless://link');
    assert.equal(counters.createAccount, 1);
    assert.equal(counters.createVlessConfig, 1);
  });

  it('honours a configured trial quota', async () => {
    const { deps } = makeDeps();
    const provisioner = new TelegramSelfServiceProvisioner(deps);
    const result = await provisioner.ensureAccount({ telegramId: '888' }, 5_000_000_000);
    assert.equal(result.account.quotaLimitBytes, 5_000_000_000);
  });

  it('resolves a concurrent-create race (unique violation) to the winning account', async () => {
    let calls = 0;
    const winner: SelfServiceAccount = {
      id: 'acct-win',
      status: 'active',
      quotaLimitBytes: 1_000_000_000,
      telegramId: '999',
    };
    const { deps, counters } = makeDeps({
      // First lookup: none. After the unique violation: the winner exists.
      findAccountByTelegramId: async () => (calls++ === 0 ? null : winner),
      createAccount: async () => {
        const error = new Error('duplicate key') as Error & { code: string };
        error.code = '23505';
        throw error;
      },
    });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.ensureAccount({ telegramId: '999' }, 1_000_000_000);

    assert.equal(result.created, false);
    assert.equal(result.account.id, 'acct-win');
    assert.equal(counters.createVlessConfig, 0, 'the loser does not create a config');
  });
});
