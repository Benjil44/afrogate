import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { AdminTelegramTopupRequest, TelegramTopupStatus } from '@afrows/shared';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';
import { numberFromBigInt } from '../billing/billing-math';
import { computeAllocatedQuotaLimitBytes } from '../billing/quota-math';
import { OutboundHttpService } from '../outbound/outbound-http.service';
import type { AuthActor } from '../security/auth-request';
import {
  TelegramAlertService,
  type TelegramInlineKeyboardMarkup,
} from '../notifications/telegram-alert.service';
import { TelegramBotConfigService } from './telegram-bot-config.service';
import { normalizeTelegramLanguage, renderTelegramCopy, type TelegramLanguage } from './telegram-i18n';
import { applyRtlGuard, formatDataSize } from './telegram-format';
import { approveTopupInTransaction, rejectTopupInTransaction, topupReference } from './telegram-topup';

export type TelegramTopupListStatus = TelegramTopupStatus | 'all';

interface TopupListRow {
  id: string;
  customerAccountId: string;
  telegramId: string | null;
  telegramChatId: string | null;
  volumePackageId: string | null;
  amountMinor: string | number | null;
  currency: string | null;
  status: string;
  receiptFileId: string | null;
  createdAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  customerDisplayName: string | null;
  telegramUsername: string | null;
  packageLabel: string | null;
  packageVolumeBytes: string | number | null;
}

const LIST_SELECT = `
  SELECT
    t.id,
    t.customer_account_id AS "customerAccountId",
    t.telegram_id AS "telegramId",
    t.telegram_chat_id AS "telegramChatId",
    t.volume_package_id AS "volumePackageId",
    t.amount_minor AS "amountMinor",
    t.currency,
    t.status,
    t.receipt_file_id AS "receiptFileId",
    t.created_at AS "createdAt",
    t.reviewed_by AS "reviewedBy",
    t.reviewed_at AS "reviewedAt",
    t.review_note AS "reviewNote",
    ca.display_name AS "customerDisplayName",
    ca.telegram_username AS "telegramUsername",
    vp.name AS "packageLabel",
    vp.volume_bytes AS "packageVolumeBytes"
  FROM telegram_topup_requests t
  LEFT JOIN customer_accounts ca ON ca.id = t.customer_account_id
  LEFT JOIN volume_packages vp ON vp.id = t.volume_package_id
`;

