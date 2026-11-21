import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { numberFromBigInt } from '../billing/billing-math';
import { DatabaseService } from '../database/database.service';
import { applyRtlGuard } from '../telegram/telegram-format';
import { renderTelegramCopy } from '../telegram/telegram-i18n';
import { TelegramAlertService, type TelegramInlineKeyboardMarkup } from './telegram-alert.service';
import {
  USAGE_RECEIPT_ACTION,
  USAGE_RECEIPT_AUDIT_TARGET_TYPE,
  USAGE_RECEIPT_BTN_COPY,
  USAGE_RECEIPT_CHECK_INTERVAL_MS,
  buildUsageReceiptMessage,
  decideUsageReceipt,
  isPermanentTelegramFailure,
  parseCardToCard,
  resolveUsageReceiptEnabled,
  resolveUsageReceiptMinPlanBytes,
  resolveUsageReceiptPct,
  type UsageReceiptDecision,
  type UsageReceiptDelivery,
} from './usage-receipt';

interface CandidateRow {
  accountId: string;
  displayName: string | null;
  quotaLimitBytes: string | number | null;
  usedBytes: string | number | null;
  cycleStartUsedBytes: string | number | null;
  chatId: string;
}

interface DeliveryRow {
  accountId: string;
  quotaLimitBytes: string | null;
}

interface CardRow {
  cardToCardInfo: string | null;
}

/** Telegram allows ~30 msg/s; a small per-tick cap keeps a backlog (first rollout) gentle. */
const MAX_SENDS_PER_TICK = 25;

/**
 * Customer USAGE RECEIPT push ("you've passed 50% — renew by card") via the afroWS
 * bot. Policy in ./usage-receipt.ts; this class does I/O.
 *
 * Every 5 min: active, non-deleted, unexpired accounts on a plan >= MIN_PLAN with a
 * linked bot chat (customer_accounts.telegram_id -> telegram_users.chat_id) whose
 * usage has crossed the PCT threshold and who have not already been sent a receipt
 * for the current quota value. Requires a configured card (telegram_bot_settings.
 * card_to_card_info); without one the tick no-ops.
 *
 * Dedupe + restart safety: a delivered notice is an audit_logs row keyed by
 * (account, quotaLimitBytes). A top-up raises the quota and re-arms the notice.
 * Logs carry only the account id — never chat ids, phones, or names.
 *
 * Config: AFROWS_USAGE_RECEIPT_ENABLED (default on), AFROWS_USAGE_RECEIPT_PCT
 * (default 50, 1..99), AFROWS_USAGE_RECEIPT_MIN_PLAN_GB (default 50).
 */
