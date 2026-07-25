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
  type TelegramReplyKeyboardMarkup,
  type TelegramReplyMarkup,
} from '../notifications/telegram-alert.service';
import { TelegramBotConfigService, GEM_ECONOMY_DEFAULTS, type TelegramGemEconomy } from './telegram-bot-config.service';
import {
  normalizeTelegramLanguage,
  renderTelegramCopy,
  type TelegramCopyId,
  type TelegramLanguage,
} from './telegram-i18n';
import {
  applyRtlGuard,
  buildConfigLabel,
  escapeHtml,
  formatAmount,
  formatCount,
  formatDataSize,
  formatGemsGb,
  formatShortDate,
  formatSignedGems,
  normalizePhoneDigits,
  parseCardToCard,
  usagePercent,
  usageProgressBar,
} from './telegram-format';
import {
  TelegramSelfServiceProvisioner,
  type ReferralAttribution,
  type RegisterResult,
  type SelfServiceAccount,
} from './telegram-self-service';
import { createPendingTopupInTransaction } from './telegram-topup';
import {
  getTelegramUser,
  setTelegramUserLanguage,
  setTelegramUserState,
  type TelegramUserRecord,
  type TelegramUserState,
} from './telegram-user-store';

/**
 * The afroWS self-service bot (v2): a menu-driven, bilingual (Persian + English),
 * inline-keyboard conversational layer implementing docs/telegram-bot-flow-design.md
 * §§1–14 — v1 screens S0–S9/N1/N2/E1–E7 plus the v2 registration (R1/R2), usage-first
 * account home (S3h/S3v2), Invite & Earn (S10), Gems wallet + redeem (S11/S12/S12c/
 * S12r/G1), and referral notifications (N3/N4/N5).
 *
 * Navigation is stateless: each callback_data fully identifies its target screen.
 * The only session state is the registration progress + captured referral code and
 * the in-progress card-to-card charge (mutually exclusive), persisted in
 * telegram_users.state. Menu/error screens edit the originating message in place;
 * S1v2, S7, N3–N5 and S12r are new messages so the config + receipt trail persist.
 */

const AWAITING_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CONFIGS_SHOWN = 5;
const MAX_PACKAGES_SHOWN = 8;
const MAX_GEMS_HISTORY = 5;
const REDEEM_GB_OPTIONS = [1, 2, 5, 10];
const DEFAULT_BOT_USERNAME = 'Afrows_bot';

interface TelegramWebhookMessage {
  chatId: string;
  fromId?: string;
  username?: string;
  text?: string;
  photoFileId?: string;
  hasDocument?: boolean;
  contact?: { phoneNumber: string; userId?: string };
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

  /** Route an inbound update: button tap → contact → photo/document → text. */
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
    if (message.contact) return this.guard(ctx, () => this.handleContact(ctx, message.contact!));
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

  private async handleText(ctx: Ctx, rawText: string): Promise<TelegramBotWebhookResponse> {
    if (!ctx.fromId) return this.renderLanguagePicker(ctx);
    const { command, payload } = this.parseCommand(rawText);
    const user = await getTelegramUser(this.database, ctx.fromId);

    // Language gate: no row, or a row that only holds a captured referral code.
    if (!user || user.language === null) {
      if (command === 'start' && payload) await this.captureReferral(ctx, user, payload);
      return this.renderLanguagePicker(ctx);
    }

    const language = user.language;

    // Registration owns the session: text belongs to the current step.
    if (user.state?.regStage === 'awaiting_name') {
      return this.handleNameInput(ctx, language, user, rawText);
    }
    if (user.state?.regStage === 'awaiting_phone') {
      // Any typed text (incl. a typed number or a slash command) → use the button.
      return this.sendReply(ctx, language, renderTelegramCopy('reg.phoneNeedButton', language), this.sharePhoneKeyboard(language));
    }

    // Language chosen: does the user have an account yet?
    const account = await this.findAccount(ctx);
    if (!account) {
      if (command === 'start' && payload) await this.captureReferral(ctx, user, payload);
      const refreshed = (await getTelegramUser(this.database, ctx.fromId)) ?? user;
      return this.beginRegistration(ctx, language, refreshed);
    }

    switch (command) {
      case 'start':
        return this.screenHome(ctx, language, account);
      case 'menu':
        return this.screenMenu(ctx, language, 'menu.title');
      case 'status':
        return this.screenAccount(ctx, language);
      case 'charge':
        return this.screenBuy(ctx, language);
      case 'invite':
        return this.screenInvite(ctx, language);
      case 'gems':
        return this.screenGems(ctx, language);
      case 'help':
        return this.screenHelp(ctx, language);
      case 'language':
        return this.screenLanguageSettings(ctx, language);
      case 'unknown':
        return this.screenUnknownCommand(ctx, language);
      default:
        return this.screenMenu(ctx, language, 'menu.title');
    }
  }

