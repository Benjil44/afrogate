import type { DatabaseQueryExecutor } from '../database/database.service';
import { isTelegramLanguage, type TelegramLanguage } from './telegram-i18n';

/**
 * Per-Telegram-user persistence (language + in-progress flow state), independent
 * of whether the user has a customer account yet. Language is chosen at first
 * /start, before the account exists, so it lives here rather than on the account.
 */

/**
 * The only session-like state (docs §5): the in-progress card-to-card charge.
 * Navigation itself is stateless (every callback fully identifies its screen).
 * Derived `awaiting_receipt` ⇔ pendingPackageId set AND pendingStartedAt within
 * the 24h TTL. Stored in the `state` jsonb column (schema unchanged).
 */
export interface TelegramUserState {
  pendingPackageId?: string;
  pendingAmountMinor?: number;
  pendingCurrency?: string;
  /** ISO timestamp when the charge was started (for the 24h AWAITING_RECEIPT_TTL). */
  pendingStartedAt?: string;
  // --- v2 registration (docs §13) — registration and a pending charge never coexist ---
  /** Registration progress; absent = not registering. */
  regStage?: 'awaiting_name' | 'awaiting_phone';
  /** The name captured at R1, held until account creation. */
  regName?: string;
  /** Invite code captured from the /start deep-link payload, held until account creation. */
  referralCode?: string;
  // --- Connect / sync my account (docs §15) — set while awaiting the shared contact ---
  /**
   * True while an already-registered user is going through "Connect / sync my
   * account": the next self-verified contact triggers the connect/merge branch
   * (not first-time registration). Cleared on completion or when a slash command
   * escapes the flow. Mutually exclusive with regStage (a connect user already has
   * an account, so is never mid-registration).
   */
  connectStage?: boolean;
  // --- Seller flows (Phase 5) — stored on the SAME telegram_id row a seller
  // uses, but never coexist with the customer fields above: role resolution
  // (findSeller) decides customer vs seller BEFORE state is ever read, so a
  // given identity is always routed to exactly one side. ---
  /** "⚡ Charge account": which step. Absent = not in this flow. */
  sellerChargeStage?: 'pick_package' | 'confirm';
  /** The customer chosen in step 1, held through package pick + confirm. */
  sellerChargeCustomerId?: string;
  /** The package chosen in step 2, held until confirm. */
  sellerChargePackageId?: string;
  /** Generated once entering 'confirm', so a double-tap can't double-charge (idempotency key). */
  sellerChargeIdempotencyKey?: string;
  /** "➕ New customer": which step. */
  sellerNewCustomerStage?: 'awaiting_name' | 'pick_package' | 'confirm';
  /** The name typed in step 1, held until package selection + confirm. */
  sellerNewCustomerName?: string;
  sellerNewCustomerPackageId?: string;
  sellerNewCustomerIdempotencyKey?: string;
  // --- Superadmin flows — same mutual-exclusion reasoning as the seller block
  // above: role resolution (findAdmin) runs BEFORE state is read, so an admin
  // identity is never routed into the customer or seller state machines. ---
  /** "➕ New user": which step. Absent = not in this flow. */
  adminNewUserStage?: 'awaiting_name' | 'pick_package' | 'confirm';
  /** The name typed in step 1, held until package selection + confirm. */
  adminNewUserName?: string;
  adminNewUserPackageId?: string;
}

export interface TelegramUserRecord {
  telegramId: string;
  chatId: string | null;
  /** null → the user has not picked a language yet (show S0 on next contact). */
  language: TelegramLanguage | null;
  state: TelegramUserState | null;
}

interface TelegramUserRow {
  telegramId: string;
  chatId: string | null;
  language: string | null;
  state: TelegramUserState | null;
}

function mapRow(row: TelegramUserRow | undefined): TelegramUserRecord | null {
  if (!row) return null;
  return {
    telegramId: row.telegramId,
    chatId: row.chatId,
    language: isTelegramLanguage(row.language) ? row.language : null,
    state: row.state ?? null,
  };
}

const SELECT = `
  SELECT telegram_id AS "telegramId", chat_id AS "chatId", language, state
  FROM telegram_users
`;

/** Read a user record by telegram_id, or null if unseen. */
export async function getTelegramUser(
  executor: DatabaseQueryExecutor,
  telegramId: string,
): Promise<TelegramUserRecord | null> {
  const result = await executor.query<TelegramUserRow>(
    `${SELECT}
     WHERE telegram_id = $1`,
    [telegramId],
  );
  return mapRow(result.rows[0]);
}

/**
 * Upsert a user's language (and refresh chat_id). Used on first /start when the
 * user picks a language, and whenever they change it later.
 */
export async function setTelegramUserLanguage(
  executor: DatabaseQueryExecutor,
  input: { telegramId: string; chatId: string | null; language: TelegramLanguage },
): Promise<void> {
  await executor.query(
    `
      INSERT INTO telegram_users (telegram_id, chat_id, language)
      VALUES ($1, $2, $3)
      ON CONFLICT (telegram_id)
      DO UPDATE SET chat_id = COALESCE(excluded.chat_id, telegram_users.chat_id),
                    language = excluded.language,
                    updated_at = now()
    `,
    [input.telegramId, input.chatId, input.language],
  );
}

/** Merge/replace the in-progress flow state for a user (chat_id refreshed). */
export async function setTelegramUserState(
  executor: DatabaseQueryExecutor,
  input: { telegramId: string; chatId: string | null; state: TelegramUserState | null },
): Promise<void> {
  await executor.query(
    `
      INSERT INTO telegram_users (telegram_id, chat_id, state)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (telegram_id)
      DO UPDATE SET chat_id = COALESCE(excluded.chat_id, telegram_users.chat_id),
                    state = excluded.state,
                    updated_at = now()
    `,
    [input.telegramId, input.chatId, input.state === null ? null : JSON.stringify(input.state)],
  );
}
