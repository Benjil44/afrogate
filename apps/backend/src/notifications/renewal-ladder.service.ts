import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { numberFromBigInt } from '../billing/billing-math';
import { DatabaseService } from '../database/database.service';
import { applyRtlGuard, formatDataSize } from '../telegram/telegram-format';
import { isTelegramLanguage, renderTelegramCopy, type TelegramLanguage } from '../telegram/telegram-i18n';
import { TelegramAlertService, type TelegramInlineKeyboardMarkup } from './telegram-alert.service';
import { isPermanentTelegramFailure } from './low-quota-alert';
import {
  LAPSED_AT_CLEAR_SQL,
  LAPSED_AT_SET_SQL,
  RENEWAL_LADDER_ACTION,
  RENEWAL_LADDER_AUDIT_TARGET_TYPE,
  RENEWAL_LADDER_CHECK_INTERVAL_MS,
  buildRenewalNoticeMessage,
  decideRenewalNotice,
  resolveRenewalLadderEnabled,
  type RenewalNoticeDecision,
} from './renewal-ladder';

interface CandidateRow {
  accountId: string;
  quotaLimitBytes: string | number | null;
  usedBytes: string | number | null;
  cycleStartUsedBytes: string | number | null;
  expiresAt: Date | null;
  mask: string | number | null;
  status: string | null;
  deletedAt: Date | null;
  chatId: string;
  language: string | null;
  hasPendingReceipt: boolean;
}

const MAX_SENDS_PER_TICK = 25;

/**
 * RENEWAL LADDER notice (lever B). Policy in ./renewal-ladder.ts; this class does I/O.
 *
 * Every 5 min it (1) maintains lapsed_at (C3 — the ONLY place), then (2) nudges
 * Telegram-linked active accounts up the renewal ladder: usage 80/95/100% of the
 * current paid cycle and expiry T-3d/T-1d, each rung once per cycle. The
 * renewal_notice_mask COLUMN is the restart-safe dedupe (a purchase resets it to 0,
 * see cycle-anchor.ts); a delivered notice also writes an audit row for observability.
 * Logs carry only account ids. Config: AFROWS_RENEWAL_LADDER_ENABLED (default on).
 */
