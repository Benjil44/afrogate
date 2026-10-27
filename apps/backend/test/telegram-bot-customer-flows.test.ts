/**
 * Drives the REAL TelegramBotService.handleUpdate (bundled with esbuild, see
 * helpers/load-bundled.ts) as a CUSTOMER or SELLER, with fake billing /
 * Telegram / database collaborators. Covers the dead-ends found in the
 * 2026-10-27 bot audit:
 *  - a deleted (archived) customer re-registering looped on E5 at the phone step;
 *  - an unknown user tapping an old button looped on the stale-button menu;
 *  - a customer without a live account got "contact support" with no contact;
 *  - a seller tapping a generic "Main menu"/"Retry" button looped on the customer menu;
 *  - slash commands / language changes during signup.
 */
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { bundledSkipReason, loadBundled } from './helpers/load-bundled.ts';
import { renderTelegramCopy, type TelegramCopyId, type TelegramLanguage } from '../src/telegram/telegram-i18n.ts';

type BotService = { handleUpdate(payload: unknown): Promise<{ ok: boolean; status: string }> };
type BotCtor = new (billing: unknown, telegram: unknown, config: unknown, database: unknown, topupAdmin?: unknown) => BotService;

let TelegramBotService: BotCtor | null = null;

const USER_ID = '700200';
const PACKAGE = { id: 'pkg-10', volumeBytes: 10_000_000_000, totalPrice: 100000, currency: 'IRR', status: 'active' };

interface Sent {
  kind: 'send' | 'edit';
  text: string;
  keyboard?: {
    inline_keyboard?: Array<Array<{ text: string; callback_data?: string }>>;
    keyboard?: Array<Array<{ text: string; request_contact?: boolean }>>;
    remove_keyboard?: boolean;
  };
}

interface UserRow {
  telegramId: string;
  chatId: string | null;
  language: string | null;
  state: Record<string, unknown> | null;
}

interface HarnessOptions {
  user?: Omit<UserRow, 'telegramId' | 'chatId'> | null;
  hasAccount?: boolean;
  seller?: boolean;
  /** An archived account still holds USER_ID's telegram_id (unique index conflict on create). */
  archivedHolder?: boolean;
  billingOverrides?: Record<string, (...args: unknown[]) => unknown>;
  /** Sender's Telegram @username (absent by default). */
  username?: string;
  /** Lower-cased @usernames carried by LIVE customer accounts (bound to any id). */
  liveUsernames?: string[];
}

