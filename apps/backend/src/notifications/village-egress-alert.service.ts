import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { TelegramBotConfigService } from '../telegram/telegram-bot-config.service';
import { applyRtlGuard, toPersianDigits } from '../telegram/telegram-format';
import { renderTelegramCopy } from '../telegram/telegram-i18n';
import { TelegramAlertService } from './telegram-alert.service';
import {
  VILLAGE_ALERT_SENT_ACTION,
  VILLAGE_EGRESS_ALERT_KEY,
  buildVillageAlertMessage,
  decideVillageAlert,
  resolveReminderIntervalMs,
  type VillageAlertDecision,
  type VillageAlertDelivery,
  type VillageAlertKind,
  type VillageOutage,
} from './village-egress-alert';

interface OutageRow {
  id: string;
  status: string;
  firstSeenAt: Date;
  resolvedAt: Date | null;
}

interface DeliveryRow {
  targetId: string;
  kind: string | null;
  createdAt: Date;
}

/**
 * URGENT "customer egress down" notice to the afroWS bot operators, driven by
 * VillageFailoverService's village-MikroTik probe (no timer of its own).
 *
 * State lives in PostgreSQL so a backend restart neither re-pages nor forgets:
 * the outage is an `alerts` row (also visible on the dashboard Alerts page) and
 * every delivered notice is an `audit_logs` row. A failed Telegram send records
 * nothing, so the same notice is simply retried on the next village check
 * (~10 min) until a route to api.telegram.org exists again; the failure is
 * logged once per notice, repeats at debug, so a long outage cannot spam logs.
 *
 * Recipients: telegram_bot_settings.allowed_admin_chat_ids (the bot superadmins)
 * plus the alert chat when Telegram alerts are enabled; deduplicated.
 *
 * Config: AFROWS_VILLAGE_ALERT_ENABLED=false disables it;
 * AFROWS_VILLAGE_ALERT_REMINDER_MINUTES (default 360, clamp 30..10080) sets the
 * still-down reminder cadence.
 */
