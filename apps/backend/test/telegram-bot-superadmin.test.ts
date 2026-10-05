/**
 * Drives the REAL TelegramBotService.handleUpdate with a superadmin identity.
 *
 * The service uses Nest decorators + constructor parameter properties, which
 * Node's type stripping cannot load, so it is bundled in-memory with esbuild
 * (already in the workspace via Vite) and compiled as CJS. If esbuild is not
 * resolvable the suite is skipped; the pure routing contract is still covered
 * by telegram-admin-routing.test.ts.
 *
 * Regression for 0.115.37: every superadmin button / ☰ command used to land
 * in the "➕ New user" flow (or loop on the stale-button menu).
 */
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderTelegramCopy, type TelegramCopyId } from '../src/telegram/telegram-i18n.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
const requireFromBackend = createRequire(path.join(backendRoot, 'package.json'));

type BotService = { handleUpdate(payload: unknown): Promise<{ ok: boolean; status: string }> };
type BotCtor = new (billing: unknown, telegram: unknown, config: unknown, database: unknown) => BotService;

let TelegramBotService: BotCtor | null = null;
let skipReason: string | false = false;

function loadService(): BotCtor {
  requireFromBackend('reflect-metadata');
  const esbuild = requireFromBackend('esbuild') as typeof import('esbuild');
  const out = esbuild.buildSync({
    entryPoints: [path.join(backendRoot, 'src/telegram/telegram-bot.service.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    write: false,
    tsconfig: path.join(backendRoot, 'tsconfig.json'),
    target: 'node20',
    logLevel: 'error',
  });
  const filename = path.join(here, '__telegram-bot.service.bundle.cjs');
  const mod = new Module(filename) as Module & { _compile(code: string, filename: string): void; paths: string[] };
  mod.filename = filename;
  mod.paths = (Module as unknown as { _nodeModulePaths(dir: string): string[] })._nodeModulePaths(here);
  mod._compile(out.outputFiles[0].text, filename);
  return (mod.exports as { TelegramBotService: BotCtor }).TelegramBotService;
}

try {
  requireFromBackend.resolve('esbuild');
} catch {
  // In CI a silent skip would hide a regression in the admin routing; fail loudly
  // instead (esbuild is hoisted via Vite today — add it as a backend devDependency
  // if that ever changes).
  if (process.env.CI) throw new Error('esbuild must be resolvable from apps/backend in CI for the superadmin bot suite');
  skipReason = 'esbuild not resolvable from apps/backend';
}

const ADMIN_ID = '900100';
const CHAT_ID = '900100';
const PACKAGE = { id: 'pkg-10', volumeBytes: 10_000_000_000, totalPrice: 100000, currency: 'IRR', status: 'active' };

interface Sent {
  kind: 'send' | 'edit' | 'photo';
  text: string;
  keyboard?: { inline_keyboard?: Array<Array<{ text: string; callback_data?: string }>> };
}

interface UserRow {
  telegramId: string;
  chatId: string | null;
  language: string | null;
  state: Record<string, unknown> | null;
}

function makeHarness(options: { linkedCustomer: boolean; language?: 'fa' | 'en' | null }) {
  const users = new Map<string, UserRow>();
  if (options.language !== null) {
    users.set(ADMIN_ID, { telegramId: ADMIN_ID, chatId: CHAT_ID, language: options.language ?? 'en', state: null });
  }
  const sent: Sent[] = [];
  const toasts: string[] = [];
  const billingCalls: string[] = [];
  const created: Array<{ displayName: string; quotaLimitBytes: number }> = [];
  const topups: Array<{ receiptFileId: string; customerAccountId: string }> = [];

  const database = {
    async query(text: string, values: unknown[] = []) {
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
      if (/INSERT INTO telegram_topup_requests/.test(text)) {
        topups.push({ receiptFileId: String(values[6]), customerAccountId: String(values[0]) });
        return { rows: [{ id: `00000000-0000-0000-0000-00000000000${topups.length}` }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    async transaction<T>(run: (executor: unknown) => Promise<T>) {
      return run(database);
    },
  };

  const account = {
    id: 'acct-ben',
    displayName: 'Ben',
    status: 'active',
    quotaLimitBytes: 20_000_000_000,
    usedBytes: 5_000_000_000,
    gemsBalance: 3,
    referralCode: 'BEN123',
    expiresAt: null,
    resellerTelegramUsername: null,
  };

  const billingImpl: Record<string, (...args: unknown[]) => unknown> = {
    getResellerByTelegramId: () => null,
    getTelegramBotAccountStatus: () =>
      options.linkedCustomer ? { status: 'found', account } : { status: 'not_found' },
    listVolumePackages: () => [PACKAGE],
    createCustomerAccount: (input) => {
      created.push(input as { displayName: string; quotaLimitBytes: number });
      return { id: 'new-acct', displayName: (input as { displayName: string }).displayName };
    },
    createClientConfig: () => ({ id: 'cfg-1' }),
    getPrimaryVlessEntryLinkForAccount: () => ({ uri: 'vless://uuid@entry.example:443?security=reality#new' }),
    getCustomerAccount: () => ({ ...account, clientConfigs: [{ id: 'cfg-ben', protocol: 'vless', label: 'Ben', status: 'active' }] }),
    getClientConfigEntryLink: () => ({ link: 'vless://ben@entry.example:443#ben' }),
    ensureAccountReferralCode: () => 'BEN123',
    getReferralGemsEarned: () => 0,
    getCustomerGemsLedger: () => [],
  };
  const billing = new Proxy(billingImpl, {
    get(target, prop: string) {
      return async (...args: unknown[]) => {
        billingCalls.push(prop);
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
      return { status: 'sent' };
    },
    async sendPhoto(_chat: string, _png: Buffer, opts: { caption?: string } = {}) {
      sent.push({ kind: 'photo', text: opts.caption ?? '' });
      return { status: 'sent' };
    },
  };

  const config = {
    async getSettingsSummary() {
      return { allowedAdminChatIds: [ADMIN_ID], botUsername: 'Afrows_bot' };
    },
    async getRuntimeConfig() {
      return {
        commandsEnabled: true,
        cardToCardInfo: '6037-0000-0000-0000',
        gemEconomy: { inviteGems: 1, gemsPerGb: 1, maxRedeemGb: 10 },
      };
    },
  };

  const service = new TelegramBotService!(billing, telegram, config, database);
  let callbackSeq = 0;
  return {
    sent,
    toasts,
    billingCalls,
    created,
    topups,
    users,
    last: () => sent[sent.length - 1],
    tap: (data: string) =>
      service.handleUpdate({
        callback_query: {
          id: `cb-${++callbackSeq}`,
          from: { id: Number(ADMIN_ID) },
          message: { message_id: 7, chat: { id: Number(CHAT_ID) } },
          data,
        },
      }),
    type: (text: string) =>
      service.handleUpdate({ message: { message_id: 8, chat: { id: Number(CHAT_ID) }, from: { id: Number(ADMIN_ID) }, text } }),
    photo: (fileId: string) =>
      service.handleUpdate({
        message: { message_id: 9, chat: { id: Number(CHAT_ID) }, from: { id: Number(ADMIN_ID) }, photo: [{ file_id: fileId, width: 800, height: 600 }] },
      }),
    state: () => users.get(ADMIN_ID)?.state ?? null,
  };
}

const copy = (id: TelegramCopyId, lang: 'fa' | 'en' = 'en') => renderTelegramCopy(id, lang);
const buttons = (s: Sent | undefined) => (s?.keyboard?.inline_keyboard ?? []).flat().map((b) => b.callback_data);
const askName = copy('admin.newuser.askName');
const adminTitle = copy('admin.menu.title');

describe('superadmin via handleUpdate', { skip: skipReason }, () => {
  before(() => {
    TelegramBotService = loadService();
  });

  it('/start shows the superadmin home with New user + the full customer menu (linked admin)', async () => {
    const h = makeHarness({ linkedCustomer: true });
    await h.type('/start');
    assert.ok(h.last()!.text.includes(adminTitle));
    assert.deepEqual(buttons(h.last()), [
      'afws:adm:newuser',
      'afws:acct',
      'afws:buy',
      'afws:cfg',
      'afws:invite',
      'afws:gems',
      'afws:connect',
      'afws:lang',
      'afws:help',
    ]);
  });

  it('each customer button on the superadmin home opens its own screen — never the new-user flow', async () => {
    const expectations: Array<[string, (text: string) => boolean]> = [
      ['afws:acct', (t) => t.includes('Ben')],
      ['afws:buy', (t) => t.includes(copy('buy.pickPackage').split('\n')[0])],
      ['afws:cfg', (t) => t.includes(copy('cfg.title').split('\n')[0])],
      ['afws:invite', (t) => t.includes('BEN123')],
      ['afws:gems', (t) => t.includes(copy('gems.historyEmpty').split('\n')[0])],
      ['afws:connect', (t) => t.includes(copy('connect.intro').split('\n')[0])],
      ['afws:lang', (t) => t.includes(copy('lang.settings').split('\n')[0])],
      ['afws:help', (t) => t.includes(copy('help.body').split('\n')[0])],
    ];
    for (const [data, check] of expectations) {
      const h = makeHarness({ linkedCustomer: true });
      await h.tap(data);
      const text = h.last()!.text;
      assert.ok(!text.includes(askName), `${data} must not open the new-user flow`);
      assert.ok(!text.includes(copy('error.generic')), `${data} crashed: ${text}`);
      assert.ok(check(text), `${data} rendered the wrong screen: ${text}`);
      assert.equal(h.state()?.adminNewUserStage, undefined, data);
    }
  });

  it('every ☰ command routes to its handler, even while a stale new-user name prompt is pending', async () => {
    const commands: Array<[string, (text: string) => boolean]> = [
      ['/menu', (t) => t.includes(adminTitle)],
      ['/status', (t) => t.includes('Ben')],
      ['/invite', (t) => t.includes('BEN123')],
      ['/help', (t) => t.includes(copy('help.body').split('\n')[0])],
      ['/connect', (t) => t.includes(copy('connect.intro').split('\n')[0])],
    ];
    for (const [command, check] of commands) {
      const h = makeHarness({ linkedCustomer: true });
      await h.tap('afws:adm:newuser'); // leaves adminNewUserStage = awaiting_name behind
      assert.equal(h.state()?.adminNewUserStage, 'awaiting_name');
      await h.type(command);
      const text = h.last()!.text;
      assert.ok(!text.includes(askName) && !text.includes(copy('reg.nameInvalid')), `${command} was swallowed as a name`);
      assert.ok(check(text), `${command} rendered the wrong screen: ${text}`);
      assert.equal(h.state()?.adminNewUserStage, undefined, `${command} must abandon the flow`);
    }
  });

  it('a customer button tapped mid-flow abandons the flow (stale state cannot hijack later text)', async () => {
    const h = makeHarness({ linkedCustomer: true });
    await h.tap('afws:adm:newuser');
    await h.tap('afws:acct');
    assert.equal(h.state()?.adminNewUserStage, undefined);
    await h.type('hello there');
    assert.ok(h.last()!.text.includes(adminTitle), 'plain text after leaving the flow shows the home, not a package picker');
    assert.equal(h.created.length, 0);
  });

  it('"🏠 Menu" from a customer screen returns to the superadmin home', async () => {
    const h = makeHarness({ linkedCustomer: true });
    await h.tap('afws:menu');
    assert.ok(h.last()!.text.includes(adminTitle));
    assert.ok(buttons(h.last()).includes('afws:adm:newuser'));
  });

  it('unlinked admin: home shows only New user + language; old customer buttons/commands explain, never register', async () => {
    const h = makeHarness({ linkedCustomer: false, language: null });
    await h.type('/start');
    assert.deepEqual(buttons(h.last()), ['afws:adm:newuser', 'afws:lang']);

    await h.tap('afws:acct');
    assert.ok(h.toasts.includes(renderTelegramCopy('admin.noCustomerAccount', 'fa')));
    assert.ok(h.last()!.text.includes(renderTelegramCopy('admin.menu.title', 'fa')));

    await h.type('/status');
    assert.ok(h.last()!.text.includes(renderTelegramCopy('admin.noCustomerAccount', 'fa')));
    assert.ok(!h.billingCalls.includes('createCustomerAccount'));
    assert.equal(h.state()?.regStage, undefined, 'admin must never enter customer self-registration');
  });

  it('language buttons switch the language without starting registration', async () => {
    const h = makeHarness({ linkedCustomer: false, language: null });
    await h.tap('afws:lang:en');
    assert.equal(h.users.get(ADMIN_ID)?.language, 'en');
    assert.ok(h.last()!.text.includes(adminTitle));
    assert.ok(h.toasts.includes(copy('lang.toast')));
    assert.equal(h.state()?.regStage, undefined);
  });

  it('New user end-to-end: name → package → confirm creates a direct customer and sends link + QR', async () => {
    const h = makeHarness({ linkedCustomer: true });
    await h.tap('afws:adm:newuser');
    assert.ok(h.last()!.text.includes(askName));
    assert.deepEqual(buttons(h.last()), ['afws:adm:newuser:cancel']);

    await h.type('Sara');
    assert.ok(h.last()!.text.includes(copy('admin.newuser.pickPackage')));
    assert.deepEqual(buttons(h.last()), ['afws:adm:newuser:pkg:pkg-10', 'afws:adm:newuser:cancel']);

    await h.tap('afws:adm:newuser:pkg:pkg-10');
    assert.equal(h.state()?.adminNewUserStage, 'confirm');
    await h.tap('afws:adm:newuser:confirm');

    assert.deepEqual(h.created, [{ displayName: 'Sara', quotaLimitBytes: 10_000_000_000, status: 'active' }]);
    const done = h.sent.find((s) => s.text.includes('vless://uuid@entry.example'));
    assert.ok(done, 'success message carries the vless link');
    assert.ok(buttons(done).includes('afws:adm:newuser'), 'success returns to the superadmin home keyboard');
    assert.equal(h.last()!.kind, 'photo');
    assert.equal(h.state()?.adminNewUserStage, undefined);
  });

  it('New user cancel at each step clears the flow and returns home without creating anything', async () => {
    for (const steps of [[] as string[], ['Sara'], ['Sara', 'afws:adm:newuser:pkg:pkg-10']]) {
      const h = makeHarness({ linkedCustomer: true });
      await h.tap('afws:adm:newuser');
      for (const step of steps) await (step.startsWith('afws:') ? h.tap(step) : h.type(step));
      await h.tap('afws:adm:newuser:cancel');
      assert.ok(h.last()!.text.includes(copy('admin.newuser.cancelled')), `cancel after ${steps.length} steps`);
      assert.ok(buttons(h.last()).includes('afws:acct'));
      assert.equal(h.state()?.adminNewUserStage, undefined);
      assert.equal(h.state()?.adminNewUserName, undefined);
      assert.equal(h.created.length, 0);
    }
  });

  it('cancelling the admin flow keeps an unrelated customer-side pending charge', async () => {
    const h = makeHarness({ linkedCustomer: true });
    h.users.set(ADMIN_ID, {
      telegramId: ADMIN_ID,
      chatId: CHAT_ID,
      language: 'en',
      state: { pendingPackageId: 'pkg-10', pendingStartedAt: new Date().toISOString() },
    });
    await h.tap('afws:adm:newuser');
    await h.tap('afws:adm:newuser:cancel');
    assert.equal(h.state()?.pendingPackageId, 'pkg-10');
  });
  it('linked admin: buy -> package -> receipt photo creates a top-up request (admin is not swallowed)', async () => {
    const h = makeHarness({ linkedCustomer: true });
    await h.tap('afws:buy:pkg:pkg-10');
    assert.equal(h.state()?.pendingPackageId, 'pkg-10');
    await h.photo('file-abc');
    assert.deepEqual(h.topups, [{ receiptFileId: 'file-abc', customerAccountId: 'acct-ben' }]);
    assert.equal(h.state()?.pendingPackageId, undefined);
  });

  it('linked admin: a photo with no pending charge gets the customer "no charge" reply, not the new-user flow', async () => {
    const h = makeHarness({ linkedCustomer: true });
    await h.photo('file-x');
    assert.equal(h.topups.length, 0);
    assert.ok(h.last()!.text.includes(copy('error.photoNoCharge').slice(0, 12)));
  });

  it('unlinked admin: a photo is ignored (no registration, no top-up, no message)', async () => {
    const h = makeHarness({ linkedCustomer: false });
    const res = await h.photo('file-x');
    assert.equal(res.status, 'ignored');
    assert.equal(h.sent.length, 0);
    assert.equal(h.topups.length, 0);
    assert.equal(h.state()?.regStage, undefined);
  });

  it('a photo sent mid new-user flow does not clear the flow', async () => {
    const h = makeHarness({ linkedCustomer: true });
    await h.tap('afws:adm:newuser');
    await h.photo('file-x');
    assert.equal(h.state()?.adminNewUserStage, 'awaiting_name');
  });

  it('admin tapping a seller-namespace or unknown callback gets the admin home (stale toast), never new-user', async () => {
    for (const linked of [true, false]) {
      const h = makeHarness({ linkedCustomer: linked });
      await h.tap('afws:sel:wallet');
      const text = h.last()!.text;
      assert.ok(!text.includes(askName));
      assert.ok(text.includes(adminTitle));
      await h.tap('garbage');
      assert.ok(h.last()!.text.includes(adminTitle));
      assert.ok(h.toasts.includes(copy('error.staleButton')) || !linked);
    }
  });

  it('double-tapping Confirm (sequential) creates exactly one account', async () => {
    const h = makeHarness({ linkedCustomer: true });
    await h.tap('afws:adm:newuser');
    await h.type('Sara');
    await h.tap('afws:adm:newuser:pkg:pkg-10');
    await h.tap('afws:adm:newuser:confirm');
    await h.tap('afws:adm:newuser:confirm');
    assert.equal(h.created.length, 1);
    assert.ok(h.last()!.text.includes(askName), 'second tap restarts the flow instead of creating again');
  });

  it('/cancel and unknown slash commands mid-flow abandon it and show the home', async () => {
    for (const command of ['/cancel', '/whatever']) {
      const h = makeHarness({ linkedCustomer: false });
      await h.tap('afws:adm:newuser');
      await h.type(command);
      assert.ok(h.last()!.text.includes(adminTitle), command);
      assert.equal(h.state()?.adminNewUserStage, undefined, command);
      assert.equal(h.created.length, 0);
    }
  });

  it('names: 40 chars and RTL accepted; 41 chars rejected; HTML-special names are escaped in the confirm screen', async () => {
    const ok = ['ا'.repeat(40), 'علی رضایی', 'a'.repeat(40)];
    for (const name of ok) {
      const h = makeHarness({ linkedCustomer: false });
      await h.tap('afws:adm:newuser');
      await h.type(name);
      assert.equal(h.state()?.adminNewUserName, name);
      assert.equal(h.state()?.adminNewUserStage, 'pick_package');
    }
    const h = makeHarness({ linkedCustomer: false });
    await h.tap('afws:adm:newuser');
    await h.type('a'.repeat(41));
    assert.equal(h.state()?.adminNewUserStage, 'awaiting_name');
    assert.ok(h.last()!.text.includes(askName));

    await h.type('<b>Eve & Co');
    await h.tap('afws:adm:newuser:pkg:pkg-10');
    const confirm = h.last()!.text;
    assert.ok(!confirm.includes('<b>Eve'), 'raw HTML from the name must not reach Telegram');
    assert.ok(confirm.includes('&lt;b&gt;Eve &amp; Co'));
  });

  it('Persian UI: admin home and unlinked notice render in fa when language is fa', async () => {
    const h = makeHarness({ linkedCustomer: false, language: 'fa' });
    await h.type('/status');
    assert.ok(h.last()!.text.includes(renderTelegramCopy('admin.noCustomerAccount', 'fa')));
    assert.ok(h.last()!.keyboard!.inline_keyboard![0][0].text === renderTelegramCopy('admin.menu.btn.newUser', 'fa'));
  });
});
