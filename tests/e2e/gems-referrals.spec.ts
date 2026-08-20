import { expect, test, type Page, type Route } from '@playwright/test';
import { PERSIAN_ENABLED, PERSIAN_DISABLED_SKIP_REASON } from './helpers/persian';

// afroWS bot v2 admin surfaces (mocked API):
// - Customers detail row + edit panel show phone / gems / referral code / referral count.
// - "Adjust gems" (delta + reason) confirms first and fires exactly one POST.
// - Settings -> Telegram carries the 5 gem-economy fields in its PATCH.

const sessionToken = 'gems-visual-session-token';
const fixedNow = '2026-07-25T08:00:00.000Z';
const shotDir = 'test-results/gems-referrals';

interface GemsMockState {
  accounts: Array<Record<string, unknown>>;
  gemsCalls: Array<{ id: string; delta: number; reason: string }>;
  settingsPatches: Array<Record<string, unknown>>;
}

function createAccounts(): Array<Record<string, unknown>> {
  return [
    {
      activeClientCount: 1,
      clientCount: 2,
      createdAt: '2026-06-01T10:00:00.000Z',
      displayName: 'Hanie Zamani',
      egressTier: 'normal',
      gamingEntitled: false,
      gemsBalance: 450,
      hasPaidNumberHash: true,
      id: 'account-hanie',
      loginEmail: 'hanie@example.com',
      phone: '+98 912 000 1122',
      protocols: [{ protocol: 'vless', usedBytes: 9_500_000_000 }],
      quotaLimitBytes: 20_000_000_000,
      quotaScope: 'account_shared',
      referralCode: 'HANI-4821',
      referralCount: 12,
      status: 'active',
      telegramId: '523111222',
      telegramUsername: 'haniezamani75',
      updatedAt: fixedNow,
      usedBytes: 9_500_000_000,
    },
    {
      activeClientCount: 0,
      clientCount: 1,
      createdAt: '2026-07-20T10:00:00.000Z',
      displayName: 'Omid Karimi',
      egressTier: 'gaming',
      gamingEntitled: true,
      gemsBalance: 0,
      hasPaidNumberHash: false,
      id: 'account-omid',
      loginEmail: null,
      phone: null,
      protocols: [{ protocol: 'vless', usedBytes: 800_000_000 }],
      quotaLimitBytes: 5_000_000_000,
      quotaScope: 'account_shared',
      referralCode: 'OMID-9313',
      referralCount: 0,
      status: 'active',
      telegramId: '812333444',
      telegramUsername: null,
      updatedAt: fixedNow,
      usedBytes: 800_000_000,
    },
  ];
}

function telegramBotSettings(patch: Record<string, unknown> | null): Record<string, unknown> {
  return {
    alertChatId: '123456789',
    alertChatIdSource: 'database',
    alertsEnabled: true,
    allowedAdminChatIds: ['123456789'],
    botFirstName: 'afroWS',
    botId: 987654321,
    botTokenSource: 'database',
    botUsername: 'Afrows_bot',
    cardToCardInfo: '6037-9911-2233-4455\nHanie Zamani (Bank Melli)',
    commandsEnabled: true,
    gemMilestoneBonus: patch?.gemMilestoneBonus ?? 300,
    gemMilestoneEvery: patch?.gemMilestoneEvery ?? 10,
    gemRedeemPerGb: patch?.gemRedeemPerGb ?? 100,
    gemReferralPurchasePct: patch?.gemReferralPurchasePct ?? 20,
    gemReferralSignup: patch?.gemReferralSignup ?? 50,
    hasBotToken: true,
    hasWebhookSecret: true,
    lastTestDurationMs: 84,
    lastTestErrorCode: null,
    lastTestStatus: 'ok',
    lastTestedAt: fixedNow,
    outboundProxyConfigured: true,
    trialQuotaBytes: 1_000_000_000,
    updatedAt: fixedNow,
    updatedBy: 'superadmin',
    webhookSecretSource: 'database',
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
}

async function mockGemsApi(page: Page, state: GemsMockState): Promise<void> {
  await page.route('http://127.0.0.1:7000/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === '/api/admin/session') {
      await fulfillJson(route, {
        actor: { id: 'admin-gems', isSuperAdmin: true, role: 'superadmin', type: 'admin', username: 'superadmin' },
        expiresAt: '2026-07-25T12:00:00.000Z',
        issuedAt: fixedNow,
        mfaReady: true,
        mfaRequired: false,
      });
      return;
    }

    // Adjust-gems wallet call (documented bot-v2 contract).
    const gemsMatch = pathname.match(/^\/api\/admin\/customer-accounts\/([^/]+)\/gems$/);
    if (gemsMatch && request.method() === 'POST') {
      const payload = request.postDataJSON() as { delta: number; reason: string };
      state.gemsCalls.push({ id: gemsMatch[1], delta: payload.delta, reason: payload.reason });
      const account = state.accounts.find((entry) => entry.id === gemsMatch[1]);
      const next = Number(account?.gemsBalance ?? 0) + payload.delta;
      if (account) account.gemsBalance = next;
      await fulfillJson(route, { gemsBalance: next });
      return;
    }

    if (pathname === '/api/admin/customer-accounts' && request.method() === 'GET') {
      await fulfillJson(route, { accounts: state.accounts });
      return;
    }

    if (pathname === '/api/admin/network-overview') {
      await fulfillJson(route, {
        appliedCatchAll: 'via-germany',
        egressHealth: {
          appliedCatchAll: 'via-germany',
          gamingOutbound: 'via-village',
          germanyUp: true,
          starlinkUp: true,
          updatedAt: fixedNow,
        },
      });
      return;
    }

    if (pathname === '/api/admin/egress-tier-prices') {
      await fulfillJson(route, []);
      return;
    }

    if (pathname === '/api/admin/routers') {
      await fulfillJson(route, { routers: [] });
      return;
    }

    if (pathname === '/api/admin/settings/telegram-bot') {
      const patch = request.method() === 'PATCH' ? (request.postDataJSON() as Record<string, unknown>) : null;
      if (patch) state.settingsPatches.push(patch);
      await fulfillJson(route, { telegramBot: telegramBotSettings(patch) });
      return;
    }

    await fulfillJson(route, { error: `Unmocked gems spec route: ${pathname}` }, 404);
  });
}

