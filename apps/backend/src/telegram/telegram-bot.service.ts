import { Injectable } from '@nestjs/common';
import { telegramWebhookSecretMatches } from './telegram-webhook-secret';
import type {
  AdminVolumePackageSummary,
  TelegramBotAccountSummary,
  TelegramBotWebhookResponse,
} from '@afrows/shared';
import { BillingService } from '../billing/billing.service';
import { DatabaseService } from '../database/database.service';
import {
  TelegramAlertService,
  type TelegramInlineKeyboardMarkup,
} from '../notifications/telegram-alert.service';
import { TelegramBotConfigService } from './telegram-bot-config.service';
import {
  normalizeTelegramLanguage,
  renderTelegramCopy,
  type TelegramCopyId,
  type TelegramLanguage,
} from './telegram-i18n';
import {
  applyRtlGuard,
  escapeHtml,
  formatAmount,
  formatCount,
  formatDataSize,
  parseCardToCard,
} from './telegram-format';
import {
  TelegramSelfServiceProvisioner,
  type SelfServiceAccount,
} from './telegram-self-service';
import { createPendingTopupInTransaction, resolveTrialQuotaBytes } from './telegram-topup';
import {
  getTelegramUser,
  setTelegramUserLanguage,
  setTelegramUserState,
  type TelegramUserState,
} from './telegram-user-store';

/**
 * The afroWS self-service bot: a menu-driven, bilingual (Persian + English),
 * inline-keyboard conversational layer implementing docs/telegram-bot-flow-design.md
 * exactly — screens S0–S9, notifications N1/N2, error/empty states E1–E7, the
 * `afws:` callback namespace (§6.1), and the pending-charge state model (§5).
 *
 * Navigation is stateless: each callback_data fully identifies its target screen.
 * The only session state is the in-progress card-to-card charge, persisted in
 * telegram_users.state. Menu/error screens edit the originating message in place;
 * S1/S7/N1/N2 are new messages so the config and receipt trail persist in chat.
 */

const AWAITING_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CONFIGS_SHOWN = 5;
const MAX_PACKAGES_SHOWN = 8;

interface TelegramWebhookMessage {
  chatId: string;
  fromId?: string;
  username?: string;
  text?: string;
  photoFileId?: string;
  hasDocument?: boolean;
}

interface TelegramCallbackQuery {
  id: string;
  chatId: string;
  fromId?: string;
  username?: string;
  messageId?: number;
  data: string;
}

/** Delivery context: a callback carries the message to edit + query to answer. */
interface Ctx {
  chatId: string;
  fromId?: string;
  username?: string;
  messageId?: number;
  callbackId?: string;
}

@Injectable()
export class TelegramBotService {
  constructor(
    private readonly billing: BillingService,
    private readonly telegram: TelegramAlertService,
    private readonly telegramConfig: TelegramBotConfigService,
    private readonly database: DatabaseService,
  ) {}

  async isWebhookEnabled(): Promise<boolean> {
    try {
      return (await this.telegramConfig.getRuntimeConfig()).commandsEnabled;
    } catch {
      return false;
    }
  }

  async isWebhookConfigured(): Promise<boolean> {
    try {
      const runtime = await this.telegramConfig.getRuntimeConfig();
      return Boolean(runtime.webhookSecret && runtime.botToken);
    } catch {
      return false;
    }
  }

  async isWebhookSecretValid(value: string | undefined): Promise<boolean> {
    const expected = await this.webhookSecret();
    return telegramWebhookSecretMatches(expected, value);
  }

  /** Route an inbound update: button tap (callback_query) → photo/document → text. */
  async handleUpdate(payload: unknown): Promise<TelegramBotWebhookResponse> {
    const callback = this.extractCallbackQuery(payload);
    if (callback) {
      const ctx: Ctx = {
        chatId: callback.chatId,
        fromId: callback.fromId,
        username: callback.username,
        messageId: callback.messageId,
        callbackId: callback.id,
      };
      return this.guard(ctx, () => this.handleCallback(ctx, callback.data));
    }

    const message = this.extractMessage(payload);
    if (!message) return { ok: true, status: 'ignored', reason: 'unsupported_update' };

    const ctx: Ctx = { chatId: message.chatId, fromId: message.fromId, username: message.username };
    if (message.photoFileId) return this.guard(ctx, () => this.handlePhoto(ctx, message.photoFileId!));
    if (message.hasDocument) return this.guard(ctx, () => this.handleDocument(ctx));
    if (message.text) return this.guard(ctx, () => this.handleText(ctx, message.text!));

    return { ok: true, status: 'ignored', reason: 'unsupported_update' };
  }