@Injectable()
export class VillageEgressAlertService {
  private readonly logger = new Logger(VillageEgressAlertService.name);
  /** `${outageId}:${kind}` of the notice whose failure was last logged at warn. */
  private lastFailureKey: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly telegram: TelegramAlertService,
    private readonly telegramConfig: TelegramBotConfigService,
    private readonly audit: AuditService,
  ) {}

  isEnabled(): boolean {
    const raw = this.config.get<string>('AFROWS_VILLAGE_ALERT_ENABLED')?.trim().toLowerCase();
    return !raw || !['0', 'false', 'no', 'off'].includes(raw);
  }

  async hasOpenOutage(): Promise<boolean> {
    const { open } = await this.loadOutages();
    return open !== null;
  }

  /**
   * Commit a (confirmed) village probe result to the outage marker, then send
   * whichever notice is due. Never throws.
   */
  async observe(offline: boolean, context: { enabledReserveCount: number }): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      await this.syncMarker(offline);
      const decision = await this.decide();
      if (decision) await this.deliver(decision, context);
    } catch (error) {
      this.logger.warn(`Village egress alert check failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async syncMarker(offline: boolean): Promise<void> {
    const { sourceType, sourceId, title } = VILLAGE_EGRESS_ALERT_KEY;
    if (offline) {
      await this.database.query(
        `
          INSERT INTO alerts (severity, status, source_type, source_id, title, message)
          VALUES ('critical', 'open', $1, $2, $3, $4)
          ON CONFLICT (source_type, source_id, title) WHERE status = 'open'
          DO UPDATE SET last_seen_at = now()
        `,
        [sourceType, sourceId, title, 'Village MikroTik unreachable: customer egress via Germany is down.'],
      );
      return;
    }
    await this.database.query(
      `
        UPDATE alerts
        SET status = 'resolved', resolved_at = now(), last_seen_at = now()
        WHERE source_type = $1 AND source_id = $2 AND title = $3 AND status = 'open'
      `,
      [sourceType, sourceId, title],
    );
  }

  private async decide(): Promise<VillageAlertDecision | null> {
    const { open, lastResolved } = await this.loadOutages();
    const deliveries = await this.loadLastDeliveries([open?.id, lastResolved?.id].filter((id): id is string => Boolean(id)));
    return decideVillageAlert({
      now: new Date(),
      open,
      lastSentForOpen: open ? deliveries.get(open.id) ?? null : null,
      lastResolved,
      lastSentForResolved: lastResolved ? deliveries.get(lastResolved.id) ?? null : null,
      reminderIntervalMs: resolveReminderIntervalMs(this.config.get<string>('AFROWS_VILLAGE_ALERT_REMINDER_MINUTES')),
    });
  }

  /** The open marker (if any) and the most recently resolved one. Outages never overlap, so 2 rows suffice. */
  private async loadOutages(): Promise<{ open: VillageOutage | null; lastResolved: VillageOutage | null }> {
    const { sourceType, sourceId, title } = VILLAGE_EGRESS_ALERT_KEY;
    const result = await this.database.query<OutageRow>(
      `
        SELECT id, status, first_seen_at AS "firstSeenAt", resolved_at AS "resolvedAt"
        FROM alerts
        WHERE source_type = $1 AND source_id = $2 AND title = $3
        ORDER BY first_seen_at DESC
        LIMIT 2
      `,
      [sourceType, sourceId, title],
    );
    const toOutage = (row: OutageRow): VillageOutage => ({
      id: row.id,
      startedAt: new Date(row.firstSeenAt),
      resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : null,
    });
    const openRow = result.rows.find((row) => row.status === 'open');
    const resolvedRow = result.rows.find((row) => row.status !== 'open' && row.resolvedAt);
    return { open: openRow ? toOutage(openRow) : null, lastResolved: resolvedRow ? toOutage(resolvedRow) : null };
  }

  private async loadLastDeliveries(outageIds: string[]): Promise<Map<string, VillageAlertDelivery>> {
    const deliveries = new Map<string, VillageAlertDelivery>();
    if (!outageIds.length) return deliveries;
    const result = await this.database.query<DeliveryRow>(
      `
        SELECT DISTINCT ON (target_id)
          target_id AS "targetId", metadata->>'kind' AS kind, created_at AS "createdAt"
        FROM audit_logs
        WHERE target_type = 'alert' AND target_id = ANY($1::text[]) AND action = $2
        ORDER BY target_id, created_at DESC
      `,
      [outageIds, VILLAGE_ALERT_SENT_ACTION],
    );
    for (const row of result.rows) {
      const kind = row.kind;
      if (kind !== 'down' && kind !== 'reminder' && kind !== 'recovery') continue;
      deliveries.set(row.targetId, { kind: kind as VillageAlertKind, at: new Date(row.createdAt) });
    }
    return deliveries;
  }

  private async deliver(decision: VillageAlertDecision, context: { enabledReserveCount: number }): Promise<void> {
    const key = `${decision.outage.id}:${decision.kind}`;
    const recipients = await this.recipients();
    if (!recipients.length) {
      this.noteFailure(key, 'no recipients configured (telegram_bot_settings.allowed_admin_chat_ids / alert chat empty)');
      return;
    }

    const text = buildVillageAlertMessage(decision, context, {
      render: renderTelegramCopy,
      rtl: applyRtlGuard,
      digits: toPersianDigits,
    });

    let delivered = 0;
    let lastReason = 'unknown';
    for (const chatId of recipients) {
      const result = await this.telegram.sendMessage(chatId, text, { parseMode: 'HTML', disableWebPagePreview: true });
      if (result.status === 'sent') delivered += 1;
      else lastReason = result.reason;
    }

    if (!delivered) {
      this.noteFailure(key, lastReason);
      return;
    }

    // A partial delivery counts as delivered: retrying would re-page the
    // operators that already got it. The audit row is the dedupe record.
    this.lastFailureKey = null;
    this.logger.warn(`Village egress ${decision.kind} notice delivered to ${delivered}/${recipients.length} operator chat(s)`);
    await this.audit.recordBestEffort(undefined, VILLAGE_ALERT_SENT_ACTION, 'alert', decision.outage.id, {
      kind: decision.kind,
      outageStartedAt: decision.outage.startedAt.toISOString(),
      durationSeconds: Math.floor(decision.durationMs / 1000),
      enabledReserveCount: context.enabledReserveCount,
      delivered,
      recipients: recipients.length,
    });
  }

  /** Log a delivery failure at warn once per notice; repeats (every ~10 min retry) go to debug. */
  private noteFailure(key: string, reason: string): void {
    const message = `Village egress notice ${key.split(':')[1]} not delivered (${reason}); retrying on the next village check`;
    if (this.lastFailureKey === key) {
      this.logger.debug(message);
      return;
    }
    this.lastFailureKey = key;
    this.logger.warn(message);
  }

  private async recipients(): Promise<string[]> {
    const ids = new Set<string>();
    try {
      const summary = await this.telegramConfig.getSettingsSummary();
      for (const id of summary.allowedAdminChatIds) {
        const value = String(id).trim();
        if (value) ids.add(value);
      }
    } catch {
      // settings unreadable -> fall through to the alert chat only
    }
    try {
      const runtime = await this.telegramConfig.getRuntimeConfig();
      if (runtime.alertsEnabled && runtime.alertChatId?.trim()) ids.add(runtime.alertChatId.trim());
    } catch {
      // no runtime config -> admins only
    }
    return [...ids];
  }
}