@Injectable()
export class UsageReceiptNoticeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UsageReceiptNoticeService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private noCardLogged = false;
  private readonly failedKeys = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly telegram: TelegramAlertService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!resolveUsageReceiptEnabled(this.config.get<string>('AFROWS_USAGE_RECEIPT_ENABLED'))) return;
    this.timer = setInterval(() => void this.tick(), USAGE_RECEIPT_CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One check pass. Never throws. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      if (!(await this.telegram.isBotConfigured())) return;
      const card = parseCardToCard(await this.loadCardToCardInfo());
      if (!card) {
        if (!this.noCardLogged) {
          this.noCardLogged = true;
          this.logger.warn('Usage receipt: no card_to_card_info configured; skipping until a card is set');
        }
        return;
      }
      this.noCardLogged = false;

      const thresholdPct = resolveUsageReceiptPct(this.config.get<string>('AFROWS_USAGE_RECEIPT_PCT'));
      const minPlanBytes = resolveUsageReceiptMinPlanBytes(this.config.get<string>('AFROWS_USAGE_RECEIPT_MIN_PLAN_GB'));
      const candidates = await this.loadCandidates(thresholdPct, minPlanBytes);
      if (!candidates.length) return;
      const deliveries = await this.loadDeliveries(candidates.map((row) => row.accountId));

      let sent = 0;
      for (const row of candidates) {
        if (sent >= MAX_SENDS_PER_TICK) break;
        const decision = decideUsageReceipt({
          quotaLimitBytes: numberFromBigInt(row.quotaLimitBytes),
          usedBytes: numberFromBigInt(row.usedBytes) ?? 0,
          cycleStartUsedBytes: numberFromBigInt(row.cycleStartUsedBytes) ?? 0,
          thresholdPct,
          minPlanBytes,
          deliveries: deliveries.get(row.accountId) ?? [],
        });
        if (!decision) continue;
        sent += 1;
        // A transient failure (no route to Telegram, 429, 5xx) would hit every
        // remaining chat the same way: stop and retry the lot next tick.
        if ((await this.deliver(row, decision, card)) === 'transient') break;
      }
    } catch (error) {
      this.logger.warn(`Usage receipt check failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  private async loadCardToCardInfo(): Promise<string | null> {
    try {
      const result = await this.database.query<CardRow>(
        `SELECT card_to_card_info AS "cardToCardInfo" FROM telegram_bot_settings WHERE setting_key = 'default'`,
      );
      return result.rows[0]?.cardToCardInfo ?? null;
    } catch {
      return null;
    }
  }

  private async loadCandidates(thresholdPct: number, minPlanBytes: number): Promise<CandidateRow[]> {
    const result = await this.database.query<CandidateRow>(
      `
        SELECT ca.id AS "accountId",
               ca.display_name AS "displayName",
               ca.quota_limit_bytes AS "quotaLimitBytes",
               ca.used_bytes AS "usedBytes",
               ca.cycle_start_used_bytes AS "cycleStartUsedBytes",
               tu.chat_id AS "chatId"
        FROM customer_accounts ca
        JOIN telegram_users tu ON tu.telegram_id = ca.telegram_id
        WHERE ca.deleted_at IS NULL
          AND ca.status = 'active'
          AND (ca.expires_at IS NULL OR ca.expires_at > now())
          AND ca.telegram_id IS NOT NULL AND ca.telegram_id <> ''
          AND tu.chat_id IS NOT NULL AND tu.chat_id <> ''
          AND ca.quota_limit_bytes >= $1::bigint
          -- CYCLE percentage (C6/0.128.0): (used − cycleStart) / (quota − cycleStart).
          AND (ca.quota_limit_bytes - COALESCE(ca.cycle_start_used_bytes, 0)) > 0
          AND (ca.used_bytes - COALESCE(ca.cycle_start_used_bytes, 0)) * 100
              >= (ca.quota_limit_bytes - COALESCE(ca.cycle_start_used_bytes, 0)) * $2::bigint
        ORDER BY (ca.used_bytes - COALESCE(ca.cycle_start_used_bytes, 0))::numeric
                 / NULLIF(ca.quota_limit_bytes - COALESCE(ca.cycle_start_used_bytes, 0), 0) DESC
      `,
      [minPlanBytes, thresholdPct],
    );
    return result.rows;
  }

  private async loadDeliveries(accountIds: string[]): Promise<Map<string, UsageReceiptDelivery[]>> {
    const byAccount = new Map<string, UsageReceiptDelivery[]>();
    const result = await this.database.query<DeliveryRow>(
      `
        SELECT target_id AS "accountId", metadata->>'quotaLimitBytes' AS "quotaLimitBytes"
        FROM audit_logs
        WHERE target_type = $1 AND target_id = ANY($2::text[]) AND action = $3
      `,
      [USAGE_RECEIPT_AUDIT_TARGET_TYPE, accountIds, USAGE_RECEIPT_ACTION],
    );
    for (const row of result.rows) {
      const quota = numberFromBigInt(row.quotaLimitBytes);
      if (quota === null) continue;
      const list = byAccount.get(row.accountId) ?? [];
      list.push({ quotaLimitBytes: quota });
      byAccount.set(row.accountId, list);
    }
    return byAccount;
  }

  private async deliver(
    row: CandidateRow,
    decision: UsageReceiptDecision,
    card: { card: string; holder: string },
  ): Promise<'sent' | 'permanent' | 'transient'> {
    const key = `${row.accountId}:${decision.quotaLimitBytes}`;
    const text = buildUsageReceiptMessage(decision, row.displayName, card, {
      render: renderTelegramCopy,
      rtl: applyRtlGuard,
    });
    const result = await this.telegram.sendMessage(row.chatId, text, {
      parseMode: 'HTML',
      disableWebPagePreview: true,
      replyMarkup: this.keyboard(),
    });

    const permanent = result.status === 'failed' && isPermanentTelegramFailure(result.statusCode);
    if (result.status !== 'sent' && !permanent) {
      const message = `Usage receipt for account ${row.accountId} not delivered (${result.reason}); retrying next tick`;
      if (this.failedKeys.has(key)) {
        this.logger.debug(message);
      } else {
        this.failedKeys.add(key);
        this.logger.warn(message);
      }
      return 'transient';
    }

    this.failedKeys.delete(key);
    this.logger.log(
      permanent
        ? `Usage receipt for account ${row.accountId} undeliverable (chat blocked/unavailable); not retrying for this quota`
        : `Usage receipt delivered for account ${row.accountId}`,
    );
    // The audit row is the dedupe record (account, quotaLimitBytes).
    await this.audit.recordBestEffort(undefined, USAGE_RECEIPT_ACTION, USAGE_RECEIPT_AUDIT_TARGET_TYPE, row.accountId, {
      quotaLimitBytes: decision.quotaLimitBytes,
      remainingBytes: decision.remainingBytes,
      percentUsed: decision.percentUsed,
      delivered: !permanent,
    });
    return permanent ? 'permanent' : 'sent';
  }

  /** Single Persian "I've paid — upload receipt" button into the existing buy/receipt flow. */
  private keyboard(): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [[{ text: renderTelegramCopy(USAGE_RECEIPT_BTN_COPY, 'fa'), callback_data: 'afws:buy' }]],
    };
  }
}
