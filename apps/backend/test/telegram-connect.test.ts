import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TelegramConnectResolver,
  resolveConnectDecision,
  type ConnectDeps,
} from '../src/telegram/telegram-connect.ts';
import type { PhoneMatchAccount } from '../src/telegram/telegram-self-service.ts';

const CURRENT = 'acct-bot-current';
const PHONE = '989121234567';
const TG = '600';

interface Captured {
  merges: Array<{ sourceId: string; targetId: string }>;
  syncs: Array<{ accountId: string; phone: string; displayName: string }>;
}

function makeDeps(matches: PhoneMatchAccount[]): { deps: ConnectDeps; captured: Captured } {
  const captured: Captured = { merges: [], syncs: [] };
  const deps: ConnectDeps = {
    findLiveAccountsByPhone: async () => matches,
    mergeIntoAccount: async (sourceId, targetId) => {
      captured.merges.push({ sourceId, targetId });
    },
    syncAccountContact: async (accountId, phone, displayName) => {
      captured.syncs.push({ accountId, phone, displayName });
    },
  };
  return { deps, captured };
}

const match = (over: Partial<PhoneMatchAccount> = {}): PhoneMatchAccount => ({
  id: 'acct-real',
  displayName: 'Real Account',
  status: 'active',
  quotaLimitBytes: 20_000_000_000,
  telegramId: null,
  ...over,
});

/** The current bot account itself matches the phone it registered with. */
const currentMatch = (): PhoneMatchAccount => match({ id: CURRENT, telegramId: TG });

const run = (deps: ConnectDeps) =>
  new TelegramConnectResolver(deps).connect({ currentAccountId: CURRENT, telegramId: TG, phone: PHONE, displayName: 'Hani' });

describe('TelegramConnectResolver.connect (merge branch rules)', () => {
  it('single unclaimed DIFFERENT match → merges current INTO target, no phone sync', async () => {
    const { deps, captured } = makeDeps([match({ id: 'acct-real', telegramId: null })]);
    const outcome = await run(deps);

    assert.deepEqual(outcome, { kind: 'merged', targetId: 'acct-real' });
    assert.equal(captured.merges.length, 1);
    assert.deepEqual(captured.merges[0], { sourceId: CURRENT, targetId: 'acct-real' });
    assert.equal(captured.syncs.length, 0, 'a merge never runs a phone sync');
  });

  it('current bot account ALSO matches the phone (realistic) → still merges into the OTHER account', async () => {
    // findCustomerAccountByPhone returns BOTH the current bot account and the real
    // account, because the bot account was created with this same phone. The current
    // account must be excluded so the real account is the merge target.
    const { deps, captured } = makeDeps([currentMatch(), match({ id: 'acct-real', telegramId: null })]);
    const outcome = await run(deps);

    assert.deepEqual(outcome, { kind: 'merged', targetId: 'acct-real' });
    assert.deepEqual(captured.merges[0], { sourceId: CURRENT, targetId: 'acct-real' });
  });

  it('the only match IS the current account → already synced, info saved, no merge', async () => {
    const { deps, captured } = makeDeps([currentMatch()]);
    const outcome = await run(deps);

    assert.deepEqual(outcome, { kind: 'alreadySynced', accountId: CURRENT });
    assert.equal(captured.merges.length, 0, 'nothing to merge');
    assert.equal(captured.syncs.length, 1);
    assert.deepEqual(captured.syncs[0], { accountId: CURRENT, phone: PHONE, displayName: 'Hani' });
  });

  it('lone match owned by a DIFFERENT telegram id → refused (ownedByOther), no change', async () => {
    const { deps, captured } = makeDeps([match({ id: 'acct-someone-else', telegramId: '999' })]);
    const outcome = await run(deps);

    assert.deepEqual(outcome, { kind: 'ownedByOther' });
    assert.equal(captured.merges.length, 0, 'never hijack someone else’s account');
    assert.equal(captured.syncs.length, 0);
  });

  it('multiple OTHER matches → refused (ambiguous), no change', async () => {
    const { deps, captured } = makeDeps([match({ id: 'acct-a' }), match({ id: 'acct-b' })]);
    const outcome = await run(deps);

    assert.deepEqual(outcome, { kind: 'ambiguous' });
    assert.equal(captured.merges.length, 0);
    assert.equal(captured.syncs.length, 0);
  });

  it('no match at all → phone synced onto the current account, no merge', async () => {
    const { deps, captured } = makeDeps([]);
    const outcome = await run(deps);

    assert.deepEqual(outcome, { kind: 'noMatch' });
    assert.equal(captured.merges.length, 0);
    assert.equal(captured.syncs.length, 1);
    assert.deepEqual(captured.syncs[0], { accountId: CURRENT, phone: PHONE, displayName: 'Hani' });
  });
});

describe('resolveConnectDecision (pure)', () => {
  it('excludes the current account, then picks the lone unclaimed other as merge target', () => {
    const decision = resolveConnectDecision(CURRENT, TG, [currentMatch(), match({ id: 'acct-real', telegramId: null })]);
    assert.deepEqual(decision, { kind: 'merge', sourceId: CURRENT, targetId: 'acct-real' });
  });

  it('treats a lone match already carrying THIS telegram id as mergeable (not owned-by-other)', () => {
    const decision = resolveConnectDecision(CURRENT, TG, [match({ id: 'acct-real', telegramId: TG })]);
    assert.deepEqual(decision, { kind: 'merge', sourceId: CURRENT, targetId: 'acct-real' });
  });

  it('empty match set → noMatch', () => {
    assert.deepEqual(resolveConnectDecision(CURRENT, TG, []), { kind: 'noMatch' });
  });
});
