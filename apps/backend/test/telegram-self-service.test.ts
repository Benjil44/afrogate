import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TelegramSelfServiceProvisioner,
  type LinkAccountByPhoneInput,
  type PhoneMatchAccount,
  type PhoneRegistrationEvent,
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
  linkCalls: number;
  lastLinkInput: LinkAccountByPhoneInput | null;
  phoneEvents: Array<{ event: PhoneRegistrationEvent; matchedAccountIds: string[] }>;
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
    linkCalls: 0,
    lastLinkInput: null,
    phoneEvents: [],
  };
  const deps: TelegramSelfServiceDeps = {
    findAccountByTelegramId: async () => null,
    findLiveAccountsByPhone: async () => [],
    linkAccountByPhone: async (input) => {
      captured.linkCalls += 1;
      captured.lastLinkInput = input;
      return {
        id: input.accountId,
        displayName: 'Existing Name',
        status: 'active',
        quotaLimitBytes: 20_000_000_000,
        telegramId: input.telegramId,
      };
    },
    recordPhoneRegistrationEvent: async (event, input) => {
      captured.phoneEvents.push({ event, matchedAccountIds: input.matchedAccountIds });
    },
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

describe('TelegramSelfServiceProvisioner.register (v2, phone-based account linking)', () => {
  const phoneMatch = (over: Partial<PhoneMatchAccount> = {}): PhoneMatchAccount => ({
    id: 'acct-existing',
    displayName: 'Existing Name',
    status: 'active',
    quotaLimitBytes: 20_000_000_000,
    telegramId: null,
    ...over,
  });

  it('links to a lone unclaimed phone match: sets telegram id, no new account, no config when it already has one', async () => {
    const { deps, captured } = makeDeps({
      findLiveAccountsByPhone: async () => [phoneMatch()],
      findPrimaryVlessConfigId: async () => 'cfg-existing', // account already has a config
    });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.register({
      telegramId: '600',
      telegramUsername: 'hani',
      displayName: 'Typed Name',
      phone: '989121234567',
    });

    assert.equal(result.created, false, 'no new account minted');
    assert.equal(result.linked, true, 'flagged as a link to the existing account');
    assert.equal(result.account.id, 'acct-existing');
    assert.equal(captured.createAccount, 0, 'no createAccount on a link');
    assert.equal(captured.linkCalls, 1);
    assert.equal(captured.lastLinkInput?.telegramId, '600');
    assert.equal(captured.lastLinkInput?.displayName, 'Typed Name');
    assert.equal(captured.createNamedVlessConfig, 0, 'existing config is not duplicated');
    assert.equal(result.entryLink, 'vless://link');
    assert.equal(captured.attributeCalls, 0, 'linking never runs referral crediting');
  });

  it('issues a named config on link only when the matched account has none', async () => {
    const { deps, captured } = makeDeps({
      findLiveAccountsByPhone: async () => [phoneMatch()],
      findPrimaryVlessConfigId: async () => null, // no existing config
    });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.register({
      telegramId: '601',
      displayName: 'Typed Name',
      phone: '989121234567',
    });

    assert.equal(result.linked, true);
    assert.equal(captured.createNamedVlessConfig, 1, 'a config is issued when missing');
    // Label derives from the kept (existing) display name + phone.
    assert.equal(captured.lastConfigLabel, 'ExistingName-09121234567');
    assert.equal(result.configLabel, 'ExistingName-09121234567');
  });

  it('links when the lone match already carries the SAME telegram id (idempotent)', async () => {
    const { deps, captured } = makeDeps({
      findLiveAccountsByPhone: async () => [phoneMatch({ telegramId: '602' })],
      findPrimaryVlessConfigId: async () => 'cfg-existing',
    });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.register({ telegramId: '602', displayName: 'X', phone: '989121234567' });

    assert.equal(result.linked, true);
    assert.equal(captured.linkCalls, 1);
    assert.equal(captured.createAccount, 0);
    assert.equal(captured.phoneEvents.length, 0);
  });

  it('does NOT hijack a phone match owned by a different telegram id: new account + conflict audit', async () => {
    const { deps, captured } = makeDeps({
      findLiveAccountsByPhone: async () => [phoneMatch({ id: 'acct-someone-else', telegramId: '999' })],
    });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.register({
      telegramId: '700',
      displayName: 'Hani',
      phone: '989121234567',
    });

    assert.equal(result.created, true, 'a fresh account is created instead of hijacking');
    assert.equal(result.linked, false);
    assert.equal(result.account.id, 'acct-new');
    assert.equal(captured.linkCalls, 0, 'no link onto someone else’s account');
    assert.equal(captured.phoneEvents.length, 1);
    assert.equal(captured.phoneEvents[0].event, 'phone_conflict');
    assert.deepEqual(captured.phoneEvents[0].matchedAccountIds, ['acct-someone-else']);
  });

  it('handles multiple phone matches as ambiguous: new account + ambiguous audit, no link', async () => {
    const { deps, captured } = makeDeps({
      findLiveAccountsByPhone: async () => [
        phoneMatch({ id: 'acct-a' }),
        phoneMatch({ id: 'acct-b' }),
      ],
    });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.register({
      telegramId: '800',
      displayName: 'Hani',
      phone: '989121234567',
    });

    assert.equal(result.created, true);
    assert.equal(result.linked, false);
    assert.equal(captured.linkCalls, 0);
    assert.equal(captured.phoneEvents.length, 1);
    assert.equal(captured.phoneEvents[0].event, 'phone_ambiguous');
    assert.deepEqual(captured.phoneEvents[0].matchedAccountIds, ['acct-a', 'acct-b']);
  });

  it('no phone match → creates the 0 GB account exactly as before (unchanged)', async () => {
    const { deps, captured } = makeDeps({ findLiveAccountsByPhone: async () => [] });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.register({
      telegramId: '900',
      displayName: 'Hani',
      phone: '989121234567',
    });

    assert.equal(result.created, true);
    assert.equal(result.linked, false);
    assert.equal(result.account.quotaLimitBytes, 0);
    assert.equal(captured.linkCalls, 0);
    assert.equal(captured.phoneEvents.length, 0);
  });
});