async function openPage(
  page: Page,
  path: string,
  size: { width: number; height: number },
  language: 'en' | 'fa',
  state: GemsMockState,
): Promise<void> {
  await mockGemsApi(page, state);
  await page.setViewportSize(size);
  await page.addInitScript(({ token, lang }) => {
    window.localStorage.setItem('afrows.dashboard.language', lang);
    window.sessionStorage.setItem('afrows.dashboard.adminSessionToken', token);
  }, { token: sessionToken, lang: language });

  await page.goto(path);
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }',
  });
}

function createState(): GemsMockState {
  return { accounts: createAccounts(), gemsCalls: [], settingsPatches: [] };
}

const detailExpand = { en: 'Show details and actions', fa: 'نمایش جزئیات و عملیات' } as const;
const gemRedeemLabel = { en: 'Gems per 1 GB (redeem rate)', fa: 'جم برای هر ۱ گیگ (نرخ تبدیل)' } as const;
const gemSignupLabel = { en: 'Referral signup bonus (gems)', fa: 'پاداش ثبت‌نام دعوتی (جم)' } as const;
const gemPctLabel = { en: 'Referral purchase commission (%)', fa: 'کمیسیون خرید دعوتی (٪)' } as const;
const gemEveryLabel = { en: 'Milestone: every N referrals', fa: 'جایزهٔ مرحله‌ای: هر N دعوت' } as const;
const gemBonusLabel = { en: 'Milestone bonus (gems)', fa: 'پاداش مرحله‌ای (جم)' } as const;

const viewports = [
  { name: '390', size: { width: 390, height: 844 } },
  { name: '768', size: { width: 768, height: 1024 } },
  { name: '1280', size: { width: 1280, height: 800 } },
] as const;

test.describe('customers detail row shows bot v2 fields (phone / gems / referrals)', () => {
  for (const language of ['en', 'fa'] as const) {
    for (const viewport of viewports) {
      test(`${language} ${viewport.name}px expanded customer detail`, async ({ page }) => {
        test.skip(language === 'fa' && !PERSIAN_ENABLED, PERSIAN_DISABLED_SKIP_REASON);
        const state = createState();
        await openPage(page, '/customers', viewport.size, language, state);

        await expect(page.getByText('Hanie Zamani').first()).toBeVisible();
        await page.getByRole('button', { name: detailExpand[language] }).first().click();

        // New bot-v2 fields surfaced in the expandable detail panel.
        await expect(page.getByText('+98 912 000 1122')).toBeVisible();
        await expect(page.getByText('HANI-4821')).toBeVisible();
        await expect(page.getByText(language === 'fa' ? '۴۵۰' : '450', { exact: true }).first()).toBeVisible();
        if (language === 'fa') {
          await expect(page.locator('main[dir="rtl"]')).toBeVisible();
        }

        // No horizontal page scroll at any width (mobile-first requirement).
        const horizontalOverflow = await page.evaluate(() =>
          Math.max(
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
            document.body.scrollWidth - document.body.clientWidth,
          ));
        expect(horizontalOverflow).toBeLessThanOrEqual(1);

        await page.screenshot({ fullPage: true, path: `${shotDir}/customers-detail-${language}-${viewport.name}.png` });
      });
    }
  }
});