@Injectable()
export class TelegramTopupAdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly telegram: TelegramAlertService,
    private readonly telegramConfig: TelegramBotConfigService,
    private readonly outboundHttp: OutboundHttpService,
  ) {}

  async listRequests(status: TelegramTopupListStatus): Promise<AdminTelegramTopupRequest[]> {
    const filter = status === 'all' ? null : status;
    const result = await this.database.query<TopupListRow>(
      `${LIST_SELECT}
       WHERE ($1::text IS NULL OR t.status = $1)
       ORDER BY t.created_at DESC
       LIMIT 200`,
      [filter],
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async getRequest(id: string): Promise<AdminTelegramTopupRequest> {
    const result = await this.database.query<TopupListRow>(
      `${LIST_SELECT}
       WHERE t.id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Top-up request not found');
    return this.mapRow(row);
  }

  async approve(id: string, actor: AuthActor | undefined): Promise<AdminTelegramTopupRequest> {
    const reviewer = actor?.username ?? actor?.id ?? null;
    const outcome = await this.database.transaction((executor) =>
      // Reuse the exact quota-credit math used by allocatePaymentOrder and
      // reseller package sales — no bespoke crediting mechanism.
      approveTopupInTransaction(executor, id, {
        reviewer,
        computeQuotaAfter: computeAllocatedQuotaLimitBytes,
      }),
    );

    await this.audit.record(actor, 'telegram.topup.approve', 'telegram_topup_request', id, {
      customerAccountId: outcome.customerAccountId,
      volumeBytes: outcome.volumeBytes,
      quotaLimitBeforeBytes: outcome.quotaLimitBeforeBytes,
      quotaLimitAfterBytes: outcome.quotaLimitAfterBytes,
      packageName: outcome.packageName,
    });

    // N1 — approved notification, in the user's stored language (docs §2-N1).
    if (outcome.telegramChatId) {
      const language = await this.resolveLanguage(outcome.telegramId);
      const text = renderTelegramCopy(
        'notify.approved',
        language,
        { requestId: outcome.reference },
        { packageSize: formatDataSize(outcome.volumeBytes, language) },
      );
      await this.pushToUser(outcome.telegramChatId, text, language, this.approvedKeyboard(language));
    }

    return this.getRequest(id);
  }

  async reject(id: string, reason: string | null, actor: AuthActor | undefined): Promise<AdminTelegramTopupRequest> {
    const reviewer = actor?.username ?? actor?.id ?? null;
    const normalizedReason = reason?.trim() || null;
    const outcome = await this.database.transaction((executor) =>
      rejectTopupInTransaction(executor, id, { reviewer, reason: normalizedReason }),
    );

    await this.audit.record(actor, 'telegram.topup.reject', 'telegram_topup_request', id, {
      customerAccountId: outcome.customerAccountId,
      reason: normalizedReason,
    });

    // N2 — rejected notification; substitute notify.noReason when the admin left no note.
    if (outcome.telegramChatId) {
      const language = await this.resolveLanguage(outcome.telegramId);
      const reasonText = normalizedReason ?? renderTelegramCopy('notify.noReason', language);
      const text = renderTelegramCopy('notify.rejected', language, {
        requestId: outcome.reference,
        reason: reasonText,
      });
      await this.pushToUser(outcome.telegramChatId, text, language, this.rejectedKeyboard(language));
    }

    return this.getRequest(id);
  }

  /**
   * Authenticated server-side proxy for a receipt image. Resolves the bot token
   * from the vault (NEVER sent to the browser), calls Telegram getFile, then
   * downloads the file bytes and returns them for the admin to view.
   */
  async getReceipt(id: string): Promise<{ buffer: Buffer; contentType: string }> {
    const receipt = await this.database.query<{ receiptFileId: string | null }>(
      `SELECT receipt_file_id AS "receiptFileId" FROM telegram_topup_requests WHERE id = $1`,
      [id],
    );
    const fileId = receipt.rows[0]?.receiptFileId;
    if (!receipt.rows[0]) throw new NotFoundException('Top-up request not found');
    if (!fileId) throw new NotFoundException('This request has no receipt');

    const { botToken, apiBaseUrl, timeoutMs } = await this.telegramConfig.getBotApiAccess();
    if (!botToken) throw new ServiceUnavailableException('Telegram bot token is not configured');

    const getFileResponse = await this.outboundHttp.request(
      `${apiBaseUrl}/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { headers: { Accept: 'application/json' }, timeoutMs },
    );
    if (!getFileResponse.ok) throw new ServiceUnavailableException('Telegram getFile failed');

    const filePath = this.parseFilePath(getFileResponse.body);
    if (!filePath) throw new ServiceUnavailableException('Telegram did not return a file path');

    const download = await this.outboundHttp.requestBinary(
      `${apiBaseUrl}/file/bot${botToken}/${filePath}`,
      { timeoutMs },
    );
    if (!download.ok) throw new ServiceUnavailableException('Telegram file download failed');

    const headerContentType = String(download.headers['content-type'] ?? '').split(';')[0].trim();
    return {
      buffer: download.body,
      contentType: headerContentType || this.contentTypeFromPath(filePath),
    };
  }

  /** Push a localized, HTML message to the user's chat (docs §5 language rule: fallback fa). */
  private async pushToUser(
    chatId: string,
    text: string,
    language: TelegramLanguage,
    replyMarkup: TelegramInlineKeyboardMarkup,
  ): Promise<void> {
    await this.telegram.sendMessage(chatId, applyRtlGuard(text, language), {
      parseMode: 'HTML',
      disableWebPagePreview: true,
      replyMarkup,
    });
  }

  private approvedKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: renderTelegramCopy('menu.btn.account', language), callback_data: 'afws:acct' }],
        [{ text: renderTelegramCopy('common.btn.menu', language), callback_data: 'afws:menu' }],
      ],
    };
  }

  private rejectedKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: renderTelegramCopy('buy.btn.retry', language), callback_data: 'afws:buy' }],
        [{ text: renderTelegramCopy('common.btn.menu', language), callback_data: 'afws:menu' }],
      ],
    };
  }

  private async resolveLanguage(telegramId: string | null): Promise<TelegramLanguage> {
    if (!telegramId) return 'fa';
    const result = await this.database.query<{ language: string }>(
      `SELECT language FROM telegram_users WHERE telegram_id = $1`,
      [telegramId],
    );
    return normalizeTelegramLanguage(result.rows[0]?.language);
  }

  private parseFilePath(body: string): string | null {
    try {
      const parsed = JSON.parse(body) as { ok?: boolean; result?: { file_path?: string } };
      const filePath = parsed?.result?.file_path;
      // Guard against path traversal in the value Telegram returns.
      if (typeof filePath !== 'string' || filePath.includes('..')) return null;
      return filePath.replace(/^\/+/, '');
    } catch {
      return null;
    }
  }

  private contentTypeFromPath(filePath: string): string {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    return 'image/jpeg';
  }

  private mapRow(row: TopupListRow): AdminTelegramTopupRequest {
    return {
      id: row.id,
      reference: topupReference(row.id),
      customerAccountId: row.customerAccountId,
      customerDisplayName: row.customerDisplayName,
      telegramId: row.telegramId,
      telegramUsername: row.telegramUsername,
      telegramChatId: row.telegramChatId,
      volumePackageId: row.volumePackageId,
      packageLabel: row.packageLabel,
      packageVolumeBytes: numberFromBigInt(row.packageVolumeBytes),
      amountMinor: numberFromBigInt(row.amountMinor),
      currency: row.currency,
      status: this.normalizeStatus(row.status),
      hasReceipt: Boolean(row.receiptFileId),
      createdAt: row.createdAt.toISOString(),
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewNote: row.reviewNote,
    };
  }

  private normalizeStatus(status: string): TelegramTopupStatus {
    return status === 'awaiting_receipt' || status === 'pending' || status === 'approved' || status === 'rejected'
      ? status
      : 'pending';
  }
}
