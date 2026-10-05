import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { numberFromBigInt } from '../billing/billing-math';
import { DatabaseService } from '../database/database.service';
import { applyRtlGuard, formatDataSize } from '../telegram/telegram-format';
import { isTelegramLanguage, renderTelegramCopy, type TelegramLanguage } from '../telegram/telegram-i18n';
import { TelegramAlertService, type TelegramInlineKeyboardMarkup } from './telegram-alert.service';
import {
  LOW_QUOTA_ACTION,
  LOW_QUOTA_AUDIT_TARGET_TYPE,
  LOW_QUOTA_CHECK_INTERVAL_MS,
  buildLowQuotaMessage,
  decideLowQuotaAlert,
  isPermanentTelegramFailure,
  resolveLowQuotaEnabled,
  resolveLowQuotaThresholdBytes,
  type LowQuotaAlertKind,
  type LowQuotaDecision,
  type LowQuotaDelivery,
} from './low-quota-alert';

interface CandidateRow {
  accountId: string;
  quotaLimitBytes: string | number | null;
  usedBytes: string | number | null;
  updatedAt: Date | null;
  chatId: string;
  language: string | null;
}

interface DeliveryRow {
  accountId: string;
  action: string;
  quotaLimitBytes: string | null;
}

/** Telegram allows ~30 msg/s; a small per-tick cap keeps a backlog (e.g. first rollout) gentle. */
const MAX_SENDS_PER_TICK = 25;

/**
 * Customer LOW-DATA ("~5 GB left, recharge") and DATA-FINISHED Telegram pushes
 * via the afroWS bot. Policy in ./low-quota-alert.ts; this class does I/O.
 *
 * Every 5 min: active, non-deleted, unexpired accounts with a linked bot chat
 * (customer_accounts.telegram_id -> telegram_users.chat_id, i.e. the customer
 * has talked to the bot) and remaining <= threshold. One indexed query for the
 * (small) candidate set + one for their prior deliveries; no work otherwise.
 *
 * Dedupe + restart safety: a delivered notice is an audit_logs row keyed by
 * (account, kind, quotaLimitBytes). A failed send writes nothing, so it is
 * retried next tick; the failure is logged at warn once per notice, then debug.
 * Logs carry only the account id — never chat ids, phones or names.
 *
 * Config: AFROWS_LOW_QUOTA_ALERT_ENABLED (default on),
 * AFROWS_LOW_QUOTA_ALERT_GB (decimal GB, default 5, clamp 1..1000).
 */
