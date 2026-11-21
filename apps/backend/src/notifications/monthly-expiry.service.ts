import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { numberFromBigInt } from '../billing/billing-math';
import { MONTHLY_REMINDER_LEAD_MS } from '../billing/monthly-period';
import { DatabaseService } from '../database/database.service';
import { applyRtlGuard, formatDataSize } from '../telegram/telegram-format';
import { isTelegramLanguage, renderTelegramCopy, type TelegramLanguage } from '../telegram/telegram-i18n';
import { TelegramAlertService, type TelegramInlineKeyboardMarkup } from './telegram-alert.service';
import { isPermanentTelegramFailure } from './low-quota-alert';

/** Audit actions; the (account, action, expiresAt) triple is the once-per-month dedupe key. */
export const MONTHLY_ACTION = {
  reminder: 'notify.month_ending',
  ended: 'notify.month_ended',
  forfeit: 'customer_account.month_forfeit',
} as const;
const TARGET_TYPE = 'customer_account';
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
/** A "month ended" notice older than this is not sent any more (e.g. after a long outage). */
const ENDED_NOTICE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_SENDS_PER_TICK = 25;

interface AccountRow {
  accountId: string;
  quotaLimitBytes: string | number | null;
  usedBytes: string | number | null;
  expiresAt: Date;
  chatId: string | null;
  language: string | null;
}

type Kind = 'reminder' | 'ended';

/**
 * Monthly GB validity (billing/monthly-period.ts), every 10 min:
 *  1. month ending within 24 h  -> "ends tomorrow, recharge" with a Buy button (once per month);
 *  2. month over                -> unused GB forfeited (quota cut to used, so the existing
 *     quota enforcement pauses the connection), audited;
 *  3. month over (≤ 3 days ago) -> "month ended, buy again" with a Buy button (once per month).
 * Only accounts with BOTH an end date and a finite quota take part: unlimited accounts and
 * accounts without an end date are never touched. Logs carry only account ids.
 * Config: AFROWS_MONTHLY_EXPIRY_ENABLED (default on).
 */
