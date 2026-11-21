/**
 * Self-serve REGISTRATION for the afroWS bot (v2 — docs telegram-bot-flow-design.md
 * §§9–13). Replaces the v1 "instant 1 GB trial": signup now creates an account
 * with **0 GB**, the display name the user typed, their shared phone (stored in
 * clear), a VLESS config **named after the user** (label `Name-0912…`), a unique
 * referral code, and — if the user arrived via an invite link — a write-once
 * referral attribution plus the inviter's signup bonus.
 *
 * The module stays "pure-ish": it owns the idempotency + ordering logic and
 * delegates all persistence to injected collaborators, so the flow is
 * unit-testable with fakes and account/config creation stays DRY.
 *
 * Idempotency: at most one account per telegram_id. A pre-check short-circuits a
 * repeated registration; a unique-violation on the concurrent race (partial
 * unique index on customer_accounts.telegram_id) is caught and resolved by
 * re-reading the winning row, so a double submit never mints a second account.
 */

export interface SelfServiceAccount {
  id: string;
  displayName?: string | null;
  status: string;
  quotaLimitBytes?: number | null;
  telegramId?: string | null;
}

/** A live (deleted_at IS NULL) account matched by phone during registration. */
export interface PhoneMatchAccount {
  id: string;
  displayName?: string | null;
  status: string;
  quotaLimitBytes?: number | null;
  /** null/'' → unclaimed and linkable; a value → already bound to a Telegram user. */
  telegramId?: string | null;
}

/**
 * A registration anomaly worth an audit trail (never blocks onboarding).
 * `archived_link_released`: an ARCHIVED (soft-deleted) account still held this
 * telegram_id, so the id was released from it before re-registering.
 * `username_held`: a live account bound to another id carries the sender's
 * @username (a stale telegram_id on their paid account, or a recycled username);
 * the sender still signs up and support can merge the two.
 */
export type PhoneRegistrationEvent = 'phone_conflict' | 'phone_ambiguous' | 'archived_link_released' | 'username_held';

/** Result of crediting an inviter when a referred user completes registration (N3/N5). */
export interface ReferralAttribution {
  inviterAccountId: string;
  inviterTelegramId: string | null;
  inviterTelegramChatId: string | null;
  /** The referred user's entered display name (shown to the inviter in N3). */
  friendName: string;
  signupGems: number;
  inviterGemsBalance: number;
  milestone: { count: number; bonusGems: number; inviterGemsBalance: number } | null;
}

export interface RegisterInput {
  telegramId: string;
  telegramUsername?: string | null;
  telegramChatId?: string | null;
  /** The name the user typed at R1 — becomes display_name and seeds the config label. */
  displayName: string;
  /** E.164 digits from the shared contact — stored in clear, seeds the config label. */
  phone: string;
  /** Invite code captured from the /start deep-link, if any (attributed once). */
  referralCode?: string | null;
  /**
   * Referral DATA reward size in decimal bytes (0 = disabled). When > 0 the data
   * reward (paid on the invitee's first paid top-up) REPLACES the gem signup bonus,
   * so signup credits NO gems here — but referred_by is still attributed (write-once)
   * so the data reward can find the inviter later. Defaults to 0 (gem behavior).
   */
  referralRewardBytes?: number;
}

export interface RegisterResult {
  account: SelfServiceAccount;
  entryLink: string | null;
  configLabel: string | null;
  /** true only when a brand-new 0 GB account was minted. */
  created: boolean;
  /** true when the Telegram id was linked onto a pre-existing account (no new account). */
  linked: boolean;
  referral: ReferralAttribution | null;
}

export interface LinkAccountByPhoneInput {
  accountId: string;
  telegramId: string;
  telegramUsername: string | null;
  phone: string;
  /** The name typed at R1 — stored only if the matched account had no display name. */
  displayName: string;
}