function makeHarness(options: HarnessOptions = {}) {
  const users = new Map<string, UserRow>();
  if (options.user) users.set(USER_ID, { telegramId: USER_ID, chatId: USER_ID, ...options.user });
  const sent: Sent[] = [];
  const toasts: string[] = [];
  const created: Array<{ displayName: string; telegramId: string }> = [];
  const sql: string[] = [];
  let archivedHolder = Boolean(options.archivedHolder);
  let hasAccount = Boolean(options.hasAccount);

  const database = {
    async query(text: string, values: unknown[] = []) {
      sql.push(text);
      if (/FROM telegram_users/.test(text) && /WHERE telegram_id = \$1/.test(text)) {
        const row = users.get(String(values[0]));
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      if (/INSERT INTO telegram_users \(telegram_id, chat_id, language\)/.test(text)) {
        const [id, chatId, language] = values as [string, string, string];
        const row = users.get(id) ?? { telegramId: id, chatId, language: null, state: null };
        users.set(id, { ...row, chatId, language });
        return { rows: [], rowCount: 1 };
      }
      if (/INSERT INTO telegram_users \(telegram_id, chat_id, state\)/.test(text)) {
        const [id, chatId, state] = values as [string, string, string | null];
        const row = users.get(id) ?? { telegramId: id, chatId, language: null, state: null };
        users.set(id, { ...row, chatId, state: state === null ? null : JSON.parse(state) });
        return { rows: [], rowCount: 1 };
      }
      if (/FROM customer_accounts WHERE lower\(telegram_username\) = lower\(\$1\)/.test(text)) {
        const hit = (options.liveUsernames ?? []).includes(String(values[0]).toLowerCase());
        return { rows: hit ? [{ id: 'acct-paid' }] : [], rowCount: hit ? 1 : 0 };
      }
      if (/UPDATE customer_accounts/.test(text) && /deleted_at IS NOT NULL/.test(text)) {
        if (!archivedHolder || values[0] !== USER_ID) return { rows: [], rowCount: 0 };
        archivedHolder = false;
        return { rows: [{ id: 'acct-archived' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    async transaction<T>(run: (executor: unknown) => Promise<T>) {
      return run(database);
    },
  };

  const account = () => ({
    id: 'acct-1',
    displayName: 'Sara',
    status: 'active',
    quotaLimitBytes: 0,
    usedBytes: 0,
    remainingBytes: 0,
    gemsBalance: 0,
    referralCode: 'SARA01',
    expiresAt: null,
    activeClientCount: 1,
    clientCount: 1,
    resellerTelegramUsername: null,
  });
  const seller = { id: 'seller-1', displayName: 'Shop', currency: 'IRR', balanceAmount: 0, availableBalanceAmount: 0 };

  const billingImpl: Record<string, (...args: unknown[]) => unknown> = {
    getResellerByTelegramId: () => (options.seller ? seller : null),
    getTelegramBotAccountStatus: () => (hasAccount ? { status: 'found', account: account() } : { status: 'not_found' }),
    listVolumePackages: () => [PACKAGE],
    findCustomerAccountByPhone: () => [],
    generateUniqueReferralCode: () => 'NEWREF01',
    createCustomerAccount: (input) => {
      const dto = input as { displayName: string; telegramId: string };
      if (archivedHolder) {
        // Production shape: createCustomerAccount converts the 23505 into a Nest 409 (no `.code`).
        throw Object.assign(new Error('Customer account Telegram ID or paid number already exists'), { getStatus: () => 409 });
      }
      created.push({ displayName: dto.displayName, telegramId: dto.telegramId });
      hasAccount = true;
      return { id: 'acct-1', displayName: dto.displayName, status: 'active', quotaLimitBytes: 0, telegramId: dto.telegramId };
    },
    createClientConfig: () => ({ id: 'cfg-1' }),
    getClientConfigEntryLink: () => ({ link: 'vless://new@entry.example:443#Sara' }),
    recordTelegramRegistrationEvent: () => undefined,
    ...options.billingOverrides,
  };
  const billing = new Proxy(billingImpl, {
    get(target, prop: string) {
      return async (...args: unknown[]) => {
        const impl = target[prop];
        if (!impl) throw new Error(`unexpected billing.${prop}`);
        return impl(...args);
      };
    },
  });

  const telegram = {
    async sendMessage(_chat: string, text: string, opts: { replyMarkup?: Sent['keyboard'] } = {}) {
      sent.push({ kind: 'send', text, keyboard: opts.replyMarkup });
      return { status: 'sent' };
    },
    async editMessageText(_chat: string, _id: number, text: string, opts: { replyMarkup?: Sent['keyboard'] } = {}) {
      sent.push({ kind: 'edit', text, keyboard: opts.replyMarkup });
      return { status: 'edited' };
    },
    async answerCallbackQuery(_id: string, opts: { text?: string } = {}) {
      if (opts.text) toasts.push(opts.text);
    },
  };

  const config = {
    async getSettingsSummary() {
      return { allowedAdminChatIds: [], botUsername: 'Afrows_bot' };
    },
    async getRuntimeConfig() {
      return { commandsEnabled: true, cardToCardInfo: '6037-0000-0000-0000 | Ali', gemEconomy: { gemRedeemPerGb: 100 } };
    },
  };

  const service = new TelegramBotService!(billing, telegram, config, database);
  let seq = 0;
  return {
    sent,
    toasts,
    created,
    sql,
    users,
    last: () => sent[sent.length - 1],
    state: () => users.get(USER_ID)?.state ?? null,
    tap: (data: string) =>
      service.handleUpdate({
        callback_query: { id: `cb-${++seq}`, from: { id: Number(USER_ID), username: options.username }, message: { message_id: 5, chat: { id: Number(USER_ID) } }, data },
      }),
    type: (text: string) =>
      service.handleUpdate({ message: { message_id: 6, chat: { id: Number(USER_ID) }, from: { id: Number(USER_ID), username: options.username }, text } }),
    shareOwnPhone: (phone = '+989121234567') =>
      service.handleUpdate({
        message: {
          message_id: 7,
          chat: { id: Number(USER_ID) },
          from: { id: Number(USER_ID) },
          contact: { phone_number: phone, user_id: Number(USER_ID) },
        },
      }),
  };
}

const copy = (id: TelegramCopyId, lang: TelegramLanguage = 'fa') => renderTelegramCopy(id, lang);
const callbacks = (s: Sent | undefined) => (s?.keyboard?.inline_keyboard ?? []).flat().map((b) => b.callback_data);
const stripRlm = (text: string) => text.replace(/‏/g, '');

describe('Telegram bot customer/seller flows (audit 2026-10-27)', { skip: bundledSkipReason }, () => {
  before(() => {
    TelegramBotService = loadBundled<{ TelegramBotService: BotCtor }>('telegram/telegram-bot.service.ts', { quiet: true }).TelegramBotService;
  });

  describe('phone step', () => {
    it('a previously deleted customer completes signup instead of looping on the generic error', async () => {
      const h = makeHarness({
        user: { language: 'fa', state: { regStage: 'awaiting_phone', regName: 'پوریا' } },
        archivedHolder: true,
      });
      await h.shareOwnPhone();

      assert.equal(h.created.length, 1, 'the fresh account is created on the retry');
      assert.equal(h.created[0].telegramId, USER_ID);
      assert.ok(h.sql.some((q) => /SET telegram_id = NULL/.test(q) && /deleted_at IS NOT NULL/.test(q)), 'archived link released');
      assert.equal(h.state(), null, 'registration state cleared');
      const welcome = stripRlm(h.last()!.text);
      assert.ok(welcome.includes('پوریا'), 'welcome message names the user');
      assert.ok(!h.sent.some((m) => stripRlm(m.text) === stripRlm(copy('error.generic'))), 'no generic error');
    });

    it('a typed number is refused and the share button is re-sent, with a hint where to find it', async () => {
      const h = makeHarness({ user: { language: 'en', state: { regStage: 'awaiting_phone', regName: 'smart' } } });
      await h.type('09121234567');
      const reply = h.last()!;
      assert.equal(reply.text, copy('reg.phoneNeedButton', 'en'));
      assert.equal(reply.keyboard?.keyboard?.[0]?.[0]?.request_contact, true);
      assert.match(reply.text, /keyboard/i, 'tells the user how to reopen a collapsed button keyboard');
      assert.equal(h.state()?.regStage, 'awaiting_phone');
    });

    it('/start at the phone step re-asks for the phone (no "not a name" error)', async () => {
      const h = makeHarness({ user: { language: 'en', state: { regStage: 'awaiting_phone', regName: 'smart' } } });
      await h.type('/start');
      assert.equal(h.last()!.text, copy('reg.askPhone', 'en'));
      assert.equal(h.last()!.keyboard?.keyboard?.[0]?.[0]?.request_contact, true);
    });
  });

  describe('name step', () => {
    it('/start while asked for a name re-asks once, without the "not a name" error', async () => {
      const h = makeHarness({ user: { language: 'en', state: { regStage: 'awaiting_name' } } });
      await h.type('/start');
      assert.equal(h.sent.length, 1);
      assert.equal(h.last()!.text, copy('reg.askName', 'en'));
    });

    it('/language during signup opens the language picker instead of being rejected as a name', async () => {
      const h = makeHarness({ user: { language: 'en', state: { regStage: 'awaiting_name' } } });
      await h.type('/language');
      assert.equal(h.last()!.text, copy('lang.settings', 'en'));
      assert.deepEqual(callbacks(h.last()).slice(0, 2), ['afws:lang:fa', 'afws:lang:en']);
      assert.equal(h.state()?.regStage, 'awaiting_name', 'signup progress kept');
    });

    it('switching language mid-signup re-asks the current step in the new language', async () => {
      const h = makeHarness({ user: { language: 'en', state: { regStage: 'awaiting_name' } } });
      await h.tap('afws:lang:fa');
      assert.equal(h.users.get(USER_ID)?.language, 'fa');
      assert.equal(stripRlm(h.last()!.text), stripRlm(copy('reg.askName', 'fa')));
      assert.ok(h.toasts.includes(copy('lang.toast', 'fa')));
    });
  });

  describe('stale / missing-account buttons', () => {
    it('an unknown user tapping an old button gets the language picker, not an endless stale menu', async () => {
      const h = makeHarness({ user: null });
      await h.tap('afws:acct');
      assert.equal(h.last()!.text, copy('lang.prompt', 'en'));
      assert.deepEqual(callbacks(h.last()), ['afws:lang:fa', 'afws:lang:en']);
    });

    it('a customer whose account is gone is sent back into signup, not to "contact support"', async () => {
      const h = makeHarness({ user: { language: 'fa', state: null }, hasAccount: false });
      await h.tap('afws:acct');
      assert.equal(stripRlm(h.last()!.text), stripRlm(copy('reg.askName')));
      assert.equal(h.state()?.regStage, 'awaiting_name');
      assert.ok(!h.sent.some((m) => stripRlm(m.text) === stripRlm(copy('error.accountProblem'))));
    });
  });

  describe('no-account guard (never orphan a paid account)', () => {
    it('a live account carrying the sender @username (bound to another id) is audited, and signup still starts', async () => {
      const events: Array<{ event: unknown; details: unknown }> = [];
      const h = makeHarness({
        user: { language: 'fa', state: null },
        username: 'Pouria_x',
        liveUsernames: ['pouria_x'],
        billingOverrides: { recordTelegramRegistrationEvent: (event, details) => void events.push({ event, details }) },
      });
      await h.tap('afws:acct');
      assert.equal(stripRlm(h.last()!.text), stripRlm(copy('reg.askName')), 'a recycled @username never dead-ends the sender');
      assert.equal(h.state()?.regStage, 'awaiting_name');
      assert.equal(events.length, 1);
      assert.equal(events[0]!.event, 'username_held');
    });

    it('an ambiguous username lookup keeps E4', async () => {
      const h = makeHarness({
        user: { language: 'en', state: null },
        username: 'twins',
        billingOverrides: { getTelegramBotAccountStatus: () => ({ status: 'ambiguous' }) },
      });
      await h.tap('afws:cfg');
      assert.equal(h.last()!.text, copy('error.accountProblem', 'en'));
      assert.equal(h.state()?.regStage, undefined);
    });

    it('a clean not_found with an unused @username restarts signup', async () => {
      const h = makeHarness({ user: { language: 'en', state: null }, username: 'newcomer', liveUsernames: ['someone_else'] });
      await h.tap('afws:acct');
      assert.equal(h.last()!.text, copy('reg.askName', 'en'));
      assert.equal(h.state()?.regStage, 'awaiting_name');
    });
  });

  describe('gems redeem', () => {
    it('a second tap on the same Confirm button does not redeem twice', async () => {
      const redeems: number[] = [];
      let gems = 500;
      const h = makeHarness({
        user: { language: 'en', state: null },
        hasAccount: true,
        billingOverrides: {
          redeemCustomerGemsForGb: (_id, spend) => {
            redeems.push(spend as number);
            gems -= spend as number;
            return { gemsBalance: gems, quotaLimitAfterBytes: 2_000_000_000 };
          },
          getCustomerGemsLedger: () => [],
        },
      });
      await h.tap('afws:gems:redeem:ok:2');
      await h.tap('afws:gems:redeem:ok:2');
      assert.deepEqual(redeems, [200], 'only the first tap redeems (rate 100 gems/GB)');
      assert.equal(h.state()?.redeemedMessageId, 5);
    });

    it('re-opening the confirm on the same message (Back -> picker -> amount) redeems again when confirmed', async () => {
      const redeems: number[] = [];
      let gems = 500;
      const h = makeHarness({
        user: { language: 'en', state: null },
        hasAccount: true,
        billingOverrides: {
          getTelegramBotAccountStatus: () => ({ status: 'found', account: { id: 'acct-1', displayName: 'Sara', status: 'active', quotaLimitBytes: 0, usedBytes: 0, gemsBalance: gems } }),
          redeemCustomerGemsForGb: (_id, spend) => {
            redeems.push(spend as number);
            gems -= spend as number;
            return { gemsBalance: gems, quotaLimitAfterBytes: 2_000_000_000 };
          },
          getCustomerGemsLedger: () => [],
        },
      });
      await h.tap('afws:gems:redeem:ok:1');
      await h.tap('afws:gems:redeem:1'); // S12c re-rendered on message 5
      assert.equal(h.state()?.redeemedMessageId, undefined, 'marker cleared for the fresh confirm');
      await h.tap('afws:gems:redeem:ok:1');
      assert.deepEqual(redeems, [100, 100]);
    });
  });

  describe('seller', () => {
    it('"Main menu" / "Retry" on a generic screen opens the seller menu', async () => {
      for (const data of ['afws:menu', 'afws:retry']) {
        const h = makeHarness({ user: { language: 'en', state: null }, seller: true });
        await h.tap(data);
        assert.equal(h.last()!.text, copy('seller.menu.title', 'en'), data);
        assert.ok(callbacks(h.last()).every((cb) => cb?.startsWith('afws:sell:')), data);
      }
    });

    it('a stale customer button sends the seller menu (whose buttons a seller can actually use)', async () => {
      const h = makeHarness({ user: { language: 'en', state: null }, seller: true });
      await h.tap('afws:acct');
      assert.equal(h.last()!.text, copy('seller.menu.title', 'en'));
      assert.ok(h.toasts.includes(copy('error.staleButton', 'en')));
      assert.ok(callbacks(h.last()).every((cb) => cb?.startsWith('afws:sell:')));
    });

    it('a failing seller screen shows the error with the seller menu, not the customer retry loop', async () => {
      const h = makeHarness({
        user: { language: 'en', state: null },
        seller: true,
        billingOverrides: {
          listCustomerAccounts: () => {
            throw new Error('db down');
          },
        },
      });
      await h.tap('afws:sell:panel');
      assert.equal(h.last()!.text, copy('error.generic', 'en'));
      assert.ok(callbacks(h.last()).every((cb) => cb?.startsWith('afws:sell:')));
    });

    it('approving an already-reviewed receipt says so instead of "check your wallet balance"', async () => {
      const h = makeHarness({
        user: { language: 'en', state: null },
        seller: true,
        billingOverrides: {
          approveTelegramTopupViaReseller: () => {
            throw Object.assign(new Error('Only a pending top-up request can be approved'), { getStatus: () => 409 });
          },
        },
      });
      await h.tap('afws:sell:req:approve:abcdef12-0000-0000-0000-000000000000');
      assert.deepEqual(h.toasts, [renderTelegramCopy('admin.receipt.alreadyHandled', 'en', {}, { reference: 'ABCDEF' })]);
    });

    it('a slash command during "New customer" escapes to the seller menu instead of failing as a name', async () => {
      const h = makeHarness({ user: { language: 'en', state: { sellerNewCustomerStage: 'awaiting_name' } }, seller: true });
      await h.type('/start');
      assert.equal(h.last()!.text, copy('seller.menu.title', 'en'));
      assert.equal(h.state()?.sellerNewCustomerStage, undefined);
    });
  });
});
