import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
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
  lastAttributeInput: Parameters<TelegramSelfServiceDeps['attributeAndCreditReferral']>[0] | null;
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
    lastAttributeInput: null,
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
    attributeAndCreditReferral: async (input) => {
      captured.attributeCalls += 1;
      captured.lastAttributeInput = input;
      return null;
    },
    buildConfigLabel: (name, phone) => buildConfigLabel(name, phone),
    releaseArchivedTelegramLink: async () => [],
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
    const { deps, captured } = makeDeps({
      attributeAndCreditReferral: async (input) => {
        captured.attributeCalls += 1;
        captured.lastAttributeInput = input;
        return attribution;
      },
    });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.register({
      telegramId: '888',
      displayName: 'Hani',
      phone: '989121234567',
      referralCode: 'FRIEND22',
    });

    assert.equal(captured.attributeCalls, 1);
    assert.equal(captured.lastAttributeInput?.creditGems, true, 'gems are credited when the data reward is off');
    assert.equal(result.referral?.inviterAccountId, 'inviter-1');
    assert.equal(result.referral?.signupGems, 50);
  });

  it('skips the signup gem bonus (creditGems=false, no gem push) but STILL attributes referred_by when the data reward is active', async () => {
    const attribution: ReferralAttribution = {
      inviterAccountId: 'inviter-1',
      inviterTelegramId: '999',
      inviterTelegramChatId: 'chat-inv',
      friendName: 'Hani',
      signupGems: 0,
      inviterGemsBalance: 0,
      milestone: null,
    };
    const { deps, captured } = makeDeps({
      attributeAndCreditReferral: async (input) => {
        captured.attributeCalls += 1;
        captured.lastAttributeInput = input;
        return attribution;
      },
    });
    const provisioner = new TelegramSelfServiceProvisioner(deps);

    const result = await provisioner.register({
      telegramId: '889',
      displayName: 'Hani',
      phone: '989121234567',
      referralCode: 'FRIEND22',
      referralRewardBytes: 1_500_000_000,
    });

    // Attribution (referred_by write-once) still runs, so the data reward can find
    // the inviter on the first paid top-up...
    assert.equal(captured.attributeCalls, 1, 'referred_by is still attributed');
    assert.equal(captured.lastAttributeInput?.creditGems, false, 'but no signup gems are credited');
    // ...and the gem N3 push is suppressed (no referral surfaced to the caller).
    assert.equal(result.referral, null);
    assert.equal(result.created, true);
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

describe('TelegramSelfServiceProvisioner.register (archived account still holds the telegram id)', () => {
  // Production shape: BillingService.createCustomerAccount turns the 23505 into a
  // Nest ConflictException (no `.code`), so the fix must not depend on the error type.
  const telegramIdConflict = () => new ConflictException('Customer account Telegram ID or paid number already exists');

  it('releases the archived link BEFORE creating, so a deleted customer can sign up again', async () => {
    let holder: 'archived' | 'released' = 'archived';
    const order: string[] = [];
    const { deps, captured } = makeDeps({
      // getTelegramBotAccountStatus filters deleted_at, so the archived holder is invisible here.
      findAccountByTelegramId: async () => null,
      releaseArchivedTelegramLink: async (telegramId) => {
        order.push(`release:${telegramId}`);
        holder = 'released';
        return ['acct-archived'];
      },
      createAccount: async (input) => {
        order.push('create');
        captured.createAccount += 1;
        if (holder === 'archived') throw telegramIdConflict();
        return { id: 'acct-fresh', displayName: input.displayName, status: 'active', quotaLimitBytes: 0, telegramId: input.telegramId };
      },
    });
    const result = await new TelegramSelfServiceProvisioner(deps).register({ telegramId: '4242', displayName: 'پوریا', phone: '989121234567' });

    assert.equal(result.created, true);
    assert.equal(result.account.id, 'acct-fresh');
    assert.deepEqual(order, ['release:4242', 'create'], 'released up front, created once');
    assert.deepEqual(captured.phoneEvents, [{ event: 'archived_link_released', matchedAccountIds: ['acct-archived'] }]);
  });

  it('with nothing archived: no audit event, normal create', async () => {
    let releaseCalls = 0;
    const { deps, captured } = makeDeps({
      releaseArchivedTelegramLink: async () => {
        releaseCalls += 1;
        return [];
      },
    });
    const result = await new TelegramSelfServiceProvisioner(deps).register({ telegramId: '4243', displayName: 'smart', phone: '989121234567' });
    assert.equal(result.created, true);
    assert.equal(releaseCalls, 1);
    assert.deepEqual(captured.phoneEvents, []);
  });

  it('an unrelated conflict (e.g. referral code) is rethrown and never triggers a second release', async () => {
    let releaseCalls = 0;
    const { deps } = makeDeps({
      createAccount: async () => {
        throw new ConflictException('referral code already exists');
      },
      releaseArchivedTelegramLink: async () => {
        releaseCalls += 1;
        return [];
      },
    });
    await assert.rejects(
      new TelegramSelfServiceProvisioner(deps).register({ telegramId: '4244', displayName: 'smart', phone: '989121234567' }),
      ConflictException,
    );
    assert.equal(releaseCalls, 1, 'only the up-front release, nothing reacts to the error');
  });

  it('never touches archived links when a live account already holds the id', async () => {
    let releaseCalls = 0;
    const live: SelfServiceAccount = { id: 'acct-live', status: 'active', quotaLimitBytes: 0, telegramId: '4245' };
    const { deps } = makeDeps({
      findAccountByTelegramId: async () => live,
      releaseArchivedTelegramLink: async () => {
        releaseCalls += 1;
        return ['acct-archived'];
      },
    });
    const result = await new TelegramSelfServiceProvisioner(deps).register({ telegramId: '4245', displayName: 'smart', phone: '989121234567' });
    assert.equal(result.account.id, 'acct-live');
    assert.equal(releaseCalls, 0);
  });

  it('a concurrent-create race surfaced as a ConflictException resolves to the live winner', async () => {
    let calls = 0;
    const winner: SelfServiceAccount = { id: 'acct-win', status: 'active', quotaLimitBytes: 0, telegramId: '4246' };
    const { deps } = makeDeps({
      findAccountByTelegramId: async () => (calls++ === 0 ? null : winner),
      createAccount: async () => {
        throw telegramIdConflict();
      },
    });
    const result = await new TelegramSelfServiceProvisioner(deps).register({ telegramId: '4246', displayName: 'smart', phone: '989121234567' });
    assert.equal(result.account.id, 'acct-win');
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