@Injectable()
export class MonthlyExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonthlyExpiryService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly telegram: TelegramAlertService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    const flag = (this.config.get<string>('AFROWS_MONTHLY_EXPIRY_ENABLED') ?? '').trim().toLowerCase();
    if (['0', 'false', 'off', 'no'].includes(flag)) return;
    this.timer = setInterval(() => void this.tick(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
    setTimeout(() => void this.tick(), 60_000).unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass. Never throws. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.forfeitEndedMonths();
      if (await this.telegram.isBotConfigured()) await this.sendNotices();
    } catch (error) {
      this.logger.warn(`Monthly expiry check failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  /** Cut the quota of every ended month to what was used (the unused GB is lost). */
  private async forfeitEndedMonths(): Promise<void> {
    const result = await this.database.query<{ accountId: string; forfeitedBytes: string; expiresAt: Date }>(
      `
        WITH ended AS (
          SELECT id, quota_limit_bytes - used_bytes AS forfeited
          FROM customer_accounts
          WHERE deleted_at IS NULL
            AND expires_at IS NOT NULL AND expires_at <= now()
            AND quota_limit_bytes IS NOT NULL AND quota_limit_bytes > used_bytes
        )
        UPDATE customer_accounts ca
        SET quota_limit_bytes = ca.used_bytes, updated_at = now()
        FROM ended
        WHERE ca.id = ended.id AND ca.quota_limit_bytes > ca.used_bytes
        RETURNING ca.id AS "accountId", ended.forfeited AS "forfeitedBytes", ca.expires_at AS "expiresAt"
      `,
    );
    for (const row of result.rows) {
      this.logger.log(`Month ended for account ${row.accountId}: ${row.forfeitedBytes} unused bytes forfeited`);
      await this.audit.recordBestEffort(undefined, MONTHLY_ACTION.forfeit, TARGET_TYPE, row.accountId, {
        forfeitedBytes: numberFromBigInt(row.forfeitedBytes) ?? 0,
        expiresAt: new Date(row.expiresAt).toISOString(),
      });
    }
  }

  private async sendNotices(): Promise<void> {
    const rows = await this.database.query<AccountRow>(
      `
        SELECT ca.id AS "accountId", ca.quota_limit_bytes AS "quotaLimitBytes", ca.used_bytes AS "usedBytes",
               ca.expires_at AS "expiresAt", tu.chat_id AS "chatId", tu.language
        FROM customer_accounts ca
        JOIN telegram_users tu ON tu.telegram_id = ca.telegram_id
        WHERE ca.deleted_at IS NULL
          AND ca.status = 'active'
          AND ca.quota_limit_bytes IS NOT NULL
          AND ca.expires_at IS NOT NULL
          AND ca.expires_at BETWEEN now() - make_interval(secs => $1) AND now() + make_interval(secs => $2)
          AND tu.chat_id IS NOT NULL AND tu.chat_id <> ''
      `,
      [ENDED_NOTICE_WINDOW_MS / 1000, MONTHLY_REMINDER_LEAD_MS / 1000],
    );
    if (!rows.rows.length) return;
    const sentKeys = await this.loadSentKeys(rows.rows.map((r) => r.accountId));
    const now = new Date();
    let sent = 0;
    for (const row of rows.rows) {
      if (sent >= MAX_SENDS_PER_TICK) break;
      const expiresAt = new Date(row.expiresAt);
      const state = { quotaLimitBytes: numberFromBigInt(row.quotaLimitBytes), usedBytes: numberFromBigInt(row.usedBytes) ?? 0, expiresAt };
      // C6 (0.128.0): the T-1d "ends tomorrow" reminder is RETIRED — the renewal ladder
      // owns the expiry rungs (T-3d/T-1d). This sweep keeps ONLY the post-expiry "ended"
      // notice (and the forfeiture sweep above).
      const kind: Kind | null = expiresAt.getTime() <= now.getTime() ? 'ended' : null;
      if (!kind || sentKeys.has(`${row.accountId}|${MONTHLY_ACTION[kind]}|${expiresAt.toISOString()}`)) continue;
      sent += 1;
      const remaining = Math.max(0, (state.quotaLimitBytes ?? 0) - state.usedBytes);
      if ((await this.deliver(row, kind, expiresAt, remaining)) === 'transient') break;
    }
  }

  private async loadSentKeys(accountIds: string[]): Promise<Set<string>> {
    const result = await this.database.query<{ accountId: string; action: string; expiresAt: string | null }>(
      `
        SELECT target_id AS "accountId", action, metadata->>'expiresAt' AS "expiresAt"
        FROM audit_logs
        WHERE target_type = $1 AND target_id = ANY($2::text[]) AND action = ANY($3::text[])
      `,
      [TARGET_TYPE, accountIds, [MONTHLY_ACTION.reminder, MONTHLY_ACTION.ended]],
    );
    return new Set(result.rows.filter((r) => r.expiresAt).map((r) => `${r.accountId}|${r.action}|${new Date(r.expiresAt!).toISOString()}`));
  }

  private async deliver(row: AccountRow, kind: Kind, expiresAt: Date, remainingBytes: number): Promise<'sent' | 'permanent' | 'transient'> {
    const language: TelegramLanguage = isTelegramLanguage(row.language) ? row.language : 'fa';
    const text = applyRtlGuard(
      kind === 'reminder'
        ? renderTelegramCopy('notify.monthEndingSoon', language, {}, { remaining: formatDataSize(remainingBytes, language) })
        : renderTelegramCopy('notify.monthEnded', language),
      language,
    );
    const result = await this.telegram.sendMessage(row.chatId!, text, {
      parseMode: 'HTML',
      disableWebPagePreview: true,
      replyMarkup: this.keyboard(language),
    });
    const permanent = result.status === 'failed' && isPermanentTelegramFailure(result.statusCode);
    if (result.status !== 'sent' && !permanent) {
      this.logger.warn(`Monthly ${kind} notice for account ${row.accountId} not delivered (${result.reason}); retrying next tick`);
      return 'transient';
    }
    await this.audit.recordBestEffort(undefined, MONTHLY_ACTION[kind], TARGET_TYPE, row.accountId, {
      expiresAt: expiresAt.toISOString(),
      remainingBytes,
      delivered: !permanent,
    });
    return permanent ? 'permanent' : 'sent';
  }

  private keyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: renderTelegramCopy('menu.btn.buy', language), callback_data: 'afws:buy' }],
        [{ text: renderTelegramCopy('menu.btn.account', language), callback_data: 'afws:acct' }],
      ],
    };
  }
}
