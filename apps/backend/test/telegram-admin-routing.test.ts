import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adminCallbackAbandonsFlow,
  adminHomeLayout,
  CUSTOMER_MAIN_MENU_LAYOUT,
  routeAdminCallback,
  routeAdminText,
  type AdminNewUserStage,
  type TelegramBotCommand,
} from '../src/telegram/telegram-admin-routing.ts';
import { TELEGRAM_COPY } from '../src/telegram/telegram-i18n.ts';

const flatten = <T>(rows: T[][]): T[] => rows.flat();

describe('superadmin home layout', () => {
  it('linked admin: New user + the full customer main menu, each copy id exists', () => {
    const buttons = flatten(adminHomeLayout({ hasCustomerAccount: true }));
    assert.deepEqual(buttons[0], { copyId: 'admin.menu.btn.newUser', data: 'afws:adm:newuser' });
    assert.deepEqual(buttons.slice(1), flatten(CUSTOMER_MAIN_MENU_LAYOUT));
    for (const button of buttons) assert.ok(TELEGRAM_COPY[button.copyId], `missing copy ${button.copyId}`);
  });

  it('unlinked admin: no customer-only buttons (they would be meaningless), only New user + language', () => {
    const data = flatten(adminHomeLayout({ hasCustomerAccount: false })).map((b) => b.data);
    assert.deepEqual(data, ['afws:adm:newuser', 'afws:lang']);
  });
});

describe('superadmin callback routing — every visible button does what its label says', () => {
  const expectedLinked: Record<string, string> = {
    'afws:adm:newuser': 'admin',
    'afws:acct': 'customer',
    'afws:buy': 'customer',
    'afws:cfg': 'customer',
    'afws:invite': 'customer',
    'afws:gems': 'customer',
    'afws:connect': 'customer',
    'afws:lang': 'language-settings',
    'afws:help': 'customer',
  };

  it('linked admin: only the New user button enters the admin flow', () => {
    for (const button of flatten(adminHomeLayout({ hasCustomerAccount: true }))) {
      const route = routeAdminCallback(button.data, { hasCustomerAccount: true });
      assert.equal(route.kind, expectedLinked[button.data], `${button.copyId} (${button.data})`);
      if (button.copyId !== 'admin.menu.btn.newUser') assert.notEqual(route.kind, 'admin', button.data);
    }
  });

  it('unlinked admin: every visible button routes to its own handler', () => {
    for (const button of flatten(adminHomeLayout({ hasCustomerAccount: false }))) {
      const route = routeAdminCallback(button.data, { hasCustomerAccount: false });
      assert.equal(route.kind, button.data === 'afws:adm:newuser' ? 'admin' : 'language-settings', button.data);
    }
  });

  it('sub-screen customer buttons (refresh, QR, buy package, gems) are delegated for a linked admin', () => {
    for (const data of ['afws:acct:refresh', 'afws:cfg:qr', 'afws:buy:pkg:p1', 'afws:buy:cancel', 'afws:gems:redeem:5', 'afws:invite:refresh']) {
      assert.deepEqual(routeAdminCallback(data, { hasCustomerAccount: true }), { kind: 'customer' }, data);
    }
  });

  it('an old customer button from an UNLINKED admin explains instead of starting registration or new-user', () => {
    assert.deepEqual(routeAdminCallback('afws:acct', { hasCustomerAccount: false }), { kind: 'no-customer-account' });
    assert.deepEqual(routeAdminCallback('afws:buy:pkg:p1', { hasCustomerAccount: false }), { kind: 'no-customer-account' });
  });

  it('"🏠 Menu"/"Retry" mean the superadmin home; language buttons switch language without registration', () => {
    for (const linked of [true, false]) {
      assert.deepEqual(routeAdminCallback('afws:menu', { hasCustomerAccount: linked }), { kind: 'home' });
      assert.deepEqual(routeAdminCallback('afws:retry', { hasCustomerAccount: linked }), { kind: 'home' });
      assert.deepEqual(routeAdminCallback('afws:lang:fa', { hasCustomerAccount: linked }), { kind: 'language-pick', language: 'fa' });
      assert.deepEqual(routeAdminCallback('afws:lang:en', { hasCustomerAccount: linked }), { kind: 'language-pick', language: 'en' });
    }
  });

  it('admin-namespace and foreign callbacks', () => {
    for (const data of ['afws:adm:menu', 'afws:adm:newuser:pkg:p1', 'afws:adm:newuser:confirm', 'afws:adm:newuser:cancel']) {
      assert.deepEqual(routeAdminCallback(data, { hasCustomerAccount: false }), { kind: 'admin' }, data);
    }
    assert.deepEqual(routeAdminCallback('garbage', { hasCustomerAccount: true }), { kind: 'stale' });
  });

  it('only the new-user flow buttons keep its state; any other tap abandons it', () => {
    for (const data of ['afws:adm:newuser', 'afws:adm:newuser:pkg:p1', 'afws:adm:newuser:confirm', 'afws:adm:newuser:cancel']) {
      assert.equal(adminCallbackAbandonsFlow(data), false, data);
    }
    for (const data of ['afws:acct', 'afws:buy', 'afws:menu', 'afws:lang', 'afws:adm:menu', 'afws:help']) {
      assert.equal(adminCallbackAbandonsFlow(data), true, data);
    }
  });
});

describe('superadmin text routing (☰ command menu + typed text)', () => {
  const route = (command: TelegramBotCommand, stage?: AdminNewUserStage, hasCustomerAccount = true) =>
    routeAdminText(command, { stage, hasCustomerAccount });

  it('plain text is the name ONLY while awaiting the new user name', () => {
    assert.deepEqual(route(null, 'awaiting_name'), { route: 'new-user-name', abandonFlow: false });
    assert.deepEqual(route(null), { route: 'home', abandonFlow: false });
    assert.deepEqual(route(null, 'confirm'), { route: 'home', abandonFlow: true });
  });

  it('a slash command mid-flow escapes it and does what it says (the reported bug)', () => {
    assert.deepEqual(route('status', 'awaiting_name'), { route: 'customer', abandonFlow: true });
    assert.deepEqual(route('charge', 'awaiting_name'), { route: 'customer', abandonFlow: true });
    assert.deepEqual(route('start', 'awaiting_name'), { route: 'home', abandonFlow: true });
    assert.deepEqual(route('language', 'pick_package'), { route: 'language-settings', abandonFlow: true });
  });

  it('every published bot command routes to its handler, never to new-user', () => {
    const expected: Record<string, string> = {
      start: 'home',
      menu: 'home',
      status: 'customer',
      charge: 'customer',
      invite: 'customer',
      gems: 'customer',
      connect: 'customer',
      help: 'customer',
      language: 'language-settings',
      unknown: 'home',
    };
    for (const [command, target] of Object.entries(expected)) {
      assert.equal(route(command as TelegramBotCommand).route, target, command);
    }
  });

  it('customer commands from an unlinked admin explain instead of registering', () => {
    for (const command of ['status', 'charge', 'invite', 'gems', 'connect', 'help'] as const) {
      assert.equal(route(command, undefined, false).route, 'no-customer-account', command);
    }
  });
});