test('adjust gems validates, confirms once, posts once, and shows the new balance', async ({ page }) => {
  const state = createState();
  await openPage(page, '/customers', { width: 1280, height: 800 }, 'en', state);

  const confirmMessages: string[] = [];
  page.on('dialog', (dialog) => {
    confirmMessages.push(dialog.message());
    void dialog.accept();
  });

  await page.getByRole('button', { name: detailExpand.en }).first().click();
  const deltaInput = page.getByPlaceholder('+/- gems, e.g. 50 or -20');
  const reasonInput = page.getByPlaceholder('Reason (audited), e.g. support credit');

  // Non-integer delta -> inline error, no confirm, no API call.
  await deltaInput.fill('2.5');
  await reasonInput.fill('Support credit');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Enter a non-zero whole gem amount and a reason.')).toBeVisible();
  expect(confirmMessages).toHaveLength(0);
  expect(state.gemsCalls).toHaveLength(0);

  // Valid delta -> one confirm, one POST, refreshed balance in the notice.
  await deltaInput.fill('50');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('Gems updated — new balance: 500.')).toBeVisible();
  expect(confirmMessages).toHaveLength(1);
  expect(confirmMessages[0]).toContain('Hanie Zamani');
  expect(state.gemsCalls).toEqual([{ id: 'account-hanie', delta: 50, reason: 'Support credit' }]);

  await page.screenshot({ fullPage: true, path: `${shotDir}/customers-gems-adjusted-en-1280.png` });
});

test.describe('settings telegram gem-economy panel', () => {
  for (const language of ['en', 'fa'] as const) {
    for (const viewport of viewports) {
      test(`${language} ${viewport.name}px gem economy inputs prefilled`, async ({ page }) => {
        test.skip(language === 'fa' && !PERSIAN_ENABLED, PERSIAN_DISABLED_SKIP_REASON);
        const state = createState();
        await openPage(page, '/settings', viewport.size, language, state);

        await page.getByRole('tab', { name: language === 'fa' ? /تلگرام/ : /Telegram/ }).click();
        await expect(page.getByLabel(gemRedeemLabel[language])).toHaveValue('100');
        await expect(page.getByLabel(gemSignupLabel[language])).toHaveValue('50');
        await expect(page.getByLabel(gemPctLabel[language])).toHaveValue('20');
        await expect(page.getByLabel(gemEveryLabel[language])).toHaveValue('10');
        await expect(page.getByLabel(gemBonusLabel[language])).toHaveValue('300');

        await page.getByLabel(gemRedeemLabel[language]).scrollIntoViewIfNeeded();
        await page.screenshot({ fullPage: true, path: `${shotDir}/settings-gems-${language}-${viewport.name}.png` });
      });
    }
  }

  test('save PATCHes all five gem-economy fields as numbers', async ({ page }) => {
    const state = createState();
    await openPage(page, '/settings', { width: 1280, height: 800 }, 'en', state);

    await page.getByRole('tab', { name: /Telegram/ }).click();
    await page.getByLabel(gemRedeemLabel.en).fill('120');
    await page.getByLabel(gemSignupLabel.en).fill('60');
    await page.getByLabel(gemPctLabel.en).fill('25');
    await page.getByLabel(gemEveryLabel.en).fill('8');
    await page.getByLabel(gemBonusLabel.en).fill('350');
    await page.getByRole('button', { name: 'Save Telegram settings' }).click();

    await expect(page.getByText('Telegram bot settings saved.')).toBeVisible();
    expect(state.settingsPatches).toHaveLength(1);
    expect(state.settingsPatches[0]).toMatchObject({
      gemMilestoneBonus: 350,
      gemMilestoneEvery: 8,
      gemRedeemPerGb: 120,
      gemReferralPurchasePct: 25,
      gemReferralSignup: 60,
    });
  });

  test('negative gem value blocks the save with a validation message', async ({ page }) => {
    const state = createState();
    await openPage(page, '/settings', { width: 1280, height: 800 }, 'en', state);

    await page.getByRole('tab', { name: /Telegram/ }).click();
    await page.getByLabel(gemRedeemLabel.en).fill('-5');
    await page.getByRole('button', { name: 'Save Telegram settings' }).click();

    await expect(page.getByText('Gem economy values must be whole numbers of 0 or more.')).toBeVisible();
    expect(state.settingsPatches).toHaveLength(0);
  });
});