export interface TelegramSelfServiceDeps {
  /** Find an existing (non-deleted) customer account linked to this telegram_id. */
  findAccountByTelegramId(telegramId: string): Promise<SelfServiceAccount | null>;
  /** Live accounts whose stored phone / paid_number_hash matches this phone. */
  findLiveAccountsByPhone(phone: string): Promise<PhoneMatchAccount[]>;
  /**
   * Link a Telegram identity onto a matched account (set telegram_id/username,
   * keep an existing display_name/phone/referral_code else fill it), in one
   * transaction. Returns the updated account.
   */
  linkAccountByPhone(input: LinkAccountByPhoneInput): Promise<SelfServiceAccount>;
  /** Best-effort audit of a phone conflict/ambiguity (must never block onboarding). */
  recordPhoneRegistrationEvent(
    event: PhoneRegistrationEvent,
    input: { telegramId: string; matchedAccountIds: string[] },
  ): Promise<void>;
  /** Generate a referral code not already used by any account. */
  generateReferralCode(): Promise<string>;
  /** Create a customer account (active, 0 GB, named, with phone + referral code). */
  createAccount(input: {
    telegramId: string;
    telegramUsername: string | null;
    displayName: string;
    phone: string;
    quotaLimitBytes: number;
    referralCode: string;
  }): Promise<SelfServiceAccount>;
  /** Create the default VLESS client config with the user-derived label. Returns its id. */
  createNamedVlessConfig(customerAccountId: string, label: string): Promise<{ id: string }>;
  /** Best-effort VLESS entry link for a client config id. */
  getEntryLink(clientConfigId: string): Promise<string | null>;
  /** Best-effort primary VLESS client config id for an existing account. */
  findPrimaryVlessConfigId(customerAccountId: string): Promise<string | null>;
  /**
   * Attribute the referral (write-once) and, when `creditGems` is true, credit the
   * inviter's signup bonus + milestone. When `creditGems` is false (the DATA reward
   * is active) the inviter is still attributed (referred_by is set write-once) but
   * NO gems are credited — the data reward pays on the invitee's first paid top-up.
   */
  attributeAndCreditReferral(input: {
    newAccountId: string;
    code: string;
    friendName: string;
    creditGems: boolean;
  }): Promise<ReferralAttribution | null>;
  /** Build the ASCII, auto-pattern-safe config label from the name + phone (§11 R2). */
  buildConfigLabel(displayName: string, phone: string): string;
  /**
   * Clear telegram_id/telegram_username on ARCHIVED (deleted_at set) accounts that
   * still hold this telegram id; returns the released account ids. Archiving keeps
   * the link (for restore), but the unique index on customer_accounts.telegram_id
   * ignores deleted_at, so without this a deleted customer could never sign up
   * again: every attempt hit a duplicate key and looped on the generic error.
   */
  releaseArchivedTelegramLink(telegramId: string): Promise<string[]>;
}

/**
 * A duplicate-key outcome: the raw Postgres 23505, or the Nest ConflictException
 * (HTTP 409) that BillingService.createCustomerAccount converts it into. Only used
 * for the concurrent-registration race (re-read the live winner), never to decide
 * anything destructive.
 */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && (error as { code: unknown }).code === '23505') return true;
  return (error as { getStatus?: () => number }).getStatus?.() === 409;
}

export class TelegramSelfServiceProvisioner {
  private readonly deps: TelegramSelfServiceDeps;

  constructor(deps: TelegramSelfServiceDeps) {
    this.deps = deps;
  }

  /**
   * Register (idempotent per telegram_id):
   *  1. Known telegram_id → return that account (no second account, no referral).
   *  2. Phone matches exactly one unclaimed live account → LINK the telegram id
   *     onto it and return it (no new account, no referral, config issued only if
   *     missing).
   *  3. Phone matches one account already bound to a DIFFERENT telegram id, or
   *     several accounts → do not touch them; audit and create a fresh account.
   *  4. No phone match → create the 0 GB account, a named VLESS config, and (when a
   *     referral code was captured) attribute + credit the inviter.
   */
  async register(input: RegisterInput): Promise<RegisterResult> {
    const existing = await this.deps.findAccountByTelegramId(input.telegramId);
    if (existing) return this.resolveExisting(existing);

    // No LIVE account holds this telegram id. An ARCHIVED one may still: archiving
    // keeps the link, and the unique index ignores deleted_at, so creating/linking
    // would always fail. Release it up front (only archived rows, only this id).
    await this.releaseArchivedLink(input.telegramId);

    try {
      const linked = await this.tryLinkByPhone(input);
      if (linked) return linked;
      return await this.createNewAccount(input);
    } catch (error) {
      // Lost the race: another registration already claimed the telegram id (via a
      // concurrent create OR link). Re-read and return the winner rather than
      // surfacing a duplicate-key error.
      if (isUniqueViolation(error)) {
        const raced = await this.deps.findAccountByTelegramId(input.telegramId);
        if (raced) return this.resolveExisting(raced);
      }
      throw error;
    }
  }

