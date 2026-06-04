import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdminAlertSummary } from '@afrows/shared';
import { AuditService } from '../audit/audit.service';
import { OperationsService } from '../operations/operations.service';
import { TelegramAlertService } from './telegram-alert.service';

@Injectable()
export class AlertNotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertNotificationService.name);
  private readonly lastAttemptByAlert = new Map<string, number>();
  private lastConfigWarningAt = 0;
  private timer: NodeJS.Timeout | undefined;
  private isDelivering = false;

  constructor(
    private readonly config: ConfigService,
    private readonly operations: OperationsService,
    private readonly telegram: TelegramAlertService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.deliverCriticalAlerts(), this.intervalMs());
    this.timer.unref?.();
    void this.deliverCriticalAlerts();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async deliverCriticalAlerts(): Promise<void> {
    if (this.isDelivering) return;

    this.isDelivering = true;
    try {
      if (!(await this.telegram.isEnabled())) return;
      if (!(await this.telegram.isConfigured())) {
        this.warnMissingTelegramConfig();
        return;
      }

      const alerts = await this.operations.listAlerts({
        status: 'open',
        severity: 'critical',
        limit: this.batchLimit(),
      });

      for (const alert of alerts) {
        if (!this.shouldAttempt(alert)) continue;

        const result = await this.telegram.sendAlert(alert);
        this.lastAttemptByAlert.set(alert.id, Date.now());

        if (result.status === 'sent') {
          await this.audit.recordBestEffort(undefined, 'alert.telegram.sent', 'alert', alert.id, {
            severity: alert.severity,
            sourceType: alert.sourceType,
            sourceId: alert.sourceId,
            durationMs: result.durationMs,
          });
          continue;
        }

        if (result.status === 'failed') {
          await this.audit.recordBestEffort(undefined, 'alert.telegram.failed', 'alert', alert.id, {
            severity: alert.severity,
            sourceType: alert.sourceType,
            sourceId: alert.sourceId,
            statusCode: result.statusCode,
            reason: result.reason,
          });
        }
      }
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : 'Critical alert delivery failed');
    } finally {
      this.isDelivering = false;
    }
  }

  private shouldAttempt(alert: AdminAlertSummary): boolean {
    const lastAttempt = this.lastAttemptByAlert.get(alert.id);
    return lastAttempt === undefined || Date.now() - lastAttempt >= this.cooldownMs();
  }

  private warnMissingTelegramConfig(): void {
    const now = Date.now();
    if (now - this.lastConfigWarningAt < 5 * 60 * 1000) return;

    this.lastConfigWarningAt = now;
    this.logger.warn('Telegram alert delivery is enabled but bot token or alert chat id is missing');
  }

  private intervalMs(): number {
    return this.configSeconds('AFROWS_ALERT_DELIVERY_INTERVAL_SECONDS', 10, 5) * 1000;
  }

  private cooldownMs(): number {
    return this.configSeconds('AFROWS_TELEGRAM_ALERT_COOLDOWN_SECONDS', 300, 30) * 1000;
  }

  private batchLimit(): number {
    return this.configInteger('AFROWS_ALERT_DELIVERY_BATCH_SIZE', 20, 1, 100);
  }

  private configSeconds(name: string, fallback: number, minimum: number): number {
    return Math.max(this.configInteger(name, fallback, minimum, 86400), minimum);
  }

  private configInteger(name: string, fallback: number, minimum: number, maximum: number): number {
    const configured = Number(this.config.get<string>(name));
    if (!Number.isInteger(configured)) return fallback;
    return Math.min(Math.max(configured, minimum), maximum);
  }
}