@Injectable()
export class LowQuotaAlertService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LowQuotaAlertService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  /** `${accountId}:${kind}:${quota}` keys whose delivery failure was already logged at warn. */
  private readonly failedKeys = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly telegram: TelegramAlertService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    if (!process.env.DATABASE_URL) return;
    if (!resolveLowQuotaEnabled(this.config.get<string>('AFROWS_LOW_QUOTA_ALERT_ENABLED'))) return;
    this.timer = setInterval(() => void this.tick(), LOW_QUOTA_CHECK_INTERVAL_MS);
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
      const thresholdBytes = resolveLowQuotaThresholdBytes(this.config.get<string>('AFROWS_LOW_QUOTA_ALERT_GB'));
      const candidates = await this.loadCandidates(thresholdBytes);
      if (!candidates.length) return;
      const deliveries = await this.loadDeliveries(candidates.map((row) => row.accountId));

      const now = new Date();
      let sent = 0;
      for (const row of candidates) {
        if (sent >= MAX_SENDS_PER_TICK) break;
        const decision = decideLowQuotaAlert({
          now,
          quotaLimitBytes: numberFromBigInt(row.quotaLimitBytes),
          usedBytes: numberFromBigInt(row.usedBytes) ?? 0,
          thresholdBytes,
          lastActivityAt: row.updatedAt ? new Date(row.updatedAt) : null,
          deliveries: deliveries.get(row.accountId) ?? [],
        });
        if (!decision) continue;
        sent += 1;
        // A transient failure (no route to Telegram, 429, 5xx) would hit every
        // remaining chat the same way: stop and retry the lot next tick.
        if ((await this.deliver(row, decision)) === 'transient') break;
      }
    } catch (error) {
      this.logger.warn(`Low-quota alert check failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  private async loadCandidates(thresholdBytes: number): Promise<CandidateRow[]> {
    const result = await this.database.query<CandidateRow>(
      `
        SELECT ca.id AS "accountId",
               ca.quota_limit_bytes AS "quotaLimitBytes",
               ca.used_bytes AS "usedBytes",
               ca.updated_at AS "updatedAt",
               tu.chat_id AS "chatId",
               tu.language
        FROM customer_accounts ca
        JOIN telegram_users tu ON tu.telegram_id = ca.telegram_id
        WHERE ca.deleted_at IS NULL
          AND ca.status = 'active'
          AND (ca.expires_at IS NULL OR ca.expires_at > now())
          AND ca.telegram_id IS NOT NULL AND ca.telegram_id <> ''
          AND tu.chat_id IS NOT NULL AND tu.chat_id <> ''
          AND ca.quota_limit_bytes > 0
          AND ca.quota_limit_bytes - ca.used_bytes <= $1::bigint
        ORDER BY ca.quota_limit_bytes - ca.used_bytes DESC
      `,
      [thresholdBytes],
    );
    return result.rows;
  }

  private async loadDeliveries(accountIds: string[]): Promise<Map<string, LowQuotaDelivery[]>> {
    const byAccount = new Map<string, LowQuotaDelivery[]>();
    const result = await this.database.query<DeliveryRow>(
      `
        SELECT target_id AS "accountId", action, metadata->>'quotaLimitBytes' AS "quotaLimitBytes"
        FROM audit_logs
        WHERE target_type = $1 AND target_id = ANY($2::text[]) AND action = ANY($3::text[])
      `,
      [LOW_QUOTA_AUDIT_TARGET_TYPE, accountIds, Object.values(LOW_QUOTA_ACTION)],
    );
    for (const row of result.rows) {
      const kind = (Object.keys(LOW_QUOTA_ACTION) as LowQuotaAlertKind[]).find((k) => LOW_QUOTA_ACTION[k] === row.action);
      const quota = numberFromBigInt(row.quotaLimitBytes);
      if (!kind || quota === null) continue;
      const list = byAccount.get(row.accountId) ?? [];
      list.push({ kind, quotaLimitBytes: quota });
      byAccount.set(row.accountId, list);
    }
    return byAccount;
  }

  private async deliver(row: CandidateRow, decision: LowQuotaDecision): Promise<'sent' | 'permanent' | 'transient'> {
    const key = `${row.accountId}:${decision.kind}:${decision.quotaLimitBytes}`;
    const language = isTelegramLanguage(row.language) ? row.language : null;
    const text = buildLowQuotaMessage(decision, language, {
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
      const message = `Low-quota ${decision.kind} notice for account ${row.accountId} not delivered (${result.reason}); retrying next tick`;
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
        ? `Low-quota ${decision.kind} notice for account ${row.accountId} undeliverable (chat blocked/unavailable); not retrying for this quota`
        : `Low-quota ${decision.kind} notice delivered for account ${row.accountId}`,
    );
    // The audit row is the dedupe record (account, kind, quotaLimitBytes).
    await this.audit.recordBestEffort(undefined, LOW_QUOTA_ACTION[decision.kind], LOW_QUOTA_AUDIT_TARGET_TYPE, row.accountId, {
      quotaLimitBytes: decision.quotaLimitBytes,
      remainingBytes: decision.remainingBytes,
      delivered: !permanent,
    });
    return permanent ? 'permanent' : 'sent';
  }

  /** Same buttons the bot uses elsewhere: Buy Data (works for direct and seller-owned customers) + My Account. */
  private keyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: renderTelegramCopy('menu.btn.buy', language), callback_data: 'afws:buy' }],
        [{ text: renderTelegramCopy('menu.btn.account', language), callback_data: 'afws:acct' }],
      ],
    };
  }
}