  /** Wrap a handler so any failure renders E5 (generic error) instead of 500ing. */
  private async guard(ctx: Ctx, run: () => Promise<TelegramBotWebhookResponse>): Promise<TelegramBotWebhookResponse> {
    try {
      return await run();
    } catch {
      const language = await this.languageFor(ctx.fromId);
      return this.screen('E5', ctx, language, renderTelegramCopy('error.generic', language), this.errorGenericKeyboard(language));
    }
  }

  // --- Text / slash commands ------------------------------------------------

  private async handleText(ctx: Ctx, text: string): Promise<TelegramBotWebhookResponse> {
    // Any message from a user with no stored language → S0 language picker.
    if (ctx.fromId) {
      const user = await getTelegramUser(this.database, ctx.fromId);
      if (!user) return this.renderLanguagePicker(ctx);
    } else {
      return this.renderLanguagePicker(ctx);
    }

    const language = await this.languageFor(ctx.fromId);
    const command = this.parseSlash(text);
    switch (command) {
      case 'start':
        // Known user: ensure the account exists (idempotent) and greet them.
        await this.ensureAccount(ctx);
        return this.screenMenu(ctx, language, 'welcome.back');
      case 'menu':
        return this.screenMenu(ctx, language, 'menu.title');
      case 'status':
        return this.screenAccount(ctx, language);
      case 'charge':
        return this.screenBuy(ctx, language);
      case 'help':
        return this.screenHelp(ctx, language);
      case 'language':
        return this.screenLanguageSettings(ctx, language);
      case 'unknown':
        return this.screenUnknownCommand(ctx, language);
      default:
        // Non-command free text → main menu.
        return this.screenMenu(ctx, language, 'menu.title');
    }
  }

  // --- Callback queries -----------------------------------------------------

  private async handleCallback(ctx: Ctx, data: string): Promise<TelegramBotWebhookResponse> {
    if (!data.startsWith('afws:')) return this.staleButton(ctx);

    if (data === 'afws:lang:fa' || data === 'afws:lang:en') {
      return this.handleLanguagePick(ctx, data === 'afws:lang:fa' ? 'fa' : 'en');
    }

    const language = await this.languageFor(ctx.fromId);
    if (data.startsWith('afws:buy:pkg:')) {
      return this.handleBuyPick(ctx, language, data.slice('afws:buy:pkg:'.length));
    }

    switch (data) {
      case 'afws:menu':
        return this.screenMenu(ctx, language, 'menu.title');
      case 'afws:acct':
        return this.screenAccount(ctx, language);
      case 'afws:acct:refresh':
        return this.screenAccount(ctx, language, renderTelegramCopy('common.toast.refreshed', language));
      case 'afws:cfg':
        return this.screenConfigs(ctx, language);
      case 'afws:cfg:refresh':
        return this.screenConfigs(ctx, language, renderTelegramCopy('common.toast.refreshed', language));
      case 'afws:buy':
        return this.screenBuy(ctx, language);
      case 'afws:buy:cancel':
        return this.handleBuyCancel(ctx, language);
      case 'afws:lang':
        return this.screenLanguageSettings(ctx, language);
      case 'afws:help':
        return this.screenHelp(ctx, language);
      case 'afws:retry':
        // Stateless navigation → re-render the main menu.
        return this.screenMenu(ctx, language, 'menu.title');
      default:
        return this.staleButton(ctx);
    }
  }

  /** E7 — unknown/retired callback data: stale-button toast + a fresh main menu. */
  private async staleButton(ctx: Ctx): Promise<TelegramBotWebhookResponse> {
    const language = await this.languageFor(ctx.fromId);
    await this.answer(ctx, renderTelegramCopy('error.staleButton', language));
    return this.sendNew(ctx, language, renderTelegramCopy('menu.title', language), this.mainMenuKeyboard(language));
  }

  // --- Language (S0 pick / S8 settings) -------------------------------------

