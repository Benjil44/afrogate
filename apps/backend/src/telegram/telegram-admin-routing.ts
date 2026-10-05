import type { TelegramCopyId, TelegramLanguage } from './telegram-i18n';

/**
 * Superadmin routing for the afroWS bot — pure, so it is unit-testable without
 * Nest/DB (only type imports, same convention as telegram-format/-connect).
 *
 * A superadmin (Telegram id in telegram_bot_settings.allowed_admin_chat_ids) is
 * resolved before the seller/customer branches. The 0.115.37 dispatcher sent
 * EVERY admin text to the admin panel (whose only button is "➕ New user") and
 * EVERY non-`afws:adm:*` callback to the stale-button fallback, which re-sent
 * the customer main menu — and a lingering `adminNewUserStage: 'awaiting_name'`
 * swallowed every later text as the new user's name. Net effect: the ☰ command
 * menu and the customer buttons all led back into the new-user flow.
 *
 * Contract now:
 *  - `afws:adm:*` drives the admin actions; "menu" (`afws:menu`, `/start`,
 *    `/menu`, plain text) means the SUPERADMIN home, which also carries the
 *    normal customer menu when the admin's Telegram id is linked to a customer
 *    account.
 *  - Customer buttons/commands are delegated to the ordinary customer handlers
 *    for a linked admin; an unlinked admin is told there is no account instead
 *    of being dropped into self-registration.
 *  - Anything that is not the next step of an in-progress admin flow abandons
 *    it, so stale flow state can never hijack another button.
 */

/** One inline button as data: copy id + callback_data (rendered by the service). */
export interface TelegramMenuButtonSpec {
  copyId: TelegramCopyId;
  data: string;
}

export type TelegramMenuLayout = TelegramMenuButtonSpec[][];

/** The customer main menu (S2). Single source for the customer AND superadmin keyboards. */
export const CUSTOMER_MAIN_MENU_LAYOUT: TelegramMenuLayout = [
  [
    { copyId: 'menu.btn.account', data: 'afws:acct' },
    { copyId: 'menu.btn.buy', data: 'afws:buy' },
  ],
  [{ copyId: 'menu.btn.configs', data: 'afws:cfg' }],
  [
    { copyId: 'menu.btn.invite', data: 'afws:invite' },
    { copyId: 'menu.btn.gems', data: 'afws:gems' },
  ],
  [{ copyId: 'menu.btn.connect', data: 'afws:connect' }],
  [
    { copyId: 'menu.btn.lang', data: 'afws:lang' },
    { copyId: 'menu.btn.help', data: 'afws:help' },
  ],
];

export const ADMIN_CALLBACK_PREFIX = 'afws:adm:';
export const ADMIN_NEW_USER_CALLBACK_PREFIX = 'afws:adm:newuser';

/**
 * Superadmin home keyboard. Admin actions first; then the full customer menu
 * when this Telegram id has a customer account, otherwise only the language
 * row (account/buy/configs/invite/gems/connect/help are meaningless without a
 * customer account, so they are not shown rather than shown-and-broken).
 */
export function adminHomeLayout(options: { hasCustomerAccount: boolean }): TelegramMenuLayout {
  const adminRows: TelegramMenuLayout = [[{ copyId: 'admin.menu.btn.newUser', data: 'afws:adm:newuser' }]];
  const tail: TelegramMenuLayout = options.hasCustomerAccount
    ? CUSTOMER_MAIN_MENU_LAYOUT
    : [[{ copyId: 'menu.btn.lang', data: 'afws:lang' }]];
  return [...adminRows, ...tail];
}

export type AdminCallbackRoute =
  /** `afws:adm:*` — an admin action (the new-user flow and the admin menu). */
  | { kind: 'admin' }
  /** Superadmin home (customer "🏠 Menu"/"Retry" buttons land here for an admin). */
  | { kind: 'home' }
  | { kind: 'language-pick'; language: TelegramLanguage }
  | { kind: 'language-settings' }
  /** Hand the callback to the ordinary customer dispatcher (admin is a linked customer). */
  | { kind: 'customer' }
  /** A customer-only button from an admin with no customer account. */
  | { kind: 'no-customer-account' }
  /** Not an afroWS callback at all. */
  | { kind: 'stale' };

export function routeAdminCallback(data: string, options: { hasCustomerAccount: boolean }): AdminCallbackRoute {
  if (!data.startsWith('afws:')) return { kind: 'stale' };
  if (data.startsWith(ADMIN_CALLBACK_PREFIX)) return { kind: 'admin' };
  if (data === 'afws:menu' || data === 'afws:retry') return { kind: 'home' };
  if (data === 'afws:lang:fa') return { kind: 'language-pick', language: 'fa' };
  if (data === 'afws:lang:en') return { kind: 'language-pick', language: 'en' };
  if (data === 'afws:lang') return { kind: 'language-settings' };
  return options.hasCustomerAccount ? { kind: 'customer' } : { kind: 'no-customer-account' };
}

/** Only the new-user flow's own buttons keep its state; every other tap abandons it. */
export function adminCallbackAbandonsFlow(data: string): boolean {
  return !data.startsWith(ADMIN_NEW_USER_CALLBACK_PREFIX);
}

/** Slash commands as parsed by the bot (`null` = plain text, not a command). */
export type TelegramBotCommand =
  | 'start'
  | 'menu'
  | 'status'
  | 'charge'
  | 'invite'
  | 'gems'
  | 'connect'
  | 'help'
  | 'language'
  | 'unknown'
  | null;

export type AdminNewUserStage = 'awaiting_name' | 'pick_package' | 'confirm';

export type AdminTextRoute = 'new-user-name' | 'home' | 'language-settings' | 'customer' | 'no-customer-account';

const CUSTOMER_COMMANDS: ReadonlySet<TelegramBotCommand> = new Set(['status', 'charge', 'invite', 'gems', 'connect', 'help']);

export function routeAdminText(
  command: TelegramBotCommand,
  options: { stage: AdminNewUserStage | undefined; hasCustomerAccount: boolean },
): { route: AdminTextRoute; abandonFlow: boolean } {
  // Only PLAIN text at the name step is the name. A slash command (the ☰ menu)
  // is never a name: it escapes the flow and does what it says.
  if (options.stage === 'awaiting_name' && command === null) return { route: 'new-user-name', abandonFlow: false };
  const abandonFlow = options.stage !== undefined;
  if (command === 'language') return { route: 'language-settings', abandonFlow };
  if (CUSTOMER_COMMANDS.has(command)) {
    return { route: options.hasCustomerAccount ? 'customer' : 'no-customer-account', abandonFlow };
  }
  return { route: 'home', abandonFlow }; // start / menu / unknown / plain text
}