@Injectable()
export class RenewalLadderNoticeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RenewalLadderNoticeService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private readonly failedKeys = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly telegram: TelegramAlertService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!resolveRenewalLadderEnabled(this.config.get<string>('AFROWS_RENEWAL_LADDER_ENABLED'))) return;
    this.timer = setInterval(() => void this.tick(), RENEWAL_LADDER_CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass. Never throws. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // C3: lapsed_at is maintained ONLY here (never in monthly-expiry).
      await this.maintainLapsedAt();
      if (!(await this.telegram.isBotConfigured())) return;
      const candidates = await this.loadCandidates();
      if (!candidates.length) return;
      const now = new Date();
      let sent = 0;
      for (const row of candidates) {
        if (sent >= MAX_SENDS_PER_TICK) break;
        const decision = decideRenewalNotice({
          quota: numberFromBigInt(row.quotaLimitBytes),
          used: numberFromBigInt(row.usedBytes) ?? 0,
          cycleStart: numberFromBigInt(row.cycleStartUsedBytes) ?? 0,
          expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
          mask: numberFromBigInt(row.mask) ?? 0,
          hasPendingReceipt: row.hasPendingReceipt,
          hasChat: true,
          status: row.status,
          deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
          now,
        });
        if (!decision) continue;
        sent += 1;
        if ((await this.deliver(row, decision)) === 'transient') break;
      }
    } catch (error) {
      this.logger.warn(`Renewal ladder check failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  private async maintainLapsedAt(): Promise<void> {
    try {
      await this.database.query(LAPSED_AT_SET_SQL);
      await this.database.query(LAPSED_AT_CLEAR_SQL);
    } catch (error) {
      this.logger.warn(`lapsed_at maintenance failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async loadCandidates(): Promise<CandidateRow[]> {
    const result = await this.database.query<CandidateRow>(
      `
        SELECT ca.id AS "accountId",
               ca.quota_limit_bytes AS "quotaLimitBytes",
               ca.used_bytes AS "usedBytes",
               ca.cycle_start_used_bytes AS "cycleStartUsedBytes",
               ca.expires_at AS "expiresAt",
               ca.renewal_notice_mask AS "mask",
               ca.status,
               ca.deleted_at AS "deletedAt",
               tu.chat_id AS "chatId",
               tu.language,
               EXISTS(
                 SELECT 1 FROM telegram_topup_requests t
                 WHERE t.customer_account_id = ca.id AND t.status = 'pending'
               ) AS "hasPendingReceipt"
        FROM customer_accounts ca
        JOIN telegram_users tu ON tu.telegram_id = ca.telegram_id
        WHERE ca.deleted_at IS NULL
          AND ca.status = 'active'
          AND ca.quota_limit_bytes IS NOT NULL
          AND ca.telegram_id IS NOT NULL AND ca.telegram_id <> ''
          AND tu.chat_id IS NOT NULL AND tu.chat_id <> ''
          AND (
            (
              (ca.quota_limit_bytes - COALESCE(ca.cycle_start_used_bytes, 0)) > 0
              AND (ca.used_bytes - COALESCE(ca.cycle_start_used_bytes, 0)) * 100
                  >= (ca.quota_limit_bytes - COALESCE(ca.cycle_start_used_bytes, 0)) * 80
            )
            OR ca.used_bytes >= ca.quota_limit_bytes
            OR (ca.expires_at IS NOT NULL AND ca.expires_at > now() AND ca.expires_at <= now() + interval '3 days')
          )
        ORDER BY ca.updated_at DESC
        LIMIT 500
      `,
    );
    return result.rows;
  }

  private async deliver(row: CandidateRow, decision: RenewalNoticeDecision): Promise<'sent' | 'permanent' | 'transient'> {
    const key = `${row.accountId}:${decision.rung}`;
    const language = isTelegramLanguage(row.language) ? row.language : null;
    const text = buildRenewalNoticeMessage(decision, language, {
      render: renderTelegramCopy,
      rtl: applyRtlGuard,
      formatSize: formatDataSize,
    });
    const result = await this.telegram.sendMessage(row.chatId, text, {
      parseMode: 'HTML',
      disableWebPagePreview: true,
      replyMarkup: this.keyboard(language ?? 'fa'),
    });

    const permanent = result.status === 'failed' && isPermanentTelegramFailure(result.statusCode);
    if (result.status !== 'sent' && !permanent) {
      const message = `Renewal ${decision.rung} notice for account ${row.accountId} not delivered (${result.reason}); retrying next tick`;
      if (this.failedKeys.has(key)) this.logger.debug(message);
      else {
        this.failedKeys.add(key);
        this.logger.warn(message);
      }
      return 'transient';
    }
    this.failedKeys.delete(key);

    // The mask COLUMN is the authoritative, restart-safe dedupe. Persist the new mask
    // even on a permanent failure so an unreachable chat is not retried every tick.
    // (No updated_at bump — the low-quota exhausted-fresh window reads updated_at.)
    await this.database.query(`UPDATE customer_accounts SET renewal_notice_mask = $2 WHERE id = $1`, [
      row.accountId,
      decision.newMask,
    ]);
    this.logger.log(
      permanent
        ? `Renewal ${decision.rung} notice for account ${row.accountId} undeliverable (chat blocked/unavailable)`
        : `Renewal ${decision.rung} notice delivered for account ${row.accountId}`,
    );
    await this.audit.recordBestEffort(undefined, RENEWAL_LADDER_ACTION, RENEWAL_LADDER_AUDIT_TARGET_TYPE, row.accountId, {
      rung: decision.rung,
      cyclePercent: decision.cyclePercent,
      remainingBytes: decision.remainingBytes,
      mask: decision.newMask,
      delivered: !permanent,
    });
    return permanent ? 'permanent' : 'sent';
  }

  /** Same buttons the bot uses elsewhere: Buy Data + My Account. */
  private keyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: renderTelegramCopy('menu.btn.buy', language), callback_data: 'afws:buy' }],
        [{ text: renderTelegramCopy('menu.btn.account', language), callback_data: 'afws:acct' }],
      ],
    };
  }
}
