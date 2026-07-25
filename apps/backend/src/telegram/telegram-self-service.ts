/**
 * Instant self-serve account creation for the Telegram bot.
 *
 * This module is intentionally "pure-ish": it holds the idempotency + ordering
 * logic and delegates all persistence to injected collaborators (bound to the
 * existing billing internals — `createCustomerAccount`, `createClientConfig`,
 * `getClientConfigEntryLink`, and a telegram_id lookup). It never writes SQL of
 * its own, so account/config creation stays DRY and the flow is unit-testable
 * with fakes.
 *
 * Idempotency: an account is created at most once per telegram_id. A pre-check
 * short-circuits repeated /start, and a unique-violation on the concurrent race
 * (the DB has a partial unique index on customer_accounts.telegram_id) is caught
 * and resolved by re-reading the winning row — so double /start never mints a
 * second trial account.
 */

export interface SelfServiceAccount {
  id: string;
  displayName?: string | null;
  status: string;
  quotaLimitBytes?: number | null;
  telegramId?: string | null;
}

export interface TelegramSelfServiceDeps {
  /** Find an existing (non-deleted) customer account linked to this telegram_id. */
  findAccountByTelegramId(telegramId: string): Promise<SelfServiceAccount | null>;
  /** Create a customer account (active, VLESS trial, account_shared quota). */
  createAccount(input: {
    telegramId: string;
    telegramUsername: string | null;
    quotaLimitBytes: number;
  }): Promise<SelfServiceAccount>;
  /** Create the default VLESS client config for the account. Returns its id. */
  createVlessConfig(customerAccountId: string): Promise<{ id: string }>;
  /** Best-effort VLESS entry link for a client config id. */
  getEntryLink(clientConfigId: string): Promise<string | null>;
  /** Best-effort primary VLESS client config id for an existing account. */
  findPrimaryVlessConfigId(customerAccountId: string): Promise<string | null>;
}

export interface SelfServiceResult {
  account: SelfServiceAccount;
  entryLink: string | null;
  created: boolean;
}

/** Narrow an unknown error to a Postgres unique-constraint violation (23505). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  );
}

export class TelegramSelfServiceProvisioner {
  private readonly deps: TelegramSelfServiceDeps;

  constructor(deps: TelegramSelfServiceDeps) {
    this.deps = deps;
  }

  /**
   * Return the account linked to `telegramId` (idempotent), else create one with
   * the given trial quota (already resolved to a concrete byte count by the
   * caller) and a default VLESS config, returning its entry link.
   */
  async ensureAccount(
    input: { telegramId: string; telegramUsername?: string | null; telegramChatId?: string | null },
    trialQuotaBytes: number,
  ): Promise<SelfServiceResult> {
    const existing = await this.deps.findAccountByTelegramId(input.telegramId);
    if (existing) return this.resolveExisting(existing);

    try {
      const account = await this.deps.createAccount({
        telegramId: input.telegramId,
        telegramUsername: input.telegramUsername ?? null,
        quotaLimitBytes: trialQuotaBytes,
      });
      const config = await this.deps.createVlessConfig(account.id);
      const entryLink = await this.deps.getEntryLink(config.id);
      return { account, entryLink, created: true };
    } catch (error) {
      // Lost the race: another /start already created the account. Re-read and
      // return the winner rather than surfacing a duplicate-key error.
      if (isUniqueViolation(error)) {
        const raced = await this.deps.findAccountByTelegramId(input.telegramId);
        if (raced) return this.resolveExisting(raced);
      }
      throw error;
    }
  }

  private async resolveExisting(account: SelfServiceAccount): Promise<SelfServiceResult> {
    const configId = await this.deps.findPrimaryVlessConfigId(account.id);
    const entryLink = configId ? await this.deps.getEntryLink(configId) : null;
    return { account, entryLink, created: false };
  }
}
