/**
 * BillingService.getTelegramBotAccountStatus (the bot's account resolver) through
 * the REAL service (bundled with esbuild). The @username fallback must never
 * resolve an account that is bound to a DIFFERENT Telegram id: usernames are
 * mutable and re-claimable, so that would expose another customer's configs and
 * balance to whoever holds the username now.
 *
 * The fake database applies the SQL's own bound parameters to an in-memory table:
 * it honours the unbound-only guard only when the query actually carries it.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { bundledSkipReason, loadBundled } from './helpers/load-bundled.ts';

type Service = { getTelegramBotAccountStatus(input: { telegramId?: string | null; telegramUsername?: string | null }): Promise<{ status: string; account?: { id: string } }> };
type Ctor = new (...deps: unknown[]) => Service;
let BillingService: Ctor | null = null;

interface Row {
  id: string;
  telegramId: string | null;
  telegramUsername: string | null;
  deletedAt: string | null;
}

const UNBOUND_GUARD = /\$2::text IS NULL OR ca\.telegram_id IS NULL OR ca\.telegram_id = ''/;

function harness(rows: Row[]) {
  const database = {
    async query(text: string, values: unknown[] = []) {
      const live = rows.filter((row) => row.deletedAt === null);
      let matched: Row[];
      if (/WHERE ca\.telegram_id = \$1/.test(text)) {
        matched = live.filter((row) => row.telegramId === values[0]);
      } else if (/lower\(ca\.telegram_username\) = lower\(\$1\)/.test(text)) {
        const username = String(values[0]).toLowerCase();
        const requesterId = (values[1] as string | null | undefined) ?? null;
        matched = live.filter((row) => row.telegramUsername?.toLowerCase() === username);
        if (UNBOUND_GUARD.test(text) && requesterId !== null) matched = matched.filter((row) => !row.telegramId);
      } else {
        throw new Error(`unexpected SQL: ${text.slice(0, 120)}`);
      }
      const mapped = matched.map((row) => ({ id: row.id, displayName: row.id, status: 'active', usedBytes: '0', quotaLimitBytes: null }));
      return { rows: mapped, rowCount: mapped.length };
    },
  };
  return new BillingService!(database, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
}

describe('getTelegramBotAccountStatus @username fallback', { skip: bundledSkipReason }, () => {
  before(() => {
    BillingService = loadBundled<{ BillingService: Ctor }>('billing/billing.service.ts', { quiet: true }).BillingService;
  });

  it('does not resolve an account bound to a different Telegram id by a re-claimed username', async () => {
    const service = harness([{ id: 'acct-victim', telegramId: '111', telegramUsername: 'bob', deletedAt: null }]);
    const lookup = await service.getTelegramBotAccountStatus({ telegramId: '222', telegramUsername: 'bob' });
    assert.equal(lookup.status, 'not_found');
  });

  it('still resolves an operator-created account that only has the username (no Telegram id yet)', async () => {
    const service = harness([{ id: 'acct-unbound', telegramId: null, telegramUsername: 'Bob', deletedAt: null }]);
    const lookup = await service.getTelegramBotAccountStatus({ telegramId: '222', telegramUsername: 'bob' });
    assert.equal(lookup.status, 'found');
    assert.equal(lookup.account?.id, 'acct-unbound');
  });

  it('prefers the Telegram id match', async () => {
    const service = harness([
      { id: 'acct-own', telegramId: '222', telegramUsername: 'someone', deletedAt: null },
      { id: 'acct-unbound', telegramId: null, telegramUsername: 'bob', deletedAt: null },
    ]);
    const lookup = await service.getTelegramBotAccountStatus({ telegramId: '222', telegramUsername: 'bob' });
    assert.equal(lookup.account?.id, 'acct-own');
  });
});