  private async renderLanguagePicker(ctx: Ctx): Promise<TelegramBotWebhookResponse> {
    // The prompt is the one intentionally bilingual message; render 'en' (identical for both).
    return this.sendNew(ctx, 'en', renderTelegramCopy('lang.prompt', 'en'), this.languagePickerKeyboard());
  }

  private async handleLanguagePick(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    if (!ctx.fromId) return this.renderLanguagePicker(ctx);
    const existing = await getTelegramUser(this.database, ctx.fromId);
    await setTelegramUserLanguage(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, language });

    if (existing) {
      // S8u — settings change: edit to lang.updated (in the new language) + menu.
      return this.screen(
        'S8u',
        ctx,
        language,
        renderTelegramCopy('lang.updated', language),
        this.menuOnlyKeyboard(language),
        renderTelegramCopy('lang.toast', language),
      );
    }

    // S0 → onboard: create the account (idempotent) then S1 (new) or S2 (edit).
    await this.answer(ctx);
    const result = await this.ensureAccount(ctx);
    if (result.created) return this.renderWelcome(ctx, language, result);
    return this.screen('S2', ctx, language, renderTelegramCopy('menu.title', language), this.mainMenuKeyboard(language));
  }

  private async screenLanguageSettings(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    return this.screen('S8', ctx, language, renderTelegramCopy('lang.settings', language), this.languageSettingsKeyboard(language));
  }

  // --- Onboarding (S1) ------------------------------------------------------

  private async renderWelcome(
    ctx: Ctx,
    language: TelegramLanguage,
    result: { account: SelfServiceAccount; entryLink: string | null },
  ): Promise<TelegramBotWebhookResponse> {
    const trialQuota = formatDataSize(result.account.quotaLimitBytes ?? 0, language);
    let text: string;
    let keyboard: TelegramInlineKeyboardMarkup;
    if (result.entryLink) {
      text = renderTelegramCopy('welcome.new', language, { configLink: result.entryLink }, { trialQuota });
      keyboard = {
        inline_keyboard: [
          [this.btn('buy.btn.open', language, 'afws:buy')],
          [this.btn('common.btn.menu', language, 'afws:menu')],
        ],
      };
    } else {
      text = renderTelegramCopy('welcome.newNoConfig', language, {}, { trialQuota });
      keyboard = {
        inline_keyboard: [
          [this.btn('cfg.btn.open', language, 'afws:cfg')],
          [this.btn('buy.btn.open', language, 'afws:buy')],
          [this.btn('common.btn.menu', language, 'afws:menu')],
        ],
      };
    }
    // S1 must persist in chat history — always a NEW message.
    return this.sendNew(ctx, language, text, keyboard);
  }

  // --- S2 Main menu ---------------------------------------------------------

  private async screenMenu(ctx: Ctx, language: TelegramLanguage, textId: TelegramCopyId): Promise<TelegramBotWebhookResponse> {
    return this.screen('S2', ctx, language, renderTelegramCopy(textId, language), this.mainMenuKeyboard(language));
  }

  // --- S3 My Account / E4 ---------------------------------------------------

  private async screenAccount(ctx: Ctx, language: TelegramLanguage, toast?: string): Promise<TelegramBotWebhookResponse> {
    const lookup = await this.billing.getTelegramBotAccountStatus({ telegramId: ctx.fromId, telegramUsername: ctx.username });
    if (lookup.status !== 'found') {
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }
    const text = this.accountCardText(lookup.account, language);
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [this.btn('common.btn.refresh', language, 'afws:acct:refresh')],
        [this.btn('menu.btn.buy', language, 'afws:buy')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
    return this.screen('S3', ctx, language, text, keyboard, toast);
  }

  private accountCardText(account: TelegramBotAccountSummary, language: TelegramLanguage): string {
    const status = renderTelegramCopy(this.statusCopyId(account.status), language);
    const quotaLine =
      account.quotaLimitBytes === null || account.quotaLimitBytes === undefined
        ? renderTelegramCopy('acct.quotaUnlimited', language)
        : renderTelegramCopy(
            'acct.quotaLine',
            language,
            {},
            {
              remaining: formatDataSize(account.remainingBytes ?? 0, language),
              total: formatDataSize(account.quotaLimitBytes, language),
            },
          );
    return renderTelegramCopy(
      'acct.card',
      language,
      {},
      {
        status,
        quotaLine,
        used: formatDataSize(account.usedBytes, language),
        activeClients: formatCount(account.activeClientCount, language),
        clientCount: formatCount(account.clientCount, language),
      },
    );
  }

  private statusCopyId(status: string): TelegramCopyId {
    switch (status) {
      case 'active':
        return 'status.active';
      case 'suspended':
        return 'status.suspended';
      case 'expired':
        return 'status.expired';
      case 'disabled':
        return 'status.disabled';
      default:
        return 'status.active';
    }
  }

  // --- S4 My Configs --------------------------------------------------------

  private async screenConfigs(ctx: Ctx, language: TelegramLanguage, toast?: string): Promise<TelegramBotWebhookResponse> {
    const lookup = await this.billing.getTelegramBotAccountStatus({ telegramId: ctx.fromId, telegramUsername: ctx.username });
    if (lookup.status !== 'found') {
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }

    const configs = await this.loadConfigs(lookup.account.id);
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [this.btn('common.btn.refresh', language, 'afws:cfg:refresh')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };

    if (!configs.items.length) {
      return this.screen('S4', ctx, language, renderTelegramCopy('cfg.empty', language), keyboard, toast);
    }

    const lines = [renderTelegramCopy('cfg.title', language)];
    for (const config of configs.items) {
      lines.push(renderTelegramCopy('cfg.itemHeader', language, { protocol: config.protocol, label: config.label }));
      lines.push(`<code>${escapeHtml(config.link)}</code>`);
    }
    if (configs.truncated) lines.push(renderTelegramCopy('cfg.truncated', language));
    lines.push(renderTelegramCopy('cfg.importHint', language));
    return this.screen('S4', ctx, language, lines.join('\n'), keyboard, toast);
  }

  private async loadConfigs(accountId: string): Promise<{ items: Array<{ protocol: string; label: string; link: string }>; truncated: boolean }> {
    const detail = await this.billing.getCustomerAccount(accountId);
    const active = detail.clientConfigs.filter((config) => config.status === 'active');
    const linked: Array<{ protocol: string; label: string; link: string }> = [];
    for (const config of active) {
      const { link } = await this.billing.getClientConfigEntryLink(config.id);
      if (link) linked.push({ protocol: config.protocol, label: config.label, link });
    }
    return { items: linked.slice(0, MAX_CONFIGS_SHOWN), truncated: linked.length > MAX_CONFIGS_SHOWN };
  }

  // --- S5 Buy / E1 / E2 -----------------------------------------------------

  private async screenBuy(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    const packages = await this.listActivePackages();
    if (!packages.length) {
      return this.screen('E1', ctx, language, renderTelegramCopy('error.noPackages', language), this.menuOnlyKeyboard(language));
    }

    const runtime = await this.telegramConfig.getRuntimeConfig();
    if (!runtime.cardToCardInfo) {
      return this.screen('E2', ctx, language, renderTelegramCopy('error.cardUnset', language), this.menuOnlyKeyboard(language));
    }

    // Resume an in-progress charge directly on S6.
    if (ctx.fromId) {
      const user = await getTelegramUser(this.database, ctx.fromId);
      const pending = this.awaitingCharge(user?.state);
      if (pending) {
        const pkg = packages.find((entry) => entry.id === pending.pendingPackageId);
        if (pkg) {
          const note = renderTelegramCopy('buy.resumeNote', language);
          return this.screen('S6', ctx, language, `${note}\n\n${this.paymentText(pkg, language, runtime.cardToCardInfo)}`, this.paymentKeyboard(language));
        }
        // Package no longer available → drop the stale pending charge.
        await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state: null });
      }
    }

    const rows: TelegramInlineKeyboardMarkup['inline_keyboard'] = packages.slice(0, MAX_PACKAGES_SHOWN).map((pkg) => [
      {
        text: renderTelegramCopy(
          'buy.pkgBtn',
          language,
          {},
          { size: formatDataSize(pkg.volumeBytes, language), price: formatAmount(pkg.totalPrice, pkg.currency, language) },
        ),
        callback_data: `afws:buy:pkg:${pkg.id}`,
      },
    ]);
    rows.push([this.btn('common.btn.menu', language, 'afws:menu')]);

    let text = renderTelegramCopy('buy.pickPackage', language);
    const pendingRef = ctx.fromId ? await this.latestPendingTopupReference(ctx.fromId) : null;
    if (pendingRef) {
      text = `${renderTelegramCopy('buy.pendingApprovalNote', language, { requestId: pendingRef })}\n\n${text}`;
    }
    return this.screen('S5', ctx, language, text, { inline_keyboard: rows });
  }

  // --- S6 Payment / S6c cancel ----------------------------------------------

  private async handleBuyPick(ctx: Ctx, language: TelegramLanguage, packageId: string): Promise<TelegramBotWebhookResponse> {
    if (!ctx.fromId || !packageId) return this.screenBuy(ctx, language);

    const runtime = await this.telegramConfig.getRuntimeConfig();
    if (!runtime.cardToCardInfo) {
      return this.screen('E2', ctx, language, renderTelegramCopy('error.cardUnset', language), this.menuOnlyKeyboard(language));
    }

    const packages = await this.listActivePackages();
    const pkg = packages.find((entry) => entry.id === packageId);
    if (!pkg) return this.screenBuy(ctx, language);

    // Persist the in-progress charge (overwrites any previous one).
    await setTelegramUserState(this.database, {
      telegramId: ctx.fromId,
      chatId: ctx.chatId,
      state: {
        pendingPackageId: pkg.id,
        pendingAmountMinor: pkg.totalPrice,
        pendingCurrency: pkg.currency,
        pendingStartedAt: new Date().toISOString(),
      },
    });

    return this.screen('S6', ctx, language, this.paymentText(pkg, language, runtime.cardToCardInfo), this.paymentKeyboard(language));
  }

  private paymentText(pkg: AdminVolumePackageSummary, language: TelegramLanguage, cardInfo: string): string {
    const card = parseCardToCard(cardInfo);
    return renderTelegramCopy(
      'buy.payment',
      language,
      { cardNumber: card.cardNumber, cardHolder: card.cardHolder },
      {
        packageSize: formatDataSize(pkg.volumeBytes, language),
        amount: formatAmount(pkg.totalPrice, pkg.currency, language),
      },
    );
  }

  private async handleBuyCancel(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    if (ctx.fromId) {
      await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state: null });
    }
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [this.btn('buy.btn.open', language, 'afws:buy')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
    return this.screen('S6c', ctx, language, renderTelegramCopy('buy.cancelled', language), keyboard, renderTelegramCopy('buy.toast.cancelled', language));
  }

  // --- S7 Receipt / E3 / buy.needPhoto --------------------------------------

  private async handlePhoto(ctx: Ctx, photoFileId: string): Promise<TelegramBotWebhookResponse> {
    if (!ctx.fromId) return this.renderLanguagePicker(ctx);
    const user = await getTelegramUser(this.database, ctx.fromId);
    if (!user) return this.renderLanguagePicker(ctx);

    const language = user.language;
    const pending = this.awaitingCharge(user.state);
    if (!pending) {
      return this.screen('E3', ctx, language, renderTelegramCopy('error.photoNoCharge', language), this.errorPhotoKeyboard(language));
    }

    // Create the pending top-up row now (status=pending, with the receipt file id),
    // then clear the in-progress charge.
    const result = await this.ensureAccount(ctx);
    const created = await this.database.transaction((executor) =>
      createPendingTopupInTransaction(executor, {
        customerAccountId: result.account.id,
        telegramId: ctx.fromId ?? null,
        telegramChatId: ctx.chatId,
        volumePackageId: pending.pendingPackageId!,
        amountMinor: pending.pendingAmountMinor ?? null,
        currency: pending.pendingCurrency ?? null,
        receiptFileId: photoFileId,
      }),
    );
    await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state: null });

    // S7 is a NEW message (receipt trail).
    return this.sendNew(
      ctx,
      language,
      renderTelegramCopy('buy.submitted', language, { requestId: created.reference }),
      this.menuOnlyKeyboard(language),
    );
  }

  private async handleDocument(ctx: Ctx): Promise<TelegramBotWebhookResponse> {
    if (!ctx.fromId) return this.renderLanguagePicker(ctx);
    const user = await getTelegramUser(this.database, ctx.fromId);
    if (!user) return this.renderLanguagePicker(ctx);

    // A file (document) while awaiting a receipt → ask for a photo, keep the state.
    if (this.awaitingCharge(user.state)) {
      return this.sendNew(ctx, user.language, renderTelegramCopy('buy.needPhoto', user.language), this.paymentKeyboard(user.language));
    }
    return { ok: true, status: 'ignored', reason: 'unsupported_update' };
  }

  // --- S9 Help / E6 ---------------------------------------------------------

  private async screenHelp(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    return this.screen('S9', ctx, language, await this.helpText(language), this.helpKeyboard(language));
  }

  private async screenUnknownCommand(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    const text = `${renderTelegramCopy('error.unknownCommand', language)}\n\n${await this.helpText(language)}`;
    return this.screen('E6', ctx, language, text, this.helpKeyboard(language));
  }

  private async helpText(language: TelegramLanguage): Promise<string> {
    const support = await this.supportContact();
    if (support) return renderTelegramCopy('help.body', language, { supportContact: support });

    // Support unset (docs §2-S9): drop the trailing support line and its blank gap.
    const lines = renderTelegramCopy('help.body', language, {}, { supportContact: '' }).split('\n');
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.pop(); // the "Support: " / "پشتیبانی: " line
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    return lines.join('\n');
  }

  private async supportContact(): Promise<string | null> {
    // No dedicated setting yet (docs §8 open question); support line is dropped until configured.
    return null;
  }

  // --- Account provisioning (idempotent self-serve) -------------------------

  private async ensureAccount(ctx: Ctx) {
    const trialQuotaBytes = resolveTrialQuotaBytes(await this.safeRuntimeTrialBytes());
    const provisioner = new TelegramSelfServiceProvisioner({
      findAccountByTelegramId: (telegramId) => this.findAccountByTelegramId(telegramId),
      createAccount: (input) => this.createSelfServeAccount(input),
      createVlessConfig: async (accountId) => {
        const config = await this.billing.createClientConfig(accountId, { protocol: 'vless' }, undefined);
        return { id: config.id };
      },
      getEntryLink: async (configId) => (await this.billing.getClientConfigEntryLink(configId)).link,
      findPrimaryVlessConfigId: (accountId) => this.findPrimaryVlessConfigId(accountId),
    });
    return provisioner.ensureAccount(
      { telegramId: ctx.fromId ?? '', telegramUsername: ctx.username, telegramChatId: ctx.chatId },
      trialQuotaBytes,
    );
  }

  private async createSelfServeAccount(input: {
    telegramId: string;
    telegramUsername: string | null;
    quotaLimitBytes: number;
  }): Promise<SelfServiceAccount> {
    const detail = await this.billing.createCustomerAccount(
      {
        telegramId: input.telegramId,
        telegramUsername: input.telegramUsername ?? undefined,
        status: 'active',
        quotaScope: 'account_shared',
        quotaLimitBytes: input.quotaLimitBytes,
        egressTier: 'normal',
      },
      undefined,
    );
    return {
      id: detail.id,
      displayName: detail.displayName,
      status: detail.status,
      quotaLimitBytes: detail.quotaLimitBytes,
      telegramId: detail.telegramId,
    };
  }

  private async findAccountByTelegramId(telegramId: string): Promise<SelfServiceAccount | null> {
    if (!telegramId) return null;
    const lookup = await this.billing.getTelegramBotAccountStatus({ telegramId });
    if (lookup.status !== 'found') return null;
    const account = lookup.account;
    return {
      id: account.id,
      displayName: account.displayName,
      status: account.status,
      quotaLimitBytes: account.quotaLimitBytes,
      telegramId,
    };
  }

  private async findPrimaryVlessConfigId(accountId: string): Promise<string | null> {
    const result = await this.database.query<{ id: string }>(
      `
        SELECT id FROM client_configs
        WHERE customer_account_id = $1 AND lower(protocol) = 'vless'
        ORDER BY created_at ASC
        LIMIT 1
      `,
      [accountId],
    );
    return result.rows[0]?.id ?? null;
  }

  private async latestPendingTopupReference(telegramId: string): Promise<string | null> {
    const result = await this.database.query<{ id: string }>(
      `
        SELECT id FROM telegram_topup_requests
        WHERE telegram_id = $1 AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [telegramId],
    );
    const id = result.rows[0]?.id;
    return id ? id.replace(/-/g, '').slice(0, 6).toUpperCase() : null;
  }

  // --- Keyboards ------------------------------------------------------------

  private btn(id: TelegramCopyId, language: TelegramLanguage, data: string) {
    return { text: renderTelegramCopy(id, language), callback_data: data };
  }

  private mainMenuKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [this.btn('menu.btn.account', language, 'afws:acct'), this.btn('menu.btn.buy', language, 'afws:buy')],
        [this.btn('menu.btn.configs', language, 'afws:cfg')],
        [this.btn('menu.btn.lang', language, 'afws:lang'), this.btn('menu.btn.help', language, 'afws:help')],
      ],
    };
  }

  private languagePickerKeyboard(): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [this.btn('lang.btn.fa', 'fa', 'afws:lang:fa'), this.btn('lang.btn.en', 'en', 'afws:lang:en')],
      ],
    };
  }

  private languageSettingsKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [this.btn('lang.btn.fa', language, 'afws:lang:fa'), this.btn('lang.btn.en', language, 'afws:lang:en')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
  }

  private paymentKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [this.btn('buy.btn.cancel', language, 'afws:buy:cancel')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
  }

  private helpKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [this.btn('menu.btn.buy', language, 'afws:buy'), this.btn('menu.btn.account', language, 'afws:acct')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
  }

  private menuOnlyKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return { inline_keyboard: [[this.btn('common.btn.menu', language, 'afws:menu')]] };
  }

  private errorPhotoKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [this.btn('buy.btn.open', language, 'afws:buy')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
  }

  private errorGenericKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [this.btn('common.btn.retry', language, 'afws:retry')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
  }

  // --- Delivery -------------------------------------------------------------

  /**
   * Render a navigation screen: answer the callback (with optional toast), then
   * edit the originating message in place, falling back to a new message when the
   * edit fails (message too old/gone). For non-callback entries, send new.
   * `_screenId` is documentation-only (maps to the design's S/E ids).
   */
  private async screen(
    _screenId: string,
    ctx: Ctx,
    language: TelegramLanguage,
    text: string,
    keyboard: TelegramInlineKeyboardMarkup,
    toast?: string,
  ): Promise<TelegramBotWebhookResponse> {
    const body = applyRtlGuard(text, language);
    if (ctx.callbackId) await this.answer(ctx, toast);

    if (ctx.messageId) {
      const edited = await this.telegram.editMessageText(ctx.chatId, ctx.messageId, body, {
        parseMode: 'HTML',
        disableWebPagePreview: true,
        replyMarkup: keyboard,
      });
      if (edited.status === 'edited' || edited.status === 'unchanged') return { ok: true, status: 'sent' };
      // Fall through to a fresh message when the edit could not be applied.
    }
    return this.rawSend(ctx.chatId, body, keyboard);
  }

  /** Send a brand-new message (S1/S7/N-style, or fallbacks); answers the callback first. */
  private async sendNew(
    ctx: Ctx,
    language: TelegramLanguage,
    text: string,
    keyboard: TelegramInlineKeyboardMarkup,
    toast?: string,
  ): Promise<TelegramBotWebhookResponse> {
    if (ctx.callbackId) await this.answer(ctx, toast);
    return this.rawSend(ctx.chatId, applyRtlGuard(text, language), keyboard);
  }

  private async rawSend(chatId: string, text: string, keyboard: TelegramInlineKeyboardMarkup): Promise<TelegramBotWebhookResponse> {
    const result = await this.telegram.sendMessage(chatId, text, {
      parseMode: 'HTML',
      disableWebPagePreview: true,
      replyMarkup: keyboard,
    });
    if (result.status === 'sent') return { ok: true, status: 'sent' };
    return { ok: false, status: 'failed', reason: result.reason };
  }

  private async answer(ctx: Ctx, toast?: string): Promise<void> {
    if (ctx.callbackId) await this.telegram.answerCallbackQuery(ctx.callbackId, toast ? { text: toast } : {});
  }

  // --- Helpers --------------------------------------------------------------

  private awaitingCharge(state: TelegramUserState | null | undefined): TelegramUserState | null {
    if (!state?.pendingPackageId || !state.pendingStartedAt) return null;
    const startedAt = Date.parse(state.pendingStartedAt);
    if (!Number.isFinite(startedAt) || Date.now() - startedAt >= AWAITING_RECEIPT_TTL_MS) return null;
    return state;
  }

  private async listActivePackages(): Promise<AdminVolumePackageSummary[]> {
    const packages = await this.billing.listVolumePackages({ status: 'active', limit: 50 });
    // Sorted by size ascending (docs §2-S5).
    return [...packages].sort((a, b) => a.volumeBytes - b.volumeBytes);
  }

  private async languageFor(telegramId: string | undefined): Promise<TelegramLanguage> {
    if (!telegramId) return 'fa';
    const user = await getTelegramUser(this.database, telegramId);
    return normalizeTelegramLanguage(user?.language);
  }

  private async safeRuntimeTrialBytes(): Promise<number | null> {
    try {
      return (await this.telegramConfig.getRuntimeConfig()).trialQuotaBytes;
    } catch {
      return null;
    }
  }

  // --- Parsing --------------------------------------------------------------

  private parseSlash(text: string): 'start' | 'menu' | 'status' | 'charge' | 'help' | 'language' | 'unknown' | null {
    if (!text.startsWith('/')) return null;
    const [token] = text.split(/\s+/, 1);
    const [name] = token.slice(1).split('@', 1);
    switch (name.toLowerCase()) {
      case 'start':
        return 'start';
      case 'menu':
        return 'menu';
      case 'status':
      case 'usage':
      case 'quota':
        return 'status';
      case 'charge':
        return 'charge';
      case 'help':
        return 'help';
      case 'language':
        return 'language';
      default:
        return 'unknown';
    }
  }

  private extractMessage(payload: unknown): TelegramWebhookMessage | null {
    const update = this.asRecord(payload);
    const rawMessage = this.asRecord(update.message);
    const chat = this.asRecord(rawMessage.chat);
    const from = this.asRecord(rawMessage.from);
    const chatId = this.toNonEmptyString(chat.id);

    if (!chatId || from.is_bot === true) return null;

    const text = typeof rawMessage.text === 'string' ? rawMessage.text.trim() : undefined;
    const photoFileId = this.highestResolutionPhotoId(rawMessage.photo);
    const hasDocument = Boolean(rawMessage.document);
    if (!text && !photoFileId && !hasDocument) return null;

    return {
      chatId,
      fromId: this.toNonEmptyString(from.id),
      username: typeof from.username === 'string' ? from.username : undefined,
      text: text || undefined,
      photoFileId,
      hasDocument,
    };
  }

  private extractCallbackQuery(payload: unknown): TelegramCallbackQuery | null {
    const update = this.asRecord(payload);
    const callback = this.asRecord(update.callback_query);
    const id = this.toNonEmptyString(callback.id);
    const data = typeof callback.data === 'string' ? callback.data.trim() : '';
    const from = this.asRecord(callback.from);
    const message = this.asRecord(callback.message);
    const chat = this.asRecord(message.chat);
    const chatId = this.toNonEmptyString(chat.id);

    if (!id || !data || !chatId || from.is_bot === true) return null;

    const messageId = Number(message.message_id);
    return {
      id,
      chatId,
      fromId: this.toNonEmptyString(from.id),
      username: typeof from.username === 'string' ? from.username : undefined,
      messageId: Number.isInteger(messageId) ? messageId : undefined,
      data,
    };
  }

  /** Telegram sends an array of PhotoSize; pick the highest-resolution file_id. */
  private highestResolutionPhotoId(photo: unknown): string | undefined {
    if (!Array.isArray(photo) || !photo.length) return undefined;
    let best: { fileId: string; area: number } | null = null;
    for (const entry of photo) {
      const size = this.asRecord(entry);
      const fileId = this.toNonEmptyString(size.file_id);
      if (!fileId) continue;
      const width = Number(size.width) || 0;
      const height = Number(size.height) || 0;
      const area = width * height;
      if (!best || area >= best.area) best = { fileId, area };
    }
    return best?.fileId;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private toNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;
    const normalized = String(value).trim();
    return normalized || undefined;
  }

  private async webhookSecret(): Promise<string | undefined> {
    try {
      return (await this.telegramConfig.getRuntimeConfig()).webhookSecret;
    } catch {
      return undefined;
    }
  }
}