  // --- Callback queries -----------------------------------------------------

  private async handleCallback(ctx: Ctx, data: string): Promise<TelegramBotWebhookResponse> {
    if (!data.startsWith('afws:')) return this.staleButton(ctx);

    if (data === 'afws:lang:fa' || data === 'afws:lang:en') {
      return this.handleLanguagePick(ctx, data === 'afws:lang:fa' ? 'fa' : 'en');
    }

    const user = ctx.fromId ? await getTelegramUser(this.database, ctx.fromId) : null;
    if (!user || user.language === null) return this.staleButton(ctx);
    const language = user.language;

    // Registration is inescapable: any other button re-prompts the current step.
    if (user.state?.regStage) {
      await this.answer(ctx, renderTelegramCopy('reg.finishFirst', language));
      return this.reSendRegistrationStep(ctx, language, user);
    }

    if (data.startsWith('afws:buy:pkg:')) {
      return this.handleBuyPick(ctx, language, data.slice('afws:buy:pkg:'.length));
    }
    if (data === 'afws:gems' || data === 'afws:gems:refresh') {
      return this.screenGems(ctx, language, data === 'afws:gems:refresh' ? renderTelegramCopy('common.toast.refreshed', language) : undefined);
    }
    if (data.startsWith('afws:gems:redeem')) {
      return this.handleGemsRedeem(ctx, language, data);
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
      case 'afws:invite':
        return this.screenInvite(ctx, language);
      case 'afws:invite:refresh':
        return this.screenInvite(ctx, language, renderTelegramCopy('common.toast.refreshed', language));
      case 'afws:lang':
        return this.screenLanguageSettings(ctx, language);
      case 'afws:help':
        return this.screenHelp(ctx, language);
      case 'afws:retry':
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
    return this.sendNew(ctx, 'en', renderTelegramCopy('lang.prompt', 'en'), this.languagePickerKeyboard());
  }

  private async handleLanguagePick(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    if (!ctx.fromId) return this.renderLanguagePicker(ctx);
    const existing = await getTelegramUser(this.database, ctx.fromId);
    const hadLanguage = existing?.language != null;
    await setTelegramUserLanguage(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, language });

    if (hadLanguage) {
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

    // First language pick → onboard.
    await this.answer(ctx);
    const account = await this.findAccount(ctx);
    if (account) return this.screenHome(ctx, language, account);

    const user = (await getTelegramUser(this.database, ctx.fromId)) ?? existing;
    return this.beginRegistration(ctx, language, user ?? { telegramId: ctx.fromId, chatId: ctx.chatId, language, state: null });
  }

  private async screenLanguageSettings(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    return this.screen('S8', ctx, language, renderTelegramCopy('lang.settings', language), this.languageSettingsKeyboard(language));
  }

  // --- Registration (R1 name / R2 phone) ------------------------------------

  private async captureReferral(ctx: Ctx, user: TelegramUserRecord | null, payload: string): Promise<void> {
    if (!ctx.fromId) return;
    const code = payload.trim().slice(0, 64);
    if (!code) return;
    // A registered account never re-captures a referral (one inviter, ever).
    const existingAccount = await this.findAccount(ctx);
    if (existingAccount) return;
    const state: TelegramUserState = { ...(user?.state ?? {}), referralCode: code };
    await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state });
  }

  private async beginRegistration(
    ctx: Ctx,
    language: TelegramLanguage,
    user: TelegramUserRecord,
  ): Promise<TelegramBotWebhookResponse> {
    // Resume the phone step if a name was already captured.
    if (user.state?.regStage === 'awaiting_phone' && user.state.regName) {
      return this.renderAskPhone(ctx, language);
    }
    await this.mergeState(ctx, user, { regStage: 'awaiting_name' });
    const viaInvite = user.state?.referralCode ? `${renderTelegramCopy('reg.viaInvite', language)}\n\n` : '';
    return this.sendNew(ctx, language, `${viaInvite}${renderTelegramCopy('reg.askName', language)}`);
  }

  private async handleNameInput(
    ctx: Ctx,
    language: TelegramLanguage,
    user: TelegramUserRecord,
    rawText: string,
  ): Promise<TelegramBotWebhookResponse> {
    const name = rawText.trim();
    const valid = name.length >= 2 && name.length <= 40 && /\p{L}/u.test(name) && !name.startsWith('/');
    if (!valid) {
      await this.sendNew(ctx, language, renderTelegramCopy('reg.nameInvalid', language));
      return this.sendNew(ctx, language, renderTelegramCopy('reg.askName', language));
    }
    await this.mergeState(ctx, user, { regStage: 'awaiting_phone', regName: name });
    return this.renderAskPhone(ctx, language);
  }

  private async renderAskPhone(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    return this.sendReply(ctx, language, renderTelegramCopy('reg.askPhone', language), this.sharePhoneKeyboard(language));
  }

  private async reSendRegistrationStep(
    ctx: Ctx,
    language: TelegramLanguage,
    user: TelegramUserRecord,
  ): Promise<TelegramBotWebhookResponse> {
    if (user.state?.regStage === 'awaiting_phone') return this.renderAskPhone(ctx, language);
    return this.sendNew(ctx, language, renderTelegramCopy('reg.askName', language));
  }

  private async handleContact(
    ctx: Ctx,
    contact: { phoneNumber: string; userId?: string },
  ): Promise<TelegramBotWebhookResponse> {
    if (!ctx.fromId) return this.renderLanguagePicker(ctx);
    const user = await getTelegramUser(this.database, ctx.fromId);
    if (!user || user.language === null) return this.renderLanguagePicker(ctx);
    const language = user.language;

    if (user.state?.regStage !== 'awaiting_phone') {
      // Unexpected contact — route by account state.
      const account = await this.findAccount(ctx);
      if (account) return this.screenMenu(ctx, language, 'menu.title');
      return this.beginRegistration(ctx, language, user);
    }

    // Ownership guard: accept only the user's own shared contact.
    if (!contact.userId || String(contact.userId) !== ctx.fromId) {
      return this.sendReply(ctx, language, renderTelegramCopy('reg.phoneNotYours', language), this.sharePhoneKeyboard(language));
    }

    const phone = normalizePhoneDigits(contact.phoneNumber);
    const name = user.state.regName ?? 'friend';

    // Reply → inline hand-off: remove the reply keyboard, create the account, welcome.
    await this.sendRemoveKeyboard(ctx, language, renderTelegramCopy('reg.phoneOk', language, { name }));

    const result = await this.registerAccount(ctx, { displayName: name, phone, referralCode: user.state.referralCode ?? null });
    await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state: null });

    if (result.referral) await this.notifyInviterJoined(result.referral);

    return this.renderWelcomeRegistered(ctx, language, name, result);
  }

  private async renderWelcomeRegistered(
    ctx: Ctx,
    language: TelegramLanguage,
    name: string,
    result: RegisterResult,
  ): Promise<TelegramBotWebhookResponse> {
    if (result.entryLink) {
      const text = renderTelegramCopy('welcome.registered', language, {
        name,
        configLabel: result.configLabel ?? '',
        configLink: result.entryLink,
      });
      const keyboard: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          [this.btn('buy.btn.open', language, 'afws:buy')],
          [this.btn('menu.btn.invite', language, 'afws:invite')],
          [this.btn('common.btn.menu', language, 'afws:menu')],
        ],
      };
      return this.sendNew(ctx, language, text, keyboard);
    }
    const text = renderTelegramCopy('welcome.registeredNoConfig', language, { name });
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [this.btn('cfg.btn.open', language, 'afws:cfg')],
        [this.btn('buy.btn.open', language, 'afws:buy')],
        [this.btn('menu.btn.invite', language, 'afws:invite')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
    return this.sendNew(ctx, language, text, keyboard);
  }

  // --- S2 Main menu ---------------------------------------------------------

  private async screenMenu(ctx: Ctx, language: TelegramLanguage, textId: TelegramCopyId): Promise<TelegramBotWebhookResponse> {
    return this.screen('S2', ctx, language, renderTelegramCopy(textId, language), this.mainMenuKeyboard(language));
  }

  // --- S3v2 My Account / S3h home / E4 --------------------------------------

  /** S3h home: usage-first, greeted (only from /start for a registered user). */
  private async screenHome(ctx: Ctx, language: TelegramLanguage, account: TelegramBotAccountSummary): Promise<TelegramBotWebhookResponse> {
    const card = await this.accountCardText(account, language);
    const text = `${renderTelegramCopy('welcome.back', language)}\n\n${card}`;
    return this.screen('S3h', ctx, language, text, this.accountKeyboard(language));
  }

  private async screenAccount(ctx: Ctx, language: TelegramLanguage, toast?: string): Promise<TelegramBotWebhookResponse> {
    const account = await this.findAccount(ctx);
    if (!account) {
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }
    return this.screen('S3v2', ctx, language, await this.accountCardText(account, language), this.accountKeyboard(language), toast);
  }

  private async accountCardText(account: TelegramBotAccountSummary, language: TelegramLanguage): Promise<string> {
    const economy = await this.gemEconomy();
    const status = renderTelegramCopy(this.statusCopyId(account.status), language);
    const used = account.usedBytes;
    const quota = account.quotaLimitBytes;

    let usageBlock: string;
    if (quota === null || quota === undefined) {
      usageBlock = renderTelegramCopy('usage.unlimited', language, {}, { used: formatDataSize(used, language) });
    } else if (quota <= 0) {
      usageBlock = renderTelegramCopy('usage.zeroData', language);
    } else {
      const percent = usagePercent(used, quota);
      usageBlock = renderTelegramCopy(
        'usage.line',
        language,
        {},
        {
          bar: usageProgressBar(percent, used),
          percent: formatCount(percent, language),
          used: formatDataSize(used, language),
          total: formatDataSize(quota, language),
          remaining: formatDataSize(account.remainingBytes ?? 0, language),
        },
      );
    }

    const gems = account.gemsBalance ?? 0;
    const gemsLine = renderTelegramCopy(
      'acct.gemsLine',
      language,
      {},
      { gems: formatCount(gems, language), gemsGb: formatGemsGb(gems, economy.gemRedeemPerGb, language) },
    );

    return renderTelegramCopy(
      'acct.cardV2',
      language,
      { name: account.displayName ?? '' },
      {
        status,
        usageBlock,
        gemsLine,
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

  // --- S10 Invite & Earn ----------------------------------------------------

  private async screenInvite(ctx: Ctx, language: TelegramLanguage, toast?: string): Promise<TelegramBotWebhookResponse> {
    const account = await this.findAccount(ctx);
    if (!account) {
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }

    const economy = await this.gemEconomy();
    const inviteCode = account.referralCode ?? (await this.billing.ensureAccountReferralCode(account.id));
    const inviteLink = `https://t.me/${await this.botUsername()}?start=${inviteCode}`;
    const gemsEarned = await this.billing.getReferralGemsEarned(account.id);

    const text = renderTelegramCopy(
      'invite.card',
      language,
      { inviteCode, inviteLink },
      {
        signupBonus: formatCount(economy.gemReferralSignup, language),
        pct: formatCount(economy.gemReferralPurchasePct, language),
        milestoneBonus: formatCount(economy.gemMilestoneBonus, language),
        milestoneCount: formatCount(economy.gemMilestoneEvery, language),
        referralCount: formatCount(account.referralCount ?? 0, language),
        gemsEarned: formatCount(gemsEarned, language),
      },
    );

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(
      renderTelegramCopy('invite.shareText', language),
    )}`;
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [{ text: renderTelegramCopy('invite.btn.share', language), url: shareUrl }],
        [this.btn('common.btn.refresh', language, 'afws:invite:refresh')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
    return this.screen('S10', ctx, language, text, keyboard, toast);
  }

  // --- S11 Gems wallet ------------------------------------------------------

  private async screenGems(ctx: Ctx, language: TelegramLanguage, toast?: string): Promise<TelegramBotWebhookResponse> {
    const account = await this.findAccount(ctx);
    if (!account) {
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }
    const economy = await this.gemEconomy();
    const gems = account.gemsBalance ?? 0;
    const history = await this.gemsHistoryText(account.id, language);

    const text = renderTelegramCopy(
      'gems.card',
      language,
      {},
      {
        gems: formatCount(gems, language),
        gemsGb: formatGemsGb(gems, economy.gemRedeemPerGb, language),
        rateGems: formatCount(economy.gemRedeemPerGb, language),
        history,
      },
    );
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [this.btn('gems.btn.redeem', language, 'afws:gems:redeem')],
        [this.btn('menu.btn.invite', language, 'afws:invite')],
        [this.btn('common.btn.refresh', language, 'afws:gems:refresh'), this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
    return this.screen('S11', ctx, language, text, keyboard, toast);
  }

  private async gemsHistoryText(accountId: string, language: TelegramLanguage): Promise<string> {
    const entries = await this.billing.getCustomerGemsLedger(accountId, MAX_GEMS_HISTORY);
    if (!entries.length) return renderTelegramCopy('gems.historyEmpty', language);
    const lines = [renderTelegramCopy('gems.historyTitle', language)];
    for (const entry of entries) {
      lines.push(
        renderTelegramCopy(
          'gems.historyItem',
          language,
          {},
          {
            date: formatShortDate(entry.createdAt, language),
            delta: formatSignedGems(entry.delta, language),
            reason: renderTelegramCopy(this.gemsReasonCopyId(entry.reason), language),
          },
        ),
      );
    }
    return lines.join('\n');
  }

  private gemsReasonCopyId(reason: string): TelegramCopyId {
    switch (reason) {
      case 'referral_signup':
        return 'gems.reason.signup';
      case 'referral_commission':
        return 'gems.reason.commission';
      case 'referral_milestone':
        return 'gems.reason.milestone';
      case 'redeem':
        return 'gems.reason.redeem';
      default:
        return 'gems.reason.adjust';
    }
  }

  // --- S12 Redeem picker / S12c confirm / S12r receipt / G1 -----------------

  private async handleGemsRedeem(ctx: Ctx, language: TelegramLanguage, data: string): Promise<TelegramBotWebhookResponse> {
    if (data === 'afws:gems:redeem') return this.screenRedeemPicker(ctx, language);
    if (data === 'afws:gems:redeem:max') return this.screenRedeemConfirm(ctx, language, 'max');
    if (data.startsWith('afws:gems:redeem:ok:')) return this.executeRedeem(ctx, language, data.slice('afws:gems:redeem:ok:'.length));
    if (data.startsWith('afws:gems:redeem:')) return this.screenRedeemConfirm(ctx, language, data.slice('afws:gems:redeem:'.length));
    return this.screenGems(ctx, language);
  }

  private async screenRedeemPicker(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    const account = await this.findAccount(ctx);
    if (!account) {
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }
    const economy = await this.gemEconomy();
    const rate = economy.gemRedeemPerGb;
    const gems = account.gemsBalance ?? 0;
    const maxGb = Math.floor(gems / rate);

    if (maxGb < 1) {
      const text = renderTelegramCopy(
        'gems.redeemTooFew',
        language,
        {},
        { rateGems: formatCount(rate, language), gems: formatCount(gems, language) },
      );
      const keyboard: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          [this.btn('menu.btn.invite', language, 'afws:invite')],
          [this.btn('common.btn.menu', language, 'afws:menu')],
        ],
      };
      return this.screen('G1', ctx, language, text, keyboard);
    }

    const options = REDEEM_GB_OPTIONS.filter((gb) => gb <= maxGb);
    const rows: TelegramInlineKeyboardMarkup['inline_keyboard'] = options.map((gb) => [
      {
        text: renderTelegramCopy('gems.redeemBtn', language, {}, { gb: formatCount(gb, language), gems: formatCount(gb * rate, language) }),
        callback_data: `afws:gems:redeem:${gb}`,
      },
    ]);
    if (!options.includes(maxGb)) {
      rows.push([
        {
          text: renderTelegramCopy('gems.redeemBtnMax', language, {}, { gb: formatCount(maxGb, language), gems: formatCount(maxGb * rate, language) }),
          callback_data: 'afws:gems:redeem:max',
        },
      ]);
    }
    rows.push([this.btn('menu.btn.gems', language, 'afws:gems')]);

    const text = renderTelegramCopy(
      'gems.redeemPick',
      language,
      {},
      { gems: formatCount(gems, language), rateGems: formatCount(rate, language) },
    );
    return this.screen('S12', ctx, language, text, { inline_keyboard: rows });
  }

  private async screenRedeemConfirm(ctx: Ctx, language: TelegramLanguage, gbToken: string): Promise<TelegramBotWebhookResponse> {
    const account = await this.findAccount(ctx);
    if (!account) {
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }
    const economy = await this.gemEconomy();
    const rate = economy.gemRedeemPerGb;
    const gems = account.gemsBalance ?? 0;
    const maxGb = Math.floor(gems / rate);
    const gb = gbToken === 'max' ? maxGb : Number.parseInt(gbToken, 10);

    if (!Number.isInteger(gb) || gb < 1) return this.screenRedeemPicker(ctx, language);
    const cost = gb * rate;
    if (cost > gems) {
      // Stale balance: re-check server-side and bounce back to the picker.
      await this.answer(ctx, renderTelegramCopy('gems.toast.insufficient', language));
      return this.screenRedeemPicker(ctx, language);
    }

    const text = renderTelegramCopy(
      'gems.redeemConfirm',
      language,
      {},
      { gems: formatCount(cost, language), gb: formatCount(gb, language), gemsAfter: formatCount(gems - cost, language) },
    );
    const keyboard: TelegramInlineKeyboardMarkup = {
      inline_keyboard: [
        [this.btn('gems.btn.confirm', language, `afws:gems:redeem:ok:${gb}`)],
        [this.btn('common.btn.back', language, 'afws:gems')],
      ],
    };
    return this.screen('S12c', ctx, language, text, keyboard);
  }

  private async executeRedeem(ctx: Ctx, language: TelegramLanguage, gbToken: string): Promise<TelegramBotWebhookResponse> {
    const account = await this.findAccount(ctx);
    if (!account) {
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }
    const economy = await this.gemEconomy();
    const rate = economy.gemRedeemPerGb;
    const gb = Number.parseInt(gbToken, 10);
    if (!Number.isInteger(gb) || gb < 1) return this.screenRedeemPicker(ctx, language);

    try {
      const result = await this.billing.redeemCustomerGemsForGb(account.id, gb * rate, rate);
      const fresh = await this.findAccount(ctx);
      const remaining = fresh?.remainingBytes ?? Math.max(0, result.quotaLimitAfterBytes - account.usedBytes);
      const text = renderTelegramCopy(
        'gems.redeemed',
        language,
        {},
        {
          gb: formatCount(gb, language),
          gemsAfter: formatCount(result.gemsBalance, language),
          remaining: formatDataSize(remaining, language),
        },
      );
      const keyboard: TelegramInlineKeyboardMarkup = {
        inline_keyboard: [
          [this.btn('menu.btn.account', language, 'afws:acct')],
          [this.btn('common.btn.menu', language, 'afws:menu')],
        ],
      };
      // S12r is a NEW message (transaction trail); no toast — the message confirms.
      return this.sendNew(ctx, language, text, keyboard);
    } catch {
      await this.answer(ctx, renderTelegramCopy('gems.toast.insufficient', language));
      return this.screenRedeemPicker(ctx, language);
    }
  }

  // --- S4 My Configs --------------------------------------------------------

  private async screenConfigs(ctx: Ctx, language: TelegramLanguage, toast?: string): Promise<TelegramBotWebhookResponse> {
    const account = await this.findAccount(ctx);
    if (!account) {
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }

    const configs = await this.loadConfigs(account.id);
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

    if (ctx.fromId) {
      const user = await getTelegramUser(this.database, ctx.fromId);
      const pending = this.awaitingCharge(user?.state);
      if (pending) {
        const pkg = packages.find((entry) => entry.id === pending.pendingPackageId);
        if (pkg) {
          const note = renderTelegramCopy('buy.resumeNote', language);
          return this.screen('S6', ctx, language, `${note}\n\n${this.paymentText(pkg, language, runtime.cardToCardInfo)}`, this.paymentKeyboard(language));
        }
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
    if (!user || user.language === null) return this.renderLanguagePicker(ctx);

    const language = user.language;
    const pending = this.awaitingCharge(user.state);
    if (!pending) {
      return this.screen('E3', ctx, language, renderTelegramCopy('error.photoNoCharge', language), this.errorPhotoKeyboard(language));
    }

    const account = await this.findAccount(ctx);
    if (!account) {
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }

    const created = await this.database.transaction((executor) =>
      createPendingTopupInTransaction(executor, {
        customerAccountId: account.id,
        telegramId: ctx.fromId ?? null,
        telegramChatId: ctx.chatId,
        volumePackageId: pending.pendingPackageId!,
        amountMinor: pending.pendingAmountMinor ?? null,
        currency: pending.pendingCurrency ?? null,
        receiptFileId: photoFileId,
      }),
    );
    await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state: null });

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
    if (!user || user.language === null) return this.renderLanguagePicker(ctx);

    // A file (document) while registering → re-prompt the phone step; while awaiting
    // a receipt → ask for a photo; keep the state either way.
    if (user.state?.regStage === 'awaiting_phone') {
      return this.sendReply(ctx, user.language, renderTelegramCopy('reg.phoneNeedButton', user.language), this.sharePhoneKeyboard(user.language));
    }
    if (user.state?.regStage === 'awaiting_name') {
      await this.sendNew(ctx, user.language, renderTelegramCopy('reg.nameInvalid', user.language));
      return this.sendNew(ctx, user.language, renderTelegramCopy('reg.askName', user.language));
    }
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

    const lines = renderTelegramCopy('help.body', language, {}, { supportContact: '' }).split('\n');
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.pop(); // drop the "Support: " / "پشتیبانی: " line
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    return lines.join('\n');
  }

  private async supportContact(): Promise<string | null> {
    return null;
  }

  // --- Account provisioning (idempotent registration) -----------------------

  private async registerAccount(
    ctx: Ctx,
    input: { displayName: string; phone: string; referralCode: string | null },
  ): Promise<RegisterResult> {
    const economy = await this.gemEconomy();
    const provisioner = new TelegramSelfServiceProvisioner({
      findAccountByTelegramId: (telegramId) => this.findAccountByTelegramId(telegramId),
      generateReferralCode: () => this.billing.generateUniqueReferralCode(),
      createAccount: (createInput) => this.createSelfServeAccount(createInput),
      createNamedVlessConfig: async (accountId, label) => {
        const config = await this.billing.createClientConfig(accountId, { protocol: 'vless' }, undefined);
        if (label) {
          // The user-derived label (e.g. "Hani-0912…") would trip the auto-numbering
          // rewrite in createClientConfig, so set it directly after creation.
          await this.database.query(`UPDATE client_configs SET label = $1, updated_at = now() WHERE id = $2`, [label, config.id]);
        }
        return { id: config.id };
      },
      getEntryLink: async (configId) => (await this.billing.getClientConfigEntryLink(configId)).link,
      findPrimaryVlessConfigId: (accountId) => this.findPrimaryVlessConfigId(accountId),
      attributeAndCreditReferral: async ({ newAccountId, code, friendName }) => {
        const outcome = await this.billing.attributeAndCreditReferral({
          newAccountId,
          code,
          config: {
            signupGems: economy.gemReferralSignup,
            milestoneEvery: economy.gemMilestoneEvery,
            milestoneBonus: economy.gemMilestoneBonus,
          },
        });
        if (!outcome) return null;
        return { ...outcome, friendName };
      },
      buildConfigLabel: (displayName, phone) => buildConfigLabel(displayName, phone),
    });

    return provisioner.register({
      telegramId: ctx.fromId ?? '',
      telegramUsername: ctx.username,
      telegramChatId: ctx.chatId,
      displayName: input.displayName,
      phone: input.phone,
      referralCode: input.referralCode,
    });
  }

  private async createSelfServeAccount(input: {
    telegramId: string;
    telegramUsername: string | null;
    displayName: string;
    phone: string;
    quotaLimitBytes: number;
    referralCode: string;
  }): Promise<SelfServiceAccount> {
    const detail = await this.billing.createCustomerAccount(
      {
        telegramId: input.telegramId,
        telegramUsername: input.telegramUsername ?? undefined,
        displayName: input.displayName,
        phone: input.phone,
        referralCode: input.referralCode,
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

  private async findAccount(ctx: Ctx): Promise<TelegramBotAccountSummary | null> {
    const lookup = await this.billing.getTelegramBotAccountStatus({ telegramId: ctx.fromId, telegramUsername: ctx.username });
    return lookup.status === 'found' ? lookup.account : null;
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

  // --- Inviter notifications (N3/N5) ----------------------------------------

  private async notifyInviterJoined(referral: ReferralAttribution): Promise<void> {
    if (!referral.inviterTelegramChatId) return;
    const language = await this.languageFor(referral.inviterTelegramId ?? undefined);

    const joinedText = renderTelegramCopy(
      'notify.refJoined',
      language,
      { friendName: referral.friendName },
      { gems: formatCount(referral.signupGems, language), gemsBalance: formatCount(referral.inviterGemsBalance, language) },
    );
    await this.pushNotification(referral.inviterTelegramChatId, language, joinedText, this.inviteNotifyKeyboard(language));

    if (referral.milestone) {
      const milestoneText = renderTelegramCopy(
        'notify.refMilestone',
        language,
        {},
        {
          count: formatCount(referral.milestone.count, language),
          gems: formatCount(referral.milestone.bonusGems, language),
          gemsBalance: formatCount(referral.milestone.inviterGemsBalance, language),
        },
      );
      await this.pushNotification(referral.inviterTelegramChatId, language, milestoneText, this.gemsNotifyKeyboard(language));
    }
  }

  private async pushNotification(
    chatId: string,
    language: TelegramLanguage,
    text: string,
    keyboard: TelegramInlineKeyboardMarkup,
  ): Promise<void> {
    await this.telegram.sendMessage(chatId, applyRtlGuard(text, language), {
      parseMode: 'HTML',
      disableWebPagePreview: true,
      replyMarkup: keyboard,
    });
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
        [this.btn('menu.btn.invite', language, 'afws:invite'), this.btn('menu.btn.gems', language, 'afws:gems')],
        [this.btn('menu.btn.lang', language, 'afws:lang'), this.btn('menu.btn.help', language, 'afws:help')],
      ],
    };
  }

  private accountKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [this.btn('common.btn.refresh', language, 'afws:acct:refresh')],
        [this.btn('menu.btn.buy', language, 'afws:buy'), this.btn('menu.btn.gems', language, 'afws:gems')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
  }

  private sharePhoneKeyboard(language: TelegramLanguage): TelegramReplyKeyboardMarkup {
    return {
      keyboard: [[{ text: renderTelegramCopy('reg.btn.sharePhone', language), request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
  }

  private inviteNotifyKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [this.btn('menu.btn.invite', language, 'afws:invite')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
  }

  private gemsNotifyKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [this.btn('menu.btn.gems', language, 'afws:gems')],
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };
  }

  private languagePickerKeyboard(): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [[this.btn('lang.btn.fa', 'fa', 'afws:lang:fa'), this.btn('lang.btn.en', 'en', 'afws:lang:en')]],
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
    }
    return this.rawSend(ctx.chatId, body, keyboard);
  }

  /** Send a brand-new message (S1v2/S7/S12r/registration/fallbacks); answers the callback first. */
  private async sendNew(
    ctx: Ctx,
    language: TelegramLanguage,
    text: string,
    keyboard?: TelegramInlineKeyboardMarkup,
    toast?: string,
  ): Promise<TelegramBotWebhookResponse> {
    if (ctx.callbackId) await this.answer(ctx, toast);
    return this.rawSend(ctx.chatId, applyRtlGuard(text, language), keyboard);
  }

  /** Send a new message carrying a REPLY keyboard (the R2 phone step). */
  private async sendReply(
    ctx: Ctx,
    language: TelegramLanguage,
    text: string,
    keyboard: TelegramReplyKeyboardMarkup,
  ): Promise<TelegramBotWebhookResponse> {
    if (ctx.callbackId) await this.answer(ctx);
    return this.rawSend(ctx.chatId, applyRtlGuard(text, language), keyboard);
  }

  /** Send a new message that removes the reply keyboard (reply → inline hand-off). */
  private async sendRemoveKeyboard(ctx: Ctx, language: TelegramLanguage, text: string): Promise<TelegramBotWebhookResponse> {
    return this.rawSend(ctx.chatId, applyRtlGuard(text, language), { remove_keyboard: true });
  }

  private async rawSend(chatId: string, text: string, replyMarkup?: TelegramReplyMarkup): Promise<TelegramBotWebhookResponse> {
    const result = await this.telegram.sendMessage(chatId, text, {
      parseMode: 'HTML',
      disableWebPagePreview: true,
      ...(replyMarkup ? { replyMarkup } : {}),
    });
    if (result.status === 'sent') return { ok: true, status: 'sent' };
    return { ok: false, status: 'failed', reason: result.reason };
  }

  private async answer(ctx: Ctx, toast?: string): Promise<void> {
    if (ctx.callbackId) await this.telegram.answerCallbackQuery(ctx.callbackId, toast ? { text: toast } : {});
  }

  // --- Helpers --------------------------------------------------------------

  private async mergeState(ctx: Ctx, user: TelegramUserRecord, patch: Partial<TelegramUserState>): Promise<void> {
    if (!ctx.fromId) return;
    const state: TelegramUserState = { ...(user.state ?? {}), ...patch };
    await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state });
  }

  private awaitingCharge(state: TelegramUserState | null | undefined): TelegramUserState | null {
    if (!state?.pendingPackageId || !state.pendingStartedAt) return null;
    const startedAt = Date.parse(state.pendingStartedAt);
    if (!Number.isFinite(startedAt) || Date.now() - startedAt >= AWAITING_RECEIPT_TTL_MS) return null;
    return state;
  }

  private async listActivePackages(): Promise<AdminVolumePackageSummary[]> {
    const packages = await this.billing.listVolumePackages({ status: 'active', limit: 50 });
    return [...packages].sort((a, b) => a.volumeBytes - b.volumeBytes);
  }

  private async languageFor(telegramId: string | undefined): Promise<TelegramLanguage> {
    if (!telegramId) return 'fa';
    const user = await getTelegramUser(this.database, telegramId);
    return normalizeTelegramLanguage(user?.language);
  }

  private async gemEconomy(): Promise<TelegramGemEconomy> {
    try {
      return (await this.telegramConfig.getRuntimeConfig()).gemEconomy;
    } catch {
      return { ...GEM_ECONOMY_DEFAULTS };
    }
  }

  private async botUsername(): Promise<string> {
    try {
      const summary = await this.telegramConfig.getSettingsSummary();
      return summary.botUsername?.trim() || DEFAULT_BOT_USERNAME;
    } catch {
      return DEFAULT_BOT_USERNAME;
    }
  }

  // --- Parsing --------------------------------------------------------------

  private parseCommand(text: string): {
    command: 'start' | 'menu' | 'status' | 'charge' | 'invite' | 'gems' | 'help' | 'language' | 'unknown' | null;
    payload: string | null;
  } {
    if (!text.startsWith('/')) return { command: null, payload: null };
    const parts = text.trim().split(/\s+/);
    const [name] = parts[0].slice(1).split('@', 1);
    const payload = parts.length > 1 ? parts[1] : null;
    switch (name.toLowerCase()) {
      case 'start':
        return { command: 'start', payload };
      case 'menu':
        return { command: 'menu', payload };
      case 'status':
      case 'usage':
      case 'quota':
        return { command: 'status', payload };
      case 'charge':
        return { command: 'charge', payload };
      case 'invite':
        return { command: 'invite', payload };
      case 'gems':
        return { command: 'gems', payload };
      case 'help':
        return { command: 'help', payload };
      case 'language':
        return { command: 'language', payload };
      default:
        return { command: 'unknown', payload };
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
    const contact = this.extractContact(rawMessage.contact);
    if (!text && !photoFileId && !hasDocument && !contact) return null;

    return {
      chatId,
      fromId: this.toNonEmptyString(from.id),
      username: typeof from.username === 'string' ? from.username : undefined,
      text: text || undefined,
      photoFileId,
      hasDocument,
      contact,
    };
  }

  private extractContact(value: unknown): { phoneNumber: string; userId?: string } | undefined {
    const contact = this.asRecord(value);
    const phoneNumber = this.toNonEmptyString(contact.phone_number);
    if (!phoneNumber) return undefined;
    return { phoneNumber, userId: this.toNonEmptyString(contact.user_id) };
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