  private async releaseArchivedLink(telegramId: string): Promise<void> {
    if (!telegramId) return;
    const released = await this.deps.releaseArchivedTelegramLink(telegramId);
    if (!released.length) return;
    await this.deps.recordPhoneRegistrationEvent('archived_link_released', {
      telegramId,
      matchedAccountIds: released,
    });
  }

  /**
   * Phone-based account linking. Returns a link result when exactly one live,
   * unclaimed (or same-telegram-id) account matches the phone; otherwise null so
   * the caller creates a fresh account. Conflicts/ambiguity are audited.
   */
  private async tryLinkByPhone(input: RegisterInput): Promise<RegisterResult | null> {
    const matches = await this.deps.findLiveAccountsByPhone(input.phone);
    if (matches.length === 0) return null;

    if (matches.length > 1) {
      // Ambiguous: several live accounts share this phone — never guess. Create a
      // fresh account, but leave an audit trail so support can merge them.
      await this.deps.recordPhoneRegistrationEvent('phone_ambiguous', {
        telegramId: input.telegramId,
        matchedAccountIds: matches.map((match) => match.id),
      });
      return null;
    }

    const match = matches[0];
    const claimedByAnother =
      Boolean(match.telegramId) && match.telegramId !== input.telegramId;
    if (claimedByAnother) {
      // The one match belongs to someone else — do NOT hijack it. Create a fresh
      // account (audited) so this user still gets onboarded.
      await this.deps.recordPhoneRegistrationEvent('phone_conflict', {
        telegramId: input.telegramId,
        matchedAccountIds: [match.id],
      });
      return null;
    }

    // LINK: bind the telegram id onto the matched account (keeps its display name /
    // phone / referral code if already set), then issue a named VLESS config only
    // when the account has none.
    const account = await this.deps.linkAccountByPhone({
      accountId: match.id,
      telegramId: input.telegramId,
      telegramUsername: input.telegramUsername ?? null,
      phone: input.phone,
      displayName: input.displayName,
    });

    let configLabel: string | null = account.displayName ?? null;
    let configId = await this.deps.findPrimaryVlessConfigId(account.id);
    if (!configId) {
      configLabel = this.deps.buildConfigLabel(account.displayName ?? input.displayName, input.phone);
      const config = await this.deps.createNamedVlessConfig(account.id, configLabel);
      configId = config.id;
    }
    const entryLink = configId ? await this.deps.getEntryLink(configId) : null;

    return { account, entryLink, configLabel, created: false, linked: true, referral: null };
  }

  private async createNewAccount(input: RegisterInput): Promise<RegisterResult> {
    const referralCode = await this.deps.generateReferralCode();
    const configLabel = this.deps.buildConfigLabel(input.displayName, input.phone);
    const account = await this.deps.createAccount({
      telegramId: input.telegramId,
      telegramUsername: input.telegramUsername ?? null,
      displayName: input.displayName,
      phone: input.phone,
      quotaLimitBytes: 0,
      referralCode,
    });
    const config = await this.deps.createNamedVlessConfig(account.id, configLabel);
    const entryLink = await this.deps.getEntryLink(config.id);

    let referral: ReferralAttribution | null = null;
    if (input.referralCode) {
      // When the DATA reward is active, skip the gem signup bonus but STILL attribute
      // referred_by (write-once) so the data reward can find the inviter on the first
      // paid top-up. A bad/self/duplicate code returns null — never blocks onboarding.
      const creditGems = !((input.referralRewardBytes ?? 0) > 0);
      const outcome = await this.deps.attributeAndCreditReferral({
        newAccountId: account.id,
        code: input.referralCode,
        friendName: input.displayName,
        creditGems,
      });
      // Surface the attribution to the caller (for the N3 gem push) only when gems
      // were actually credited; with the data reward active there is no signup push.
      referral = creditGems ? outcome : null;
    }

    return { account, entryLink, configLabel, created: true, linked: false, referral };
  }

  private async resolveExisting(account: SelfServiceAccount): Promise<RegisterResult> {
    const configId = await this.deps.findPrimaryVlessConfigId(account.id);
    const entryLink = configId ? await this.deps.getEntryLink(configId) : null;
    return {
      account,
      entryLink,
      configLabel: account.displayName ?? null,
      created: false,
      linked: false,
      referral: null,
    };
  }
}
