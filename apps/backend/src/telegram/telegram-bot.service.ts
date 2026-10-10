import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as QRCode from 'qrcode';
import { telegramWebhookSecretMatches } from './telegram-webhook-secret';
import type {
  AdminCustomerAccountSummary,
  AdminResellerAccountSummary,
  AdminVolumePackageSummary,
  TelegramBotAccountSummary,
  TelegramBotWebhookResponse,
} from '@afrows/shared';
import { BillingService } from '../billing/billing.service';
import { DatabaseService } from '../database/database.service';
import {
  TelegramAlertService,
  type TelegramInlineKeyboardButton,
  type TelegramInlineKeyboardMarkup,
  type TelegramReplyKeyboardMarkup,
  type TelegramReplyMarkup,
} from '../notifications/telegram-alert.service';
import { TelegramBotConfigService, GEM_ECONOMY_DEFAULTS, type TelegramGemEconomy } from './telegram-bot-config.service';
import {
  configLinksQrCaptionId,
  configLinksQrPayload,
  fitConfigBlocks,
  normalizeTelegramLanguage,
  renderConfigLinksBlock,
  renderTelegramCopy,
  type ConfigLinkBundle,
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
import { TelegramConnectResolver, type ConnectOutcome } from './telegram-connect';
import { createPendingTopupInTransaction, topupReference } from './telegram-topup';
import {
  adminCallbackAbandonsFlow,
  adminHomeLayout,
  CUSTOMER_MAIN_MENU_LAYOUT,
  routeAdminCallback,
  routeAdminText,
  type TelegramBotCommand,
  type TelegramMenuLayout,
} from './telegram-admin-routing';
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
const MAX_SELLER_CUSTOMERS_SHOWN = 15;
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
  /** Sender is a superadmin (allowed_admin_chat_ids): "menu" means the admin home. */
  isAdmin?: boolean;
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

  /**
   * Route an inbound update: button tap → contact → photo/document → text.
   *
   * Role-aware dispatch (seller role, Phase 1+): before falling into the
   * customer flow, resolve whether the sender is an APPROVED-linked seller
   * (see BillingService.getResellerByTelegramId / migration 0061) and, if so,
   * hand off to the fully separate seller dispatch (handleSellerCallback /
   * handleSellerText). This runs BEFORE the customer registration gate in
   * handleText, so a seller's Telegram id is never mistaken for an
   * unregistered customer. Sellers don't use the contact/photo/document flows
   * (those are customer-only: phone-share registration/connect, receipt
   * upload) — an unexpected update type from a seller is ignored, not routed
   * into the customer handlers.
   */
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
      if (await this.findAdmin(ctx.fromId)) {
        const adminCtx: Ctx = { ...ctx, isAdmin: true };
        return this.guard(adminCtx, () => this.handleAdminCallback(adminCtx, callback.data));
      }
      const seller = await this.findSeller(ctx.fromId);
      if (seller) return this.guard(ctx, () => this.handleSellerCallback(ctx, seller, callback.data));
      return this.guard(ctx, () => this.handleCallback(ctx, callback.data));
    }

    const message = this.extractMessage(payload);
    if (!message) return { ok: true, status: 'ignored', reason: 'unsupported_update' };

    const ctx: Ctx = { chatId: message.chatId, fromId: message.fromId, username: message.username };
    // Superadmin resolves FIRST: an operator identity must never fall into the
    // customer registration or seller state machines.
    if (await this.findAdmin(ctx.fromId)) {
      const adminCtx: Ctx = { ...ctx, isAdmin: true };
      if (message.text) return this.guard(adminCtx, () => this.handleAdminText(adminCtx, message.text!));
      return this.guard(adminCtx, () => this.handleAdminNonText(adminCtx, message));
    }

    const seller = await this.findSeller(ctx.fromId);
    if (seller) {
      if (message.text) return this.guard(ctx, () => this.handleSellerText(ctx, seller, message.text!));
      return { ok: true, status: 'ignored', reason: 'unsupported_update' };
    }

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

    // Connect is awaiting the shared contact. Plain text → nudge to the share
    // button; a slash command escapes the flow (connect is optional/abandonable).
    if (user.state?.connectStage) {
      if (command === null) {
        return this.sendReply(ctx, language, renderTelegramCopy('reg.phoneNeedButton', language), this.sharePhoneKeyboard(language));
      }
      await this.mergeState(ctx, user, { connectStage: undefined });
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
      case 'connect':
        return this.screenConnect(ctx, language, user, account);
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
      case 'afws:cfg:qr':
        return this.handleShowConfigQr(ctx, language);
      case 'afws:buy':
        return this.screenBuy(ctx, language);
      case 'afws:buy:cancel':
        return this.handleBuyCancel(ctx, language);
      case 'afws:invite':
        return this.screenInvite(ctx, language);
      case 'afws:invite:refresh':
        return this.screenInvite(ctx, language, renderTelegramCopy('common.toast.refreshed', language));
      case 'afws:connect':
        return this.screenConnect(ctx, language, user);
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
    if (ctx.isAdmin) {
      const keyboard = await this.adminHomeKeyboard(ctx, language);
      return this.sendNew(ctx, language, renderTelegramCopy('admin.menu.title', language), keyboard, renderTelegramCopy('error.staleButton', language));
    }
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

    const isRegister = user.state?.regStage === 'awaiting_phone';
    const isConnect = Boolean(user.state?.connectStage);

    if (!isRegister && !isConnect) {
      // Unexpected contact — route by account state.
      const account = await this.findAccount(ctx);
      if (account) return this.screenMenu(ctx, language, 'menu.title');
      return this.beginRegistration(ctx, language, user);
    }

    // Ownership guard: accept only the user's own self-verified shared contact.
    if (!contact.userId || String(contact.userId) !== ctx.fromId) {
      return this.sendReply(ctx, language, renderTelegramCopy('reg.phoneNotYours', language), this.sharePhoneKeyboard(language));
    }

    const phone = normalizePhoneDigits(contact.phoneNumber);

    // Connect/sync: merge the current bot account into the matched real account.
    if (isConnect) return this.handleConnectContact(ctx, language, user, phone);

    // First-time registration (unchanged).
    const name = user.state?.regName ?? 'friend';

    // Reply → inline hand-off: remove the reply keyboard, create the account, welcome.
    await this.sendRemoveKeyboard(ctx, language, renderTelegramCopy('reg.phoneOk', language, { name }));

    const result = await this.registerAccount(ctx, { displayName: name, phone, referralCode: user.state?.referralCode ?? null });
    await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state: null });

    if (result.referral) await this.notifyInviterJoined(result.referral);

    if (result.linked) return this.renderWelcomeLinked(ctx, language, name);

    return this.renderWelcomeRegistered(ctx, language, name, result);
  }

  // --- Connect / sync my account (docs §15) ---------------------------------

  /**
   * afws:connect (and /connect): begin the connect flow for a user who already has
   * an account. Tags connectStage and hands off to the R2 share-phone reply keyboard
   * so the next self-verified contact drives the merge branch (not registration).
   */
  private async screenConnect(
    ctx: Ctx,
    language: TelegramLanguage,
    user: TelegramUserRecord,
    account?: TelegramBotAccountSummary,
  ): Promise<TelegramBotWebhookResponse> {
    const resolved = account ?? (await this.findAccount(ctx));
    if (!resolved) {
      // Connect is only offered to registered users; if the account is gone, surface
      // the account-problem screen rather than starting a merge with no source.
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }
    await this.mergeState(ctx, user, { connectStage: true });
    return this.sendReply(ctx, language, renderTelegramCopy('connect.intro', language), this.sharePhoneKeyboard(language));
  }

  /**
   * A self-verified contact arrived while connectStage is set. Resolve the phone
   * against live accounts and act per the connect rules (merge / already-synced /
   * owned-by-other / ambiguous / no-match), then clear connectStage and remove the
   * reply keyboard, returning to inline menus.
   */
  private async handleConnectContact(
    ctx: Ctx,
    language: TelegramLanguage,
    user: TelegramUserRecord,
    phone: string,
  ): Promise<TelegramBotWebhookResponse> {
    const account = await this.findAccount(ctx);
    if (!account) {
      // Lost the account mid-flow — abandon connect and route to registration.
      await this.mergeState(ctx, user, { connectStage: undefined });
      return this.beginRegistration(ctx, language, user);
    }

    const displayName = account.displayName ?? user.state?.regName ?? 'friend';
    const outcome = await this.connectAccount(ctx, account.id, phone, displayName);

    // Completion: clear connectStage (keep any other state) and drop the reply keyboard.
    await this.mergeState(ctx, user, { connectStage: undefined });

    switch (outcome.kind) {
      case 'merged': {
        await this.sendRemoveKeyboard(ctx, language, renderTelegramCopy('connect.merged', language, { name: displayName }));
        // The telegram id now points at the real (target) account — re-read + show its home.
        const merged = await this.findAccount(ctx);
        if (!merged) {
          return this.sendNew(ctx, language, renderTelegramCopy('connect.merged', language, { name: displayName }), this.mainMenuKeyboard(language));
        }
        return this.sendNew(ctx, language, await this.accountCardText(merged, language), this.accountKeyboard(language, merged));
      }
      case 'alreadySynced':
      case 'noMatch': {
        const copyId: TelegramCopyId = outcome.kind === 'alreadySynced' ? 'connect.alreadySynced' : 'connect.noMatch';
        await this.sendRemoveKeyboard(ctx, language, renderTelegramCopy(copyId, language));
        return this.sendNew(ctx, language, await this.accountCardText(account, language), this.accountKeyboard(language, account));
      }
      case 'ownedByOther':
      case 'ambiguous': {
        const copyId: TelegramCopyId = outcome.kind === 'ownedByOther' ? 'connect.ownedByOther' : 'connect.ambiguous';
        await this.sendRemoveKeyboard(ctx, language, renderTelegramCopy(copyId, language));
        return this.sendNew(ctx, language, renderTelegramCopy('menu.title', language), this.mainMenuKeyboard(language));
      }
    }
  }

  /** Wire the connect resolver to billing (phone lookup / merge / phone sync + audit). */
  private async connectAccount(
    ctx: Ctx,
    currentAccountId: string,
    phone: string,
    displayName: string,
  ): Promise<ConnectOutcome> {
    const telegramId = ctx.fromId ?? '';
    const resolver = new TelegramConnectResolver({
      findLiveAccountsByPhone: async (lookup) => {
        const matches = await this.billing.findCustomerAccountByPhone(lookup);
        return matches.map((match) => ({
          id: match.id,
          displayName: match.displayName,
          status: match.status,
          quotaLimitBytes: match.quotaLimitBytes,
          telegramId: match.telegramId,
        }));
      },
      mergeIntoAccount: async (sourceId, targetId) => {
        // Merge the current bot account INTO the real account (reuses the merge
        // rules: GB/gems/configs move, telegram link moves, source archived).
        await this.billing.mergeCustomerAccount(sourceId, targetId, undefined);
        await this.billing.recordTelegramConnectMerge({ telegramId, sourceId, targetId });
      },
      syncAccountContact: (accountId, contactPhone, contactName) =>
        this.billing.syncTelegramAccountContact({ accountId, telegramId, phone: contactPhone, displayName: contactName }),
    });
    return resolver.connect({ currentAccountId, telegramId, phone, displayName });
  }

  /**
   * S1v2-link — the phone matched an existing account: confirm the link (no new
   * 0 GB account), then show the real usage/home card so the user sees their
   * current balance immediately.
   */
  private async renderWelcomeLinked(
    ctx: Ctx,
    language: TelegramLanguage,
    name: string,
  ): Promise<TelegramBotWebhookResponse> {
    const intro = renderTelegramCopy('reg.linkedExisting', language, { name });
    // The account is now bound to this telegram id — re-read the full summary.
    const account = await this.findAccount(ctx);
    if (!account) {
      return this.sendNew(ctx, language, intro, this.mainMenuKeyboard(language));
    }
    const card = await this.accountCardText(account, language);
    return this.sendNew(ctx, language, `${intro}\n\n${card}`, this.accountKeyboard(language, account));
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
    return this.screen('S3h', ctx, language, text, this.accountKeyboard(language, account));
  }

  private async screenAccount(ctx: Ctx, language: TelegramLanguage, toast?: string): Promise<TelegramBotWebhookResponse> {
    const account = await this.findAccount(ctx);
    if (!account) {
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }
    return this.screen('S3v2', ctx, language, await this.accountCardText(account, language), this.accountKeyboard(language, account), toast);
  }

  private async accountCardText(account: TelegramBotAccountSummary, language: TelegramLanguage): Promise<string> {
    const economy = await this.gemEconomy();
    const status = renderTelegramCopy(this.statusCopyId(account.status), language);
    const used = account.usedBytes;
    const quota = account.quotaLimitBytes;

    // null/absent expiresAt = never expires -> no line (most accounts).
    const expiryLine = account.expiresAt
      ? `\n${renderTelegramCopy('acct.expiryLine', language, {}, { expiresAt: formatShortDate(new Date(account.expiresAt), language) })}`
      : '';

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
        expiryLine,
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
        ...(configs.items.length ? [[this.btn('cfg.btn.qr', language, 'afws:cfg:qr')]] : []),
        [this.btn('common.btn.menu', language, 'afws:menu')],
      ],
    };

    if (!configs.items.length) {
      return this.screen('S4', ctx, language, renderTelegramCopy('cfg.empty', language), keyboard, toast);
    }

    // Each config shows EVERY entry link (Germany, Shatel, USA) and its subscription URL;
    // blocks are added while the message stays under Telegram's length limit.
    const blocks = configs.items.map((config) =>
      [
        renderTelegramCopy('cfg.itemHeader', language, { protocol: config.protocol, label: config.label }),
        renderConfigLinksBlock(config.bundle, language),
      ].join('\n'),
    );
    const fitted = fitConfigBlocks(blocks);
    const lines = [renderTelegramCopy('cfg.title', language), ...fitted.kept];
    if (configs.truncated || fitted.truncated) lines.push(renderTelegramCopy('cfg.truncated', language));
    lines.push(renderTelegramCopy('cfg.importHint', language));
    return this.screen('S4', ctx, language, lines.join('\n\n'), keyboard, toast);
  }

  private async loadConfigs(accountId: string): Promise<{ items: Array<{ protocol: string; label: string; bundle: ConfigLinkBundle }>; truncated: boolean }> {
    const detail = await this.billing.getCustomerAccount(accountId);
    const active = detail.clientConfigs.filter((config) => config.status === 'active');
    const linked: Array<{ protocol: string; label: string; bundle: ConfigLinkBundle }> = [];
    for (const config of active) {
      if (linked.length > MAX_CONFIGS_SHOWN) break;
      const bundle = await this.billing.getClientConfigLinkBundle(config.id);
      if (bundle.links.length) linked.push({ protocol: config.protocol, label: config.label, bundle });
    }
    return { items: linked.slice(0, MAX_CONFIGS_SHOWN), truncated: linked.length > MAX_CONFIGS_SHOWN };
  }

  /**
   * "📷 QR code" — self-service: generates + sends the customer's OWN primary
   * VLESS config as a QR photo, straight to the chat they're already in. Same
   * QR generation as the admin-push path (billing.sendCustomerConfigToTelegram),
   * just without any admin/chat-id resolution — the bot already has ctx.chatId.
   */
  private async handleShowConfigQr(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    const account = await this.findAccount(ctx);
    if (!account) {
      return this.screen('E4', ctx, language, renderTelegramCopy('error.accountProblem', language), this.menuOnlyKeyboard(language));
    }

    const primary = await this.billing.getPrimaryVlessEntryLinkForAccount(account.id);
    if (!primary) {
      await this.answer(ctx, renderTelegramCopy('cfg.empty', language));
      return this.screenConfigs(ctx, language);
    }

    await this.answer(ctx);
    try {
      // One QR: the subscription URL when available (adds every link), else the first link.
      const qrPayload = configLinksQrPayload(primary.bundle) ?? primary.uri;
      const qrPng = await QRCode.toBuffer(qrPayload, { type: 'png', margin: 1, width: 512 });
      const result = await this.telegram.sendPhoto(ctx.chatId, qrPng, {
        caption: renderTelegramCopy(configLinksQrCaptionId(primary.bundle), language, {}, { label: primary.label }),
        filename: 'afrows-vless-qr.png',
      });
      if (result.status === 'sent') return { ok: true, status: 'sent' };
      return { ok: false, status: 'failed', reason: result.reason };
    } catch {
      return { ok: false, status: 'failed', reason: 'qr_generation_failed' };
    }
  }

  // --- S5 Buy / E1 / E2 -----------------------------------------------------

  private async screenBuy(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    const packages = await this.listActivePackages();
    if (!packages.length) {
      return this.screen('E1', ctx, language, renderTelegramCopy('error.noPackages', language), this.menuOnlyKeyboard(language));
    }

    const account = await this.findAccount(ctx);
    const cardInfo = await this.resolveCardToCardInfo(account);
    if (!cardInfo) {
      return this.screen('E2', ctx, language, renderTelegramCopy('error.cardUnset', language), this.menuOnlyKeyboard(language));
    }

    if (ctx.fromId) {
      const user = await getTelegramUser(this.database, ctx.fromId);
      const pending = this.awaitingCharge(user?.state);
      if (pending) {
        const pkg = packages.find((entry) => entry.id === pending.pendingPackageId);
        if (pkg) {
          const note = renderTelegramCopy('buy.resumeNote', language);
          return this.screen('S6', ctx, language, `${note}\n\n${this.paymentText(pkg, language, cardInfo)}`, this.paymentKeyboard(language));
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

    const account = await this.findAccount(ctx);
    const cardInfo = await this.resolveCardToCardInfo(account);
    if (!cardInfo) {
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

    return this.screen('S6', ctx, language, this.paymentText(pkg, language, cardInfo), this.paymentKeyboard(language));
  }

  /**
   * Which card-to-card info to show for a purchase (Phase 4): the customer's
   * OWN seller's card when they have one (so payment goes to the seller who
   * actually provisions their service), else the platform's global card. A
   * seller account with no card on file yields null -> the caller shows
   * error.cardUnset rather than silently falling back to the wrong entity's card.
   */
  private async resolveCardToCardInfo(account: TelegramBotAccountSummary | null): Promise<string | null> {
    if (account?.resellerAccountId) {
      try {
        const reseller = await this.billing.getResellerAccount(account.resellerAccountId);
        return reseller.cardInfo?.trim() || null;
      } catch {
        return null;
      }
    }
    const runtime = await this.telegramConfig.getRuntimeConfig();
    return runtime.cardToCardInfo?.trim() || null;
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
        resellerAccountId: account.resellerAccountId ?? null,
      }),
    );
    await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state: null });

    // Phase 4: a seller-owned customer's receipt goes to the seller's bot chat
    // for approve/reject (settled via their wallet), instead of the superadmin
    // dashboard queue. Best-effort — the customer's submission already
    // succeeded above even if this push fails (they can also see it via the
    // seller's "🧾 Requests" list).
    if (account.resellerAccountId) {
      await this.pushSellerReceiptRequest(account.resellerAccountId, {
        id: created.id,
        receiptFileId: photoFileId,
        customerDisplayName: account.displayName ?? null,
        volumePackageId: pending.pendingPackageId ?? null,
        amountMinor: pending.pendingAmountMinor ?? null,
        currency: pending.pendingCurrency ?? null,
      });
    }

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
    if (user.state?.regStage === 'awaiting_phone' || user.state?.connectStage) {
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
      findLiveAccountsByPhone: async (phone) => {
        const matches = await this.billing.findCustomerAccountByPhone(phone);
        return matches.map((match) => ({
          id: match.id,
          displayName: match.displayName,
          status: match.status,
          quotaLimitBytes: match.quotaLimitBytes,
          telegramId: match.telegramId,
        }));
      },
      linkAccountByPhone: async (linkInput) => {
        const detail = await this.billing.linkTelegramAccountByPhone({
          accountId: linkInput.accountId,
          telegramId: linkInput.telegramId,
          telegramUsername: linkInput.telegramUsername,
          phone: linkInput.phone,
          displayName: linkInput.displayName,
        });
        return {
          id: detail.id,
          displayName: detail.displayName,
          status: detail.status,
          quotaLimitBytes: detail.quotaLimitBytes,
          telegramId: detail.telegramId,
        };
      },
      recordPhoneRegistrationEvent: (event, details) =>
        this.billing.recordTelegramRegistrationEvent(event, details),
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

  private layoutKeyboard(layout: TelegramMenuLayout, language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return { inline_keyboard: layout.map((row) => row.map((spec) => this.btn(spec.copyId, language, spec.data))) };
  }

  private mainMenuKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return this.layoutKeyboard(CUSTOMER_MAIN_MENU_LAYOUT, language);
  }

  private accountKeyboard(language: TelegramLanguage, account: TelegramBotAccountSummary): TelegramInlineKeyboardMarkup {
    // "Contact seller" is a direct t.me link (no round trip) shown only for a
    // customer whose seller has a Telegram @username on file; direct (no
    // seller) or seller-without-username accounts simply don't get the row.
    const sellerUsername = account.resellerTelegramUsername?.trim();
    const sellerRow: TelegramInlineKeyboardButton[][] = sellerUsername
      ? [[{ text: renderTelegramCopy('acct.btn.contactSeller', language), url: `https://t.me/${sellerUsername}` }]]
      : [];

    return {
      inline_keyboard: [
        [this.btn('common.btn.refresh', language, 'afws:acct:refresh')],
        [this.btn('menu.btn.buy', language, 'afws:buy'), this.btn('menu.btn.gems', language, 'afws:gems')],
        ...sellerRow,
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
    command: TelegramBotCommand;
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
      case 'connect':
        return { command: 'connect', payload };
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

  // --- Seller role (Phase 1+) ------------------------------------------------
  //
  // A completely separate dispatch branch from the customer flow above,
  // reached only for a Telegram id with an APPROVED reseller link (dashboard
  // "Telegram bot access" panel → superadmin approval, migration 0061). No
  // registration/connect/receipt-upload state applies here; navigation is
  // stateless like the customer menu. Callback namespace is `afws:sell:*` (kept
  // distinct from the customer `afws:*` namespace so a stale button never
  // crosses into the other role's screens).

  /** Resolves an APPROVED seller for this Telegram id, or null (not a seller / not approved). */
  private async findSeller(telegramId: string | undefined): Promise<AdminResellerAccountSummary | null> {
    if (!telegramId) return null;
    try {
      return await this.billing.getResellerByTelegramId(telegramId);
    } catch {
      return null; // DB hiccup: fail open to the customer flow rather than 500 the update.
    }
  }

  private async handleSellerText(
    ctx: Ctx,
    seller: AdminResellerAccountSummary,
    rawText: string,
  ): Promise<TelegramBotWebhookResponse> {
    const language = await this.languageFor(ctx.fromId);

    // "➕ New customer" (Phase 5) owns the session while awaiting the typed
    // name — any text belongs to that step, same convention as customer
    // registration's awaiting_name.
    if (ctx.fromId) {
      const user = await getTelegramUser(this.database, ctx.fromId);
      if (user?.state?.sellerNewCustomerStage === 'awaiting_name') {
        return this.handleSellerNewCustomerName(ctx, language, user, rawText);
      }
    }

    // Otherwise every text message (including /start) opens the seller menu.
    return this.screenSellerMenu(ctx, language);
  }

  private async handleSellerCallback(
    ctx: Ctx,
    seller: AdminResellerAccountSummary,
    data: string,
  ): Promise<TelegramBotWebhookResponse> {
    if (!data.startsWith('afws:sell:')) return this.staleButton(ctx);
    const language = await this.languageFor(ctx.fromId);
    const user = ctx.fromId ? await getTelegramUser(this.database, ctx.fromId) : null;

    if (data.startsWith('afws:sell:req:approve:')) {
      return this.handleSellerApproveReceipt(ctx, language, seller, data.slice('afws:sell:req:approve:'.length));
    }
    if (data.startsWith('afws:sell:req:reject:')) {
      return this.handleSellerRejectReceipt(ctx, language, seller, data.slice('afws:sell:req:reject:'.length));
    }

    // "⚡ Charge account" (Phase 5)
    if (data.startsWith('afws:sell:charge:cust:')) {
      return this.handleSellerChargePickCustomer(ctx, language, seller, data.slice('afws:sell:charge:cust:'.length));
    }
    if (data.startsWith('afws:sell:charge:pkg:')) {
      return this.handleSellerChargePickPackage(ctx, language, seller, user, data.slice('afws:sell:charge:pkg:'.length));
    }
    if (data === 'afws:sell:charge:confirm') {
      return this.handleSellerChargeConfirm(ctx, language, seller, user);
    }
    if (data === 'afws:sell:charge:cancel') {
      return this.handleSellerChargeCancel(ctx, language);
    }

    // "➕ New customer" (Phase 5)
    if (data.startsWith('afws:sell:newcust:pkg:')) {
      return this.handleSellerNewCustomerPickPackage(ctx, language, seller, user, data.slice('afws:sell:newcust:pkg:'.length));
    }
    if (data === 'afws:sell:newcust:confirm') {
      return this.handleSellerNewCustomerConfirm(ctx, language, seller, user);
    }
    if (data === 'afws:sell:newcust:cancel') {
      return this.handleSellerNewCustomerCancel(ctx, language);
    }

    switch (data) {
      case 'afws:sell:menu':
        return this.screenSellerMenu(ctx, language);
      case 'afws:sell:panel':
        return this.screenSellerPanel(ctx, language, seller);
      case 'afws:sell:panel:refresh':
        return this.screenSellerPanel(ctx, language, seller, renderTelegramCopy('common.toast.refreshed', language));
      case 'afws:sell:requests':
        return this.screenSellerRequests(ctx, language, seller);
      case 'afws:sell:newcustomer':
        return this.screenSellerNewCustomerAskName(ctx, language);
      case 'afws:sell:charge':
        return this.screenSellerChargePickCustomer(ctx, language, seller);
      default:
        return this.staleButton(ctx);
    }
  }

  private async screenSellerMenu(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    return this.screen('SELLER-MENU', ctx, language, renderTelegramCopy('seller.menu.title', language), this.sellerMenuKeyboard(language));
  }

  /** "My panel" (پنل من, Phase 2): wallet balance/credit + customer count + a short customer list. */
  private async screenSellerPanel(
    ctx: Ctx,
    language: TelegramLanguage,
    seller: AdminResellerAccountSummary,
    toast?: string,
  ): Promise<TelegramBotWebhookResponse> {
    const customers = await this.billing.listCustomerAccounts({ resellerAccountId: seller.id, limit: MAX_SELLER_CUSTOMERS_SHOWN });

    const card = renderTelegramCopy(
      'seller.panel.card',
      language,
      {},
      {
        balance: formatAmount(seller.balanceAmount, seller.currency, language),
        available: formatAmount(seller.availableBalanceAmount, seller.currency, language),
        activeCount: formatCount(seller.activeCustomerAccountCount, language),
        customerCount: formatCount(seller.customerAccountCount, language),
      },
    );

    const list = customers.length
      ? customers.map((c) => this.sellerCustomerLine(c, language)).join('\n')
      : renderTelegramCopy('seller.panel.customersEmpty', language);

    const text = `${card}\n\n${renderTelegramCopy('seller.panel.customersTitle', language)}\n${list}`;
    return this.screen('SELLER-PANEL', ctx, language, text, this.sellerPanelKeyboard(language), toast);
  }

  private sellerCustomerLine(account: AdminCustomerAccountSummary, language: TelegramLanguage): string {
    const remaining =
      account.quotaLimitBytes == null
        ? renderTelegramCopy('usage.unlimited', language, {}, { used: formatDataSize(account.usedBytes, language) })
        : formatDataSize(Math.max(0, account.quotaLimitBytes - account.usedBytes), language);
    return renderTelegramCopy(
      'seller.panel.customerItem',
      language,
      {},
      {
        name: escapeHtml(account.displayName ?? account.id.slice(0, 8)),
        remaining,
        status: renderTelegramCopy(this.statusCopyId(account.status), language),
      },
    );
  }

  private sellerMenuKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [this.btn('seller.menu.btn.panel', language, 'afws:sell:panel')],
        [this.btn('seller.menu.btn.newCustomer', language, 'afws:sell:newcustomer'), this.btn('seller.menu.btn.charge', language, 'afws:sell:charge')],
        [this.btn('seller.menu.btn.requests', language, 'afws:sell:requests')],
      ],
    };
  }

  private sellerPanelKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [this.btn('common.btn.refresh', language, 'afws:sell:panel:refresh')],
        [this.btn('seller.btn.backToMenu', language, 'afws:sell:menu')],
      ],
    };
  }

  // --- Seller role: customer → seller payment (Phase 4) ----------------------
  //
  // A customer whose account has a reseller pays THAT seller's card (see
  // resolveCardToCardInfo) and uploads the receipt exactly like the direct
  // flow (handlePhoto) — the only difference is the request is tagged with
  // reseller_account_id and routed here instead of the superadmin dashboard.
  // Settlement is an ORDINARY reseller package sale (wallet debit at cost),
  // never a free grant — see billing.approveTelegramTopupViaReseller.

  /** "🧾 Requests": re-pushes every still-pending receipt for this seller (in case the original push was missed). */
  private async screenSellerRequests(
    ctx: Ctx,
    language: TelegramLanguage,
    seller: AdminResellerAccountSummary,
  ): Promise<TelegramBotWebhookResponse> {
    const pending = await this.billing.listPendingTelegramTopupsForReseller(seller.id);
    if (!pending.length) {
      return this.screen('SELLER-REQ', ctx, language, renderTelegramCopy('seller.req.empty', language), this.sellerMenuKeyboard(language));
    }
    await this.answer(ctx);
    for (const request of pending) {
      await this.pushSellerReceiptRequestRow(seller.id, request, language);
    }
    return { ok: true, status: 'sent' };
  }

  /** Push one pending receipt (photo + approve/reject) to the seller's chat, right after a customer submits it (Phase 4). Best-effort — never throws into the caller. */
  private async pushSellerReceiptRequest(
    resellerAccountId: string,
    request: {
      id: string;
      receiptFileId: string;
      customerDisplayName: string | null;
      volumePackageId: string | null;
      amountMinor: number | null;
      currency: string | null;
    },
  ): Promise<void> {
    try {
      const reseller = await this.billing.getResellerAccount(resellerAccountId);
      if (!reseller.telegramId) return; // not (yet) bot-linked — shouldn't happen once approved, but never throw
      const user = await getTelegramUser(this.database, reseller.telegramId);
      if (!user?.chatId) return;
      const language = normalizeTelegramLanguage(user.language);

      let packageLabel: string | null = null;
      let packageVolumeBytes: number | null = null;
      if (request.volumePackageId) {
        try {
          const pkg = await this.billing.getVolumePackage(request.volumePackageId);
          packageLabel = pkg.name;
          packageVolumeBytes = pkg.volumeBytes;
        } catch {
          // package lookup failed (e.g. deactivated meanwhile) — caption falls back below
        }
      }

      await this.pushSellerReceiptMessage(
        user.chatId,
        language,
        {
          id: request.id,
          receiptFileId: request.receiptFileId,
          customerDisplayName: request.customerDisplayName,
          packageLabel,
          packageVolumeBytes,
          amountMinor: request.amountMinor,
          currency: request.currency,
        },
      );
    } catch {
      // best-effort: the customer's submission already succeeded regardless
    }
  }

  /** Re-push variant for screenSellerRequests, where the request row comes from listPendingTelegramTopupsForReseller (no receiptFileId there — read it directly). */
  private async pushSellerReceiptRequestRow(
    resellerAccountId: string,
    request: {
      id: string;
      customerDisplayName: string | null;
      packageLabel: string | null;
      packageVolumeBytes: number | null;
      amountMinor: number | null;
      currency: string | null;
    },
    language: TelegramLanguage,
  ): Promise<void> {
    try {
      const reseller = await this.billing.getResellerAccount(resellerAccountId);
      if (!reseller.telegramId) return;
      const user = await getTelegramUser(this.database, reseller.telegramId);
      if (!user?.chatId) return;

      const receiptFileId = await this.database.query<{ receiptFileId: string | null }>(
        `SELECT receipt_file_id AS "receiptFileId" FROM telegram_topup_requests WHERE id = $1`,
        [request.id],
      );
      const fileId = receiptFileId.rows[0]?.receiptFileId;
      if (!fileId) return;

      await this.pushSellerReceiptMessage(user.chatId, language, { ...request, id: request.id, receiptFileId: fileId });
    } catch {
      // best-effort — the seller can still see this request next time
    }
  }

  private async pushSellerReceiptMessage(
    chatId: string,
    language: TelegramLanguage,
    request: {
      id: string;
      receiptFileId: string;
      customerDisplayName: string | null;
      packageLabel: string | null;
      packageVolumeBytes: number | null;
      amountMinor: number | null;
      currency: string | null;
    },
  ): Promise<void> {
    const caption = renderTelegramCopy(
      'seller.req.receiptCaption',
      language,
      {},
      {
        customerName: request.customerDisplayName ?? '-',
        packageSize: formatDataSize(request.packageVolumeBytes ?? 0, language),
        amount: formatAmount(request.amountMinor, request.currency, language),
        requestId: topupReference(request.id),
      },
    );
    await this.telegram.sendPhotoByFileId(chatId, request.receiptFileId, {
      caption,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: renderTelegramCopy('seller.req.btn.approve', language), callback_data: `afws:sell:req:approve:${request.id}` },
            { text: renderTelegramCopy('seller.req.btn.reject', language), callback_data: `afws:sell:req:reject:${request.id}` },
          ],
        ],
      },
    });
  }

  /** Seller taps "✅ Approve" — settles via an ordinary reseller package sale (wallet debit + quota credit), then notifies the customer. */
  private async handleSellerApproveReceipt(
    ctx: Ctx,
    language: TelegramLanguage,
    seller: AdminResellerAccountSummary,
    requestId: string,
  ): Promise<TelegramBotWebhookResponse> {
    try {
      const { saleResult, telegramChatId, telegramId } = await this.billing.approveTelegramTopupViaReseller(requestId, seller.id, undefined);
      await this.answer(ctx, renderTelegramCopy('seller.req.approved', language));

      if (telegramChatId) {
        const customerLanguage = await this.languageFor(telegramId ?? undefined);
        const text = renderTelegramCopy(
          'notify.approved',
          customerLanguage,
          { requestId: topupReference(requestId) },
          { packageSize: formatDataSize(saleResult.allocation.volumeBytesDelta, customerLanguage) },
        );
        await this.pushNotification(telegramChatId, customerLanguage, text, this.menuOnlyKeyboard(customerLanguage));
      }
      return { ok: true, status: 'sent' };
    } catch (error) {
      await this.answer(ctx, renderTelegramCopy('seller.req.approveFailed', language));
      return { ok: false, status: 'failed', reason: error instanceof Error ? error.message : 'approve_failed' };
    }
  }

  /** Seller taps "❌ Reject" — never moves money; notifies the customer so they can resubmit. */
  private async handleSellerRejectReceipt(
    ctx: Ctx,
    language: TelegramLanguage,
    seller: AdminResellerAccountSummary,
    requestId: string,
  ): Promise<TelegramBotWebhookResponse> {
    try {
      const { telegramChatId, telegramId } = await this.billing.rejectTelegramTopupViaReseller(requestId, seller.id, null, undefined);
      await this.answer(ctx, renderTelegramCopy('seller.req.rejected', language));

      if (telegramChatId) {
        const customerLanguage = await this.languageFor(telegramId ?? undefined);
        const reasonText = renderTelegramCopy('notify.noReason', customerLanguage);
        const text = renderTelegramCopy('notify.rejected', customerLanguage, {
          requestId: topupReference(requestId),
          reason: reasonText,
        });
        await this.pushNotification(telegramChatId, customerLanguage, text, this.menuOnlyKeyboard(customerLanguage));
      }
      return { ok: true, status: 'sent' };
    } catch (error) {
      await this.answer(ctx, renderTelegramCopy('seller.req.rejectFailed', language));
      return { ok: false, status: 'failed', reason: error instanceof Error ? error.message : 'reject_failed' };
    }
  }

  // --- Seller role: create / charge actions (Phase 5) -------------------------
  //
  // Both flows close with the SAME orchestration Phase 4's receipt-approval uses
  // (createResellerPackageSaleForReseller -> executeResellerPackageSale): an
  // ordinary wallet-debit + quota-credit sale, idempotent via a per-flow key
  // generated once entering 'confirm', so a double-tap (or a retry after a
  // failed attempt) can never double-charge. State is cleared only AFTER the
  // sale succeeds, so a failed attempt (e.g. insufficient balance) leaves the
  // same key in place for a safe retry.

  private sellerRetryOrCancelKeyboard(language: TelegramLanguage, confirmData: string, cancelData: string): TelegramInlineKeyboardMarkup {
    return { inline_keyboard: [[this.btn('seller.btn.confirm', language, confirmData), this.btn('seller.btn.cancel', language, cancelData)]] };
  }

  // --- ⚡ Charge account -------------------------------------------------------

  /** Step 1 — pick which of the seller's own customers to charge. */
  private async screenSellerChargePickCustomer(
    ctx: Ctx,
    language: TelegramLanguage,
    seller: AdminResellerAccountSummary,
  ): Promise<TelegramBotWebhookResponse> {
    const customers = await this.billing.listCustomerAccounts({ resellerAccountId: seller.id, limit: MAX_SELLER_CUSTOMERS_SHOWN });
    if (!customers.length) {
      return this.screen('SELLER-CHG-EMPTY', ctx, language, renderTelegramCopy('seller.charge.noCustomers', language), this.sellerMenuKeyboard(language));
    }
    const rows: TelegramInlineKeyboardMarkup['inline_keyboard'] = customers.map((c) => [
      { text: c.displayName ?? c.id.slice(0, 8), callback_data: `afws:sell:charge:cust:${c.id}` },
    ]);
    rows.push([this.btn('seller.btn.backToMenu', language, 'afws:sell:menu')]);
    return this.screen('SELLER-CHG-CUST', ctx, language, renderTelegramCopy('seller.charge.pickCustomer', language), { inline_keyboard: rows });
  }

  /** Step 2 — customer chosen; move to package selection. */
  private async handleSellerChargePickCustomer(
    ctx: Ctx,
    language: TelegramLanguage,
    seller: AdminResellerAccountSummary,
    customerId: string,
  ): Promise<TelegramBotWebhookResponse> {
    if (!ctx.fromId || !customerId) return this.screenSellerChargePickCustomer(ctx, language, seller);
    await setTelegramUserState(this.database, {
      telegramId: ctx.fromId,
      chatId: ctx.chatId,
      state: { sellerChargeStage: 'pick_package', sellerChargeCustomerId: customerId },
    });
    return this.screenSellerChargePickPackage(ctx, language);
  }

  private async screenSellerChargePickPackage(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    const packages = await this.listActivePackages();
    if (!packages.length) {
      return this.screen('SELLER-CHG-NOPKG', ctx, language, renderTelegramCopy('error.noPackages', language), this.sellerMenuKeyboard(language));
    }
    const rows: TelegramInlineKeyboardMarkup['inline_keyboard'] = packages.slice(0, MAX_PACKAGES_SHOWN).map((pkg) => [
      {
        text: renderTelegramCopy(
          'buy.pkgBtn',
          language,
          {},
          { size: formatDataSize(pkg.volumeBytes, language), price: formatAmount(pkg.totalPrice, pkg.currency, language) },
        ),
        callback_data: `afws:sell:charge:pkg:${pkg.id}`,
      },
    ]);
    rows.push([this.btn('seller.btn.cancel', language, 'afws:sell:charge:cancel')]);
    return this.screen('SELLER-CHG-PKG', ctx, language, renderTelegramCopy('seller.charge.pickPackage', language), { inline_keyboard: rows });
  }

  /** Step 3 — package chosen; generate the idempotency key now and show the confirm screen. */
  private async handleSellerChargePickPackage(
    ctx: Ctx,
    language: TelegramLanguage,
    seller: AdminResellerAccountSummary,
    user: TelegramUserRecord | null,
    packageId: string,
  ): Promise<TelegramBotWebhookResponse> {
    const customerId = user?.state?.sellerChargeCustomerId;
    if (!ctx.fromId || !customerId || !packageId) return this.screenSellerChargePickCustomer(ctx, language, seller);

    const packages = await this.listActivePackages();
    const pkg = packages.find((entry) => entry.id === packageId);
    if (!pkg) return this.screenSellerChargePickPackage(ctx, language);

    let customerName = customerId.slice(0, 8);
    try {
      const account = await this.billing.getCustomerAccount(customerId);
      customerName = account.displayName ?? customerName;
    } catch {
      return this.screenSellerChargePickCustomer(ctx, language, seller);
    }

    await setTelegramUserState(this.database, {
      telegramId: ctx.fromId,
      chatId: ctx.chatId,
      state: {
        sellerChargeStage: 'confirm',
        sellerChargeCustomerId: customerId,
        sellerChargePackageId: packageId,
        sellerChargeIdempotencyKey: randomUUID(),
      },
    });

    const text = renderTelegramCopy(
      'seller.charge.confirm',
      language,
      { customerName },
      { packageSize: formatDataSize(pkg.volumeBytes, language), cost: formatAmount(pkg.totalPrice, pkg.currency, language) },
    );
    return this.screen(
      'SELLER-CHG-CONFIRM',
      ctx,
      language,
      text,
      this.sellerRetryOrCancelKeyboard(language, 'afws:sell:charge:confirm', 'afws:sell:charge:cancel'),
    );
  }

  /** Step 4 — execute the sale, then notify the customer. */
  private async handleSellerChargeConfirm(
    ctx: Ctx,
    language: TelegramLanguage,
    seller: AdminResellerAccountSummary,
    user: TelegramUserRecord | null,
  ): Promise<TelegramBotWebhookResponse> {
    const state = user?.state;
    if (
      state?.sellerChargeStage !== 'confirm' ||
      !state.sellerChargeCustomerId ||
      !state.sellerChargePackageId ||
      !state.sellerChargeIdempotencyKey
    ) {
      return this.screenSellerChargePickCustomer(ctx, language, seller);
    }

    try {
      const saleResult = await this.billing.createResellerPackageSaleForReseller(
        seller.id,
        {
          volumePackageId: state.sellerChargePackageId,
          customerAccountId: state.sellerChargeCustomerId,
          idempotencyKey: state.sellerChargeIdempotencyKey,
        },
        undefined,
      );
      if (ctx.fromId) await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state: null });

      const customerName = saleResult.customerAccount.displayName ?? saleResult.customerAccount.id.slice(0, 8);
      const packageSize = formatDataSize(saleResult.allocation.volumeBytesDelta, language);
      await this.notifySellerCharged(saleResult.customerAccount.telegramId, saleResult.allocation.volumeBytesDelta);

      return this.screen(
        'SELLER-CHG-DONE',
        ctx,
        language,
        renderTelegramCopy('seller.charge.success', language, { customerName }, { packageSize }),
        this.sellerMenuKeyboard(language),
      );
    } catch {
      return this.screen(
        'SELLER-CHG-FAILED',
        ctx,
        language,
        renderTelegramCopy('seller.charge.failed', language),
        this.sellerRetryOrCancelKeyboard(language, 'afws:sell:charge:confirm', 'afws:sell:charge:cancel'),
      );
    }
  }

  private async handleSellerChargeCancel(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    if (ctx.fromId) await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state: null });
    return this.screen('SELLER-CHG-CANCEL', ctx, language, renderTelegramCopy('seller.charge.cancelled', language), this.sellerMenuKeyboard(language));
  }

  /** Best-effort push of `notify.sellerCharged` to the customer's own chat (never throws). */
  private async notifySellerCharged(customerTelegramId: string | null | undefined, volumeBytesDelta: number): Promise<void> {
    if (!customerTelegramId) return;
    try {
      const customerUser = await getTelegramUser(this.database, customerTelegramId);
      if (!customerUser?.chatId) return;
      const customerLanguage = normalizeTelegramLanguage(customerUser.language);
      const text = renderTelegramCopy(
        'notify.sellerCharged',
        customerLanguage,
        {},
        { packageSize: formatDataSize(volumeBytesDelta, customerLanguage) },
      );
      await this.pushNotification(customerUser.chatId, customerLanguage, text, this.menuOnlyKeyboard(customerLanguage));
    } catch {
      // best-effort — the sale already succeeded regardless
    }
  }

  // --- ➕ New customer ---------------------------------------------------------

  /** Step 1 — ask for the new customer's name. */
  private async screenSellerNewCustomerAskName(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    if (!ctx.fromId) return this.staleButton(ctx);
    await setTelegramUserState(this.database, {
      telegramId: ctx.fromId,
      chatId: ctx.chatId,
      state: { sellerNewCustomerStage: 'awaiting_name' },
    });
    const keyboard: TelegramInlineKeyboardMarkup = { inline_keyboard: [[this.btn('seller.btn.cancel', language, 'afws:sell:newcust:cancel')]] };
    return this.screen('SELLER-NEW-NAME', ctx, language, renderTelegramCopy('seller.newcust.askName', language), keyboard);
  }

  /** Step 1b — name typed; validate (same rule as customer registration) and move to package selection. */
  private async handleSellerNewCustomerName(
    ctx: Ctx,
    language: TelegramLanguage,
    user: TelegramUserRecord,
    rawText: string,
  ): Promise<TelegramBotWebhookResponse> {
    const name = rawText.trim();
    const valid = name.length >= 2 && name.length <= 40 && /\p{L}/u.test(name) && !name.startsWith('/');
    if (!valid) {
      await this.sendNew(ctx, language, renderTelegramCopy('reg.nameInvalid', language));
      return this.screenSellerNewCustomerAskName(ctx, language);
    }
    await this.mergeState(ctx, user, { sellerNewCustomerStage: 'pick_package', sellerNewCustomerName: name });
    return this.screenSellerNewCustomerPickPackage(ctx, language);
  }

  private async screenSellerNewCustomerPickPackage(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    const packages = await this.listActivePackages();
    if (!packages.length) {
      return this.sendNew(ctx, language, renderTelegramCopy('error.noPackages', language), this.sellerMenuKeyboard(language));
    }
    const rows: TelegramInlineKeyboardMarkup['inline_keyboard'] = packages.slice(0, MAX_PACKAGES_SHOWN).map((pkg) => [
      {
        text: renderTelegramCopy(
          'buy.pkgBtn',
          language,
          {},
          { size: formatDataSize(pkg.volumeBytes, language), price: formatAmount(pkg.totalPrice, pkg.currency, language) },
        ),
        callback_data: `afws:sell:newcust:pkg:${pkg.id}`,
      },
    ]);
    rows.push([this.btn('seller.btn.cancel', language, 'afws:sell:newcust:cancel')]);
    // A fresh message (not an edit): this step is reached from a typed name, not a callback.
    return this.sendNew(ctx, language, renderTelegramCopy('seller.newcust.pickPackage', language), { inline_keyboard: rows });
  }

  /** Step 2 — package chosen; generate the idempotency key now and show the confirm screen. */
  private async handleSellerNewCustomerPickPackage(
    ctx: Ctx,
    language: TelegramLanguage,
    seller: AdminResellerAccountSummary,
    user: TelegramUserRecord | null,
    packageId: string,
  ): Promise<TelegramBotWebhookResponse> {
    const name = user?.state?.sellerNewCustomerName;
    if (!ctx.fromId || !name || !packageId) return this.screenSellerNewCustomerAskName(ctx, language);

    const packages = await this.listActivePackages();
    const pkg = packages.find((entry) => entry.id === packageId);
    if (!pkg) return this.screenSellerNewCustomerPickPackage(ctx, language);

    await setTelegramUserState(this.database, {
      telegramId: ctx.fromId,
      chatId: ctx.chatId,
      state: {
        sellerNewCustomerStage: 'confirm',
        sellerNewCustomerName: name,
        sellerNewCustomerPackageId: packageId,
        sellerNewCustomerIdempotencyKey: randomUUID(),
      },
    });

    const text = renderTelegramCopy(
      'seller.newcust.confirm',
      language,
      { customerName: name },
      { packageSize: formatDataSize(pkg.volumeBytes, language), cost: formatAmount(pkg.totalPrice, pkg.currency, language) },
    );
    return this.screen(
      'SELLER-NEW-CONFIRM',
      ctx,
      language,
      text,
      this.sellerRetryOrCancelKeyboard(language, 'afws:sell:newcust:confirm', 'afws:sell:newcust:cancel'),
    );
  }

  /** Step 3 — create the customer + sell the package (one transaction), then provision a VLESS config. */
  private async handleSellerNewCustomerConfirm(
    ctx: Ctx,
    language: TelegramLanguage,
    seller: AdminResellerAccountSummary,
    user: TelegramUserRecord | null,
  ): Promise<TelegramBotWebhookResponse> {
    const state = user?.state;
    if (
      state?.sellerNewCustomerStage !== 'confirm' ||
      !state.sellerNewCustomerName ||
      !state.sellerNewCustomerPackageId ||
      !state.sellerNewCustomerIdempotencyKey
    ) {
      return this.screenSellerNewCustomerAskName(ctx, language);
    }

    try {
      const saleResult = await this.billing.createResellerPackageSaleForReseller(
        seller.id,
        {
          volumePackageId: state.sellerNewCustomerPackageId,
          customerAccount: { displayName: state.sellerNewCustomerName },
          idempotencyKey: state.sellerNewCustomerIdempotencyKey,
        },
        undefined,
      );
      if (ctx.fromId) await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state: null });

      const customerName = saleResult.customerAccount.displayName ?? state.sellerNewCustomerName;
      const packageSize = formatDataSize(saleResult.allocation.volumeBytesDelta, language);

      let bundle: ConfigLinkBundle | null = null;
      try {
        await this.billing.createClientConfig(saleResult.customerAccount.id, { protocol: 'vless' }, undefined);
        const primary = await this.billing.getPrimaryVlessEntryLinkForAccount(saleResult.customerAccount.id);
        bundle = primary?.bundle ?? null;
      } catch {
        // the sale already succeeded — config provisioning can be retried from the dashboard
      }

      const text = bundle
        ? renderTelegramCopy(
            'seller.newcust.success',
            language,
            { customerName },
            { packageSize, configBlock: renderConfigLinksBlock(bundle, language) },
          )
        : renderTelegramCopy('seller.newcust.successNoConfig', language, { customerName }, { packageSize });

      return this.screen('SELLER-NEW-DONE', ctx, language, text, this.sellerMenuKeyboard(language));
    } catch {
      return this.screen(
        'SELLER-NEW-FAILED',
        ctx,
        language,
        renderTelegramCopy('seller.newcust.failed', language),
        this.sellerRetryOrCancelKeyboard(language, 'afws:sell:newcust:confirm', 'afws:sell:newcust:cancel'),
      );
    }
  }

  private async handleSellerNewCustomerCancel(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    if (ctx.fromId) await setTelegramUserState(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, state: null });
    return this.screen('SELLER-NEW-CANCEL', ctx, language, renderTelegramCopy('seller.newcust.cancelled', language), this.sellerMenuKeyboard(language));
  }

  // --- Superadmin role -------------------------------------------------------
  //
  // Dashboard-independent operator access: create a customer and get its VLESS
  // link + QR from the phone. Unlike the seller flows this debits NO wallet and
  // sets no reseller_account_id — an admin-created account is a DIRECT customer,
  // exactly as if it had been created from the Customers page.
  //
  // Routing (telegram-admin-routing.ts): `afws:adm:*` drives admin actions;
  // "menu" is the superadmin home (admin actions + the full customer menu when
  // this Telegram id is linked to a customer account); customer buttons and
  // commands are delegated to the ordinary customer handlers for a linked admin.
  // Anything that is not the next step of the new-user flow abandons it.

  /** An operator is an approved bot admin iff their Telegram id is in telegram_bot_settings.allowed_admin_chat_ids. */
  private async findAdmin(telegramId: string | undefined): Promise<boolean> {
    if (!telegramId) return false;
    try {
      const summary = await this.telegramConfig.getSettingsSummary();
      return summary.allowedAdminChatIds.some((id) => String(id).trim() === telegramId);
    } catch {
      return false; // never let a settings hiccup escalate or block the other roles
    }
  }

  private async handleAdminText(ctx: Ctx, rawText: string): Promise<TelegramBotWebhookResponse> {
    const language = await this.languageFor(ctx.fromId);
    const user = ctx.fromId ? await getTelegramUser(this.database, ctx.fromId) : null;
    const { command } = this.parseCommand(rawText);
    const stage = user?.state?.adminNewUserStage;
    // Account lookup only matters for customer commands; skip it on the hot name step.
    const needsAccount = !(stage === 'awaiting_name' && command === null);
    const hasCustomerAccount = needsAccount ? (await this.findAccount(ctx)) !== null : false;
    const { route, abandonFlow } = routeAdminText(command, { stage, hasCustomerAccount });

    if (route === 'new-user-name' && user) return this.handleAdminNewUserName(ctx, language, user, rawText);
    if (abandonFlow) await this.clearAdminFlow(ctx);

    switch (route) {
      case 'language-settings':
        return this.screenLanguageSettings(ctx, language);
      case 'customer':
        await this.ensureLanguageRow(ctx, user, language);
        return this.handleText(ctx, rawText);
      case 'no-customer-account':
        return this.screenAdminMenu(ctx, language, { notice: renderTelegramCopy('admin.noCustomerAccount', language) });
      default:
        return this.screenAdminMenu(ctx, language);
    }
  }

  /**
   * Photo / document / contact from an admin. Only meaningful when the admin is
   * also a linked customer (receipt upload, connect-by-phone); an unlinked admin
   * must never fall into customer self-registration, so it is ignored there.
   */
  private async handleAdminNonText(ctx: Ctx, message: TelegramWebhookMessage): Promise<TelegramBotWebhookResponse> {
    if (!(await this.findAccount(ctx))) return { ok: true, status: 'ignored', reason: 'unsupported_update' };
    if (message.contact) return this.handleContact(ctx, message.contact);
    if (message.photoFileId) return this.handlePhoto(ctx, message.photoFileId);
    if (message.hasDocument) return this.handleDocument(ctx);
    return { ok: true, status: 'ignored', reason: 'unsupported_update' };
  }

  private async handleAdminCallback(ctx: Ctx, data: string): Promise<TelegramBotWebhookResponse> {
    const language = await this.languageFor(ctx.fromId);
    const user = ctx.fromId ? await getTelegramUser(this.database, ctx.fromId) : null;

    // Leaving the new-user flow by any other button abandons it, so its state
    // can never swallow a later tap or typed text.
    if (user?.state?.adminNewUserStage && adminCallbackAbandonsFlow(data)) await this.clearAdminFlow(ctx);

    const needsAccount = data.startsWith('afws:') && !data.startsWith('afws:adm:') && !data.startsWith('afws:lang') && data !== 'afws:menu' && data !== 'afws:retry';
    const hasCustomerAccount = needsAccount ? (await this.findAccount(ctx)) !== null : false;
    const route = routeAdminCallback(data, { hasCustomerAccount });

    switch (route.kind) {
      case 'admin':
        return this.handleAdminAction(ctx, language, user, data);
      case 'home':
        return this.screenAdminMenu(ctx, language);
      case 'language-pick':
        if (ctx.fromId) await setTelegramUserLanguage(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, language: route.language });
        return this.screenAdminMenu(ctx, route.language, { toast: renderTelegramCopy('lang.toast', route.language) });
      case 'language-settings':
        return this.screenLanguageSettings(ctx, language);
      case 'customer':
        await this.ensureLanguageRow(ctx, user, language);
        return this.handleCallback(ctx, data);
      case 'no-customer-account':
        return this.screenAdminMenu(ctx, language, { toast: renderTelegramCopy('admin.noCustomerAccount', language) });
      default:
        return this.staleButton(ctx);
    }
  }

  private async handleAdminAction(
    ctx: Ctx,
    language: TelegramLanguage,
    user: TelegramUserRecord | null,
    data: string,
  ): Promise<TelegramBotWebhookResponse> {
    if (data.startsWith('afws:adm:newuser:pkg:')) {
      return this.handleAdminNewUserPickPackage(ctx, language, user, data.slice('afws:adm:newuser:pkg:'.length));
    }
    switch (data) {
      case 'afws:adm:menu':
        return this.screenAdminMenu(ctx, language);
      case 'afws:adm:newuser':
        return this.screenAdminNewUserAskName(ctx, language);
      case 'afws:adm:newuser:confirm':
        return this.handleAdminNewUserConfirm(ctx, language, user);
      case 'afws:adm:newuser:cancel':
        return this.handleAdminNewUserCancel(ctx, language);
      default:
        return this.staleButton(ctx);
    }
  }

  /** Superadmin home keyboard: admin actions + (if linked) the full customer menu. */
  private async adminHomeKeyboard(ctx: Ctx, language: TelegramLanguage): Promise<TelegramInlineKeyboardMarkup> {
    const hasCustomerAccount = (await this.findAccount(ctx)) !== null;
    return this.layoutKeyboard(adminHomeLayout({ hasCustomerAccount }), language);
  }

  private async screenAdminMenu(
    ctx: Ctx,
    language: TelegramLanguage,
    options: { toast?: string; notice?: string } = {},
  ): Promise<TelegramBotWebhookResponse> {
    const title = renderTelegramCopy('admin.menu.title', language);
    const text = options.notice ? `${options.notice}\n\n${title}` : title;
    return this.screen('ADMIN-MENU', ctx, language, text, await this.adminHomeKeyboard(ctx, language), options.toast);
  }

  /** Drop only the admin new-user fields; any customer-side state (e.g. a pending charge) survives. */
  private async clearAdminFlow(ctx: Ctx): Promise<void> {
    await this.patchState(ctx, { adminNewUserStage: undefined, adminNewUserName: undefined, adminNewUserPackageId: undefined });
  }

  private async patchState(ctx: Ctx, patch: Partial<TelegramUserState>): Promise<void> {
    if (!ctx.fromId) return;
    const user = await getTelegramUser(this.database, ctx.fromId);
    await this.mergeState(ctx, user ?? { telegramId: ctx.fromId, chatId: ctx.chatId, language: null, state: null }, patch);
  }

  /**
   * The customer handlers require a chosen language (they re-show the picker /
   * stale-button otherwise). An admin may never have picked one — the admin
   * panel renders in the default — so persist that before delegating.
   */
  private async ensureLanguageRow(ctx: Ctx, user: TelegramUserRecord | null, language: TelegramLanguage): Promise<void> {
    if (!ctx.fromId || user?.language) return;
    await setTelegramUserLanguage(this.database, { telegramId: ctx.fromId, chatId: ctx.chatId, language });
  }

  private adminNewUserCancelKeyboard(language: TelegramLanguage): TelegramInlineKeyboardMarkup {
    return { inline_keyboard: [[this.btn('seller.btn.cancel', language, 'afws:adm:newuser:cancel')]] };
  }

  private async screenAdminNewUserAskName(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    if (!ctx.fromId) return this.staleButton(ctx);
    // A fresh start: drop any half-finished name/package from an earlier attempt.
    await this.patchState(ctx, { adminNewUserStage: 'awaiting_name', adminNewUserName: undefined, adminNewUserPackageId: undefined });
    return this.screen(
      'ADMIN-NEW-NAME',
      ctx,
      language,
      renderTelegramCopy('admin.newuser.askName', language),
      this.adminNewUserCancelKeyboard(language),
    );
  }

  private async handleAdminNewUserName(
    ctx: Ctx,
    language: TelegramLanguage,
    user: TelegramUserRecord,
    rawText: string,
  ): Promise<TelegramBotWebhookResponse> {
    const name = rawText.trim();
    const valid = name.length >= 2 && name.length <= 40 && /\p{L}/u.test(name) && !name.startsWith('/');
    if (!valid) {
      await this.sendNew(ctx, language, renderTelegramCopy('reg.nameInvalid', language));
      return this.screenAdminNewUserAskName(ctx, language);
    }
    await this.mergeState(ctx, user, { adminNewUserStage: 'pick_package', adminNewUserName: name });
    return this.screenAdminNewUserPickPackage(ctx, language);
  }

  private async screenAdminNewUserPickPackage(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    const packages = await this.listActivePackages();
    if (!packages.length) {
      await this.clearAdminFlow(ctx);
      return this.sendNew(ctx, language, renderTelegramCopy('error.noPackages', language), await this.adminHomeKeyboard(ctx, language));
    }
    const rows: TelegramInlineKeyboardMarkup['inline_keyboard'] = packages.slice(0, MAX_PACKAGES_SHOWN).map((pkg) => [
      {
        text: formatDataSize(pkg.volumeBytes, language),
        callback_data: `afws:adm:newuser:pkg:${pkg.id}`,
      },
    ]);
    rows.push(...this.adminNewUserCancelKeyboard(language).inline_keyboard);
    // Fresh message: this step is reached from typed text, not a callback.
    return this.sendNew(ctx, language, renderTelegramCopy('admin.newuser.pickPackage', language), { inline_keyboard: rows });
  }

  private async handleAdminNewUserPickPackage(
    ctx: Ctx,
    language: TelegramLanguage,
    user: TelegramUserRecord | null,
    packageId: string,
  ): Promise<TelegramBotWebhookResponse> {
    const name = user?.state?.adminNewUserName;
    if (!ctx.fromId || !name || !packageId) return this.screenAdminNewUserAskName(ctx, language);

    const packages = await this.listActivePackages();
    const pkg = packages.find((entry) => entry.id === packageId);
    if (!pkg) return this.screenAdminNewUserPickPackage(ctx, language);

    await this.patchState(ctx, { adminNewUserStage: 'confirm', adminNewUserName: name, adminNewUserPackageId: packageId });

    const text = renderTelegramCopy(
      'admin.newuser.confirm',
      language,
      { customerName: name },
      { packageSize: formatDataSize(pkg.volumeBytes, language) },
    );
    return this.screen(
      'ADMIN-NEW-CONFIRM',
      ctx,
      language,
      text,
      this.sellerRetryOrCancelKeyboard(language, 'afws:adm:newuser:confirm', 'afws:adm:newuser:cancel'),
    );
  }

  /** Create the customer at the package's quota, provision VLESS, return link + QR. */
  private async handleAdminNewUserConfirm(
    ctx: Ctx,
    language: TelegramLanguage,
    user: TelegramUserRecord | null,
  ): Promise<TelegramBotWebhookResponse> {
    const state = user?.state;
    if (state?.adminNewUserStage !== 'confirm' || !state.adminNewUserName || !state.adminNewUserPackageId) {
      return this.screenAdminNewUserAskName(ctx, language);
    }

    try {
      const packages = await this.listActivePackages();
      const pkg = packages.find((entry) => entry.id === state.adminNewUserPackageId);
      if (!pkg) return this.screenAdminNewUserPickPackage(ctx, language);

      const account = await this.billing.createCustomerAccount(
        { displayName: state.adminNewUserName, quotaLimitBytes: pkg.volumeBytes, status: 'active' },
        undefined,
      );
      await this.clearAdminFlow(ctx);

      let bundle: ConfigLinkBundle | null = null;
      try {
        await this.billing.createClientConfig(account.id, { protocol: 'vless' }, undefined);
        const primary = await this.billing.getPrimaryVlessEntryLinkForAccount(account.id);
        bundle = primary?.bundle ?? null;
      } catch {
        // account already exists; provisioning is retryable from the dashboard
      }

      const customerName = account.displayName ?? state.adminNewUserName;
      const packageSize = formatDataSize(pkg.volumeBytes, language);
      const text = bundle
        ? renderTelegramCopy('admin.newuser.success', language, { customerName }, { packageSize, configBlock: renderConfigLinksBlock(bundle, language) })
        : renderTelegramCopy('admin.newuser.successNoConfig', language, { customerName }, { packageSize });

      const result = await this.screen('ADMIN-NEW-DONE', ctx, language, text, await this.adminHomeKeyboard(ctx, language));

      // ONE QR as a separate photo so it can be scanned directly from the chat: the
      // subscription URL when available (adds every link), else the first link.
      const qrPayload = bundle ? configLinksQrPayload(bundle) : null;
      if (qrPayload) {
        try {
          const qrPng = await QRCode.toBuffer(qrPayload, { type: 'png', margin: 1, width: 512 });
          await this.telegram.sendPhoto(ctx.chatId, qrPng, {
            caption: renderTelegramCopy('admin.qrCaption', language, { customerName }),
            filename: 'afrows-vless-qr.png',
          });
        } catch {
          // the link itself already went out above
        }
      }
      return result;
    } catch {
      return this.screen(
        'ADMIN-NEW-FAILED',
        ctx,
        language,
        renderTelegramCopy('admin.newuser.failed', language),
        this.sellerRetryOrCancelKeyboard(language, 'afws:adm:newuser:confirm', 'afws:adm:newuser:cancel'),
      );
    }
  }

  private async handleAdminNewUserCancel(ctx: Ctx, language: TelegramLanguage): Promise<TelegramBotWebhookResponse> {
    await this.clearAdminFlow(ctx);
    const text = `${renderTelegramCopy('admin.newuser.cancelled', language)}\n\n${renderTelegramCopy('admin.menu.title', language)}`;
    return this.screen('ADMIN-NEW-CANCEL', ctx, language, text, await this.adminHomeKeyboard(ctx, language));
  }
}
