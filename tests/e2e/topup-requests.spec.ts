import { expect, test, type Page, type Route } from '@playwright/test';

// Admin Top-up Requests approval page (afroWS Telegram bot card-to-card
// receipts): mocked-API captures + behavior assertions.

const sessionToken = 'topup-visual-session-token';
const fixedNow = '2026-07-24T08:00:00.000Z';
const shotDir = 'test-results/topup-requests';

// Receipt stand-in served by the mocked backend proxy: a realistic-size image
// so the thumbnail crop and the enlarged lightbox both render meaningfully.
const receiptSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560">
  <rect width="420" height="560" fill="#f4f7f8"/>
  <rect x="24" y="24" width="372" height="512" rx="12" fill="#ffffff" stroke="#d6e0e2"/>
  <text x="210" y="80" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#16262d">Bank transfer</text>
  <text x="210" y="130" text-anchor="middle" font-family="Arial" font-size="16" fill="#5c7782">Card to card receipt</text>
  <line x1="48" y1="160" x2="372" y2="160" stroke="#d6e0e2"/>
  <text x="48" y="210" font-family="Arial" font-size="15" fill="#5c7782">Amount</text>
  <text x="372" y="210" text-anchor="end" font-family="Arial" font-size="17" font-weight="bold" fill="#16262d">1,000,000 IRT</text>
  <text x="48" y="260" font-family="Arial" font-size="15" fill="#5c7782">To card</text>
  <text x="372" y="260" text-anchor="end" font-family="Arial" font-size="17" font-weight="bold" fill="#16262d">6037-99**-****-4455</text>
  <text x="48" y="310" font-family="Arial" font-size="15" fill="#5c7782">Date</text>
  <text x="372" y="310" text-anchor="end" font-family="Arial" font-size="17" font-weight="bold" fill="#16262d">2026-07-24 11:58</text>
  <text x="48" y="360" font-family="Arial" font-size="15" fill="#5c7782">Tracking no.</text>
  <text x="372" y="360" text-anchor="end" font-family="Arial" font-size="17" font-weight="bold" fill="#16262d">847291046512</text>
  <rect x="140" y="420" width="140" height="60" rx="8" fill="#e7f6ef" stroke="#b8e1cf"/>
  <text x="210" y="457" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="#1d7a53">SUCCESS</text>
</svg>`;

interface TopupMockState {
  approveCalls: string[];
  rejectCalls: Array<{ id: string; reason: string }>;
  requests: Array<Record<string, unknown>>;
}

function createTopupRequests(): Array<Record<string, unknown>> {
  return [
    {
      amountMinor: 1_000_000,
      createdAt: fixedNow,
      currency: 'IRT',
      customerAccountId: 'account-hanie',
      customerDisplayName: 'Hanie Zamani',
      hasReceipt: true,
      id: 'topup-1',
      packageLabel: 'Starter 25GB',
      packageVolumeBytes: 25_000_000_000,
      reference: 'TG-1042',
      reviewNote: null,
      reviewedAt: null,
      reviewedBy: null,
      status: 'pending',
      telegramChatId: '523111222',
      telegramId: '523111222',
      telegramUsername: 'haniezamani75',
      volumePackageId: 'package-starter',
    },
    {
      amountMinor: 2_400_000,
      createdAt: '2026-07-24T06:30:00.000Z',
      currency: 'IRT',
      customerAccountId: 'account-omid',
      customerDisplayName: 'Omid Karimi',
      hasReceipt: true,
      id: 'topup-2',
      packageLabel: 'Family 60GB',
      packageVolumeBytes: 60_000_000_000,
      reference: 'TG-1041',
      reviewNote: null,
      reviewedAt: null,
      reviewedBy: null,
      status: 'pending',
      telegramChatId: '812333444',
      telegramId: '812333444',
      telegramUsername: null,
      volumePackageId: 'package-family',
    },
    {
      amountMinor: 1_000_000,
      createdAt: '2026-07-23T18:00:00.000Z',
      currency: 'IRT',
      customerAccountId: 'account-sara',
      customerDisplayName: 'Sara Ahmadi',
      hasReceipt: true,
      id: 'topup-3',
      packageLabel: 'Starter 25GB',
      packageVolumeBytes: 25_000_000_000,
      reference: 'TG-1039',
      reviewNote: null,
      reviewedAt: '2026-07-23T19:00:00.000Z',
      reviewedBy: 'superadmin',
      status: 'approved',
      telegramChatId: '119222333',
      telegramId: '119222333',
      telegramUsername: 'sara_a',
      volumePackageId: 'package-starter',
    },
  ];
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
}

async function mockTopupApi(page: Page, state: TopupMockState): Promise<void> {
  await page.route('http://127.0.0.1:7000/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === '/api/admin/session') {
      await fulfillJson(route, {
        actor: { id: 'admin-topups', isSuperAdmin: true, role: 'superadmin', type: 'admin', username: 'superadmin' },
        expiresAt: '2026-07-24T12:00:00.000Z',
        issuedAt: fixedNow,
        mfaReady: true,
        mfaRequired: false,
      });
      return;
    }

    const receiptMatch = pathname.match(/^\/api\/admin\/telegram\/topups\/([^/]+)\/receipt$/);
    if (receiptMatch) {
      await route.fulfill({ body: receiptSvg, contentType: 'image/svg+xml', status: 200 });
      return;
    }

    const approveMatch = pathname.match(/^\/api\/admin\/telegram\/topups\/([^/]+)\/approve$/);
    if (approveMatch && request.method() === 'POST') {
      state.approveCalls.push(approveMatch[1]);
      const item = state.requests.find((entry) => entry.id === approveMatch[1]);
      if (item) {
        item.status = 'approved';
        item.reviewedBy = 'superadmin';
        item.reviewedAt = fixedNow;
      }
      await fulfillJson(route, { request: item });
      return;
    }

    const rejectMatch = pathname.match(/^\/api\/admin\/telegram\/topups\/([^/]+)\/reject$/);
    if (rejectMatch && request.method() === 'POST') {
      const payload = request.postDataJSON() as { reason?: string };
      if (!payload?.reason || payload.reason.trim() === '') {
        await fulfillJson(route, { error: 'reason required' }, 400);
        return;
      }
      state.rejectCalls.push({ id: rejectMatch[1], reason: payload.reason });
      const item = state.requests.find((entry) => entry.id === rejectMatch[1]);
      if (item) {
        item.status = 'rejected';
        item.reviewedBy = 'superadmin';
        item.reviewedAt = fixedNow;
        item.reviewNote = payload.reason;
      }
      await fulfillJson(route, { request: item });
      return;
    }

    if (pathname === '/api/admin/telegram/topups') {
      const status = url.searchParams.get('status') ?? 'pending';
      const requests = status === 'all'
        ? state.requests
        : state.requests.filter((entry) => entry.status === status);
      await fulfillJson(route, { requests });
      return;
    }

    if (pathname === '/api/admin/settings/telegram-bot') {
      const patchPayload = request.method() === 'PATCH'
        ? request.postDataJSON() as { cardToCardInfo?: string | null; trialQuotaBytes?: number | null }
        : null;
      await fulfillJson(route, {
        telegramBot: {
          alertChatId: '123456789',
          alertChatIdSource: 'database',
          alertsEnabled: true,
          allowedAdminChatIds: ['123456789'],
          botFirstName: 'afroWS',
          botId: 987654321,
          botTokenSource: 'database',
          botUsername: 'Afrows_bot',
          cardToCardInfo: patchPayload
            ? patchPayload.cardToCardInfo ?? null
            : '6037-9911-2233-4455\nHanie Zamani (Bank Melli)',
          commandsEnabled: true,
          hasBotToken: true,
          hasWebhookSecret: true,
          lastTestDurationMs: 84,
          lastTestErrorCode: null,
          lastTestStatus: 'ok',
          lastTestedAt: fixedNow,
          outboundProxyConfigured: true,
          trialQuotaBytes: patchPayload ? patchPayload.trialQuotaBytes ?? null : 1_000_000_000,
          updatedAt: fixedNow,
          updatedBy: 'superadmin',
          webhookSecretSource: 'database',
        },
      });
      return;
    }

    await fulfillJson(route, { error: `Unmocked topup spec route: ${pathname}` }, 404);
  });
}

async function openTopupsPage(
  page: Page,
  size: { width: number; height: number },
  language: 'en' | 'fa',
  state: TopupMockState,
): Promise<void> {
  await mockTopupApi(page, state);
  await page.setViewportSize(size);
  await page.addInitScript(({ token, lang }) => {
    window.localStorage.setItem('afrows.dashboard.language', lang);
    window.sessionStorage.setItem('afrows.dashboard.adminSessionToken', token);
  }, { token: sessionToken, lang: language });

  await page.goto('/topups');
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }',
  });
}

const pageTitle = { en: 'Top-up requests', fa: 'درخواست‌های شارژ' } as const;

test.describe('top-up requests approval page visual captures', () => {
  for (const language of ['en', 'fa'] as const) {
    for (const viewport of [
      { name: '390', size: { width: 390, height: 844 } },
      { name: '768', size: { width: 768, height: 1024 } },
      { name: '1280', size: { width: 1280, height: 800 } },
    ]) {
      test(`${language} ${viewport.name}px pending queue with receipt thumbnails`, async ({ page }) => {
        const state: TopupMockState = { approveCalls: [], rejectCalls: [], requests: createTopupRequests() };
        await openTopupsPage(page, viewport.size, language, state);

        await expect(page.getByRole('heading', { name: pageTitle[language] }).first()).toBeVisible();
        await expect(page.getByText('Hanie Zamani').first()).toBeVisible();
        // Receipt thumbnails lazily loaded through the authenticated proxy -> objectURL.
        await expect(page.locator('[data-receipt-thumb] img').first()).toBeVisible();
        // Pending rows expose Approve/Reject; the approved row (other filter) does not.
        await expect(page.locator('article').filter({ hasText: 'TG-1042' }).getByRole('button').nth(1)).toBeVisible();
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

        await page.screenshot({ fullPage: true, path: `${shotDir}/topups-${language}-${viewport.name}.png` });
      });
    }
  }

  test('en 1280px receipt lightbox and reject-reason input captures', async ({ page }) => {
    const state: TopupMockState = { approveCalls: [], rejectCalls: [], requests: createTopupRequests() };
    await openTopupsPage(page, { width: 1280, height: 800 }, 'en', state);

    // Enlarge the first receipt into the lightbox.
    const firstThumb = page.locator('[data-receipt-thumb]').first();
    await expect(firstThumb.locator('img')).toBeVisible();
    await firstThumb.click();
    const lightbox = page.getByRole('dialog');
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator('img')).toBeVisible();
    await page.screenshot({ fullPage: false, path: `${shotDir}/topups-en-1280-lightbox.png` });
    await lightbox.getByRole('button', { name: 'Close receipt view' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Open the reject-reason input on the first pending request.
    const pendingCard = page.locator('article').filter({ hasText: 'TG-1042' });
    await pendingCard.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(pendingCard.getByText('Rejection reason (sent to the user in the bot)')).toBeVisible();
    await page.screenshot({ fullPage: true, path: `${shotDir}/topups-en-1280-reject-reason.png` });
  });

  test('sidebar shows a pending top-up count badge', async ({ page }) => {
    const state: TopupMockState = { approveCalls: [], rejectCalls: [], requests: createTopupRequests() };
    await openTopupsPage(page, { width: 1280, height: 800 }, 'en', state);

    const navItem = page.locator('[data-view="topups"]');
    await expect(navItem).toBeVisible();
    await expect(navItem.getByText('2', { exact: true })).toBeVisible();
    await expect(navItem).toHaveAttribute('aria-current', 'page');
  });
});

test('approve confirms first and fires exactly one approve call', async ({ page }) => {
  const state: TopupMockState = { approveCalls: [], rejectCalls: [], requests: createTopupRequests() };
  await openTopupsPage(page, { width: 1280, height: 800 }, 'en', state);

  const confirmMessages: string[] = [];
  page.on('dialog', (dialog) => {
    confirmMessages.push(dialog.message());
    void dialog.accept();
  });

  const pendingCard = page.locator('article').filter({ hasText: 'TG-1042' });
  await pendingCard.getByRole('button', { name: 'Approve' }).click();

  await expect(page.getByText('Top-up approved and credited.')).toBeVisible();
  expect(confirmMessages).toHaveLength(1);
  expect(confirmMessages[0]).toContain('Hanie Zamani');
  expect(state.approveCalls).toEqual(['topup-1']);

  // The approved request leaves the pending queue; only TG-1041 remains.
  await expect(page.locator('article').filter({ hasText: 'TG-1042' })).toHaveCount(0);
  await expect(page.locator('article').filter({ hasText: 'TG-1041' })).toBeVisible();
  expect(state.approveCalls).toHaveLength(1);
});

test('reject requires a reason before any reject call is sent', async ({ page }) => {
  const state: TopupMockState = { approveCalls: [], rejectCalls: [], requests: createTopupRequests() };
  await openTopupsPage(page, { width: 1280, height: 800 }, 'en', state);

  const pendingCard = page.locator('article').filter({ hasText: 'TG-1042' });
  await pendingCard.getByRole('button', { name: 'Reject', exact: true }).click();

  // Submitting with an empty reason must not call the API (required textarea).
  await pendingCard.getByRole('button', { name: 'Confirm rejection' }).click();
  expect(state.rejectCalls).toHaveLength(0);
  await expect(pendingCard.getByRole('button', { name: 'Confirm rejection' })).toBeVisible();

  await pendingCard.locator('textarea').fill('Amount does not match the receipt');
  await pendingCard.getByRole('button', { name: 'Confirm rejection' }).click();

  await expect(page.getByText('Top-up rejected and the user was notified.')).toBeVisible();
  expect(state.rejectCalls).toEqual([{ id: 'topup-1', reason: 'Amount does not match the receipt' }]);
  await expect(page.locator('article').filter({ hasText: 'TG-1042' })).toHaveCount(0);
});

test('settings telegram panel exposes card-to-card destination and trial quota fields', async ({ page }) => {
  const state: TopupMockState = { approveCalls: [], rejectCalls: [], requests: createTopupRequests() };
  await openTopupsPage(page, { width: 1280, height: 800 }, 'en', state);

  let patchPayload: { cardToCardInfo?: string | null; trialQuotaBytes?: number | null } | null = null;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/admin/settings/telegram-bot') && request.method() === 'PATCH') {
      patchPayload = request.postDataJSON() as typeof patchPayload;
    }
  });

  await page.locator('[data-view="settings"]').click();
  await page.getByRole('tab', { name: /Telegram/ }).click();
  await expect(page.getByRole('heading', { name: 'Telegram Bot Setup' })).toBeVisible();

  const cardField = page.getByLabel('Card-to-card destination');
  const trialField = page.getByLabel('Trial quota (GB)');
  await expect(cardField).toHaveValue(/6037-9911-2233-4455/);
  await expect(trialField).toHaveValue('1');
  await page.screenshot({ fullPage: true, path: `${shotDir}/settings-telegram-en-1280.png` });

  await cardField.fill('5041-7211-9988-7766\nOmid Karimi (Bank Resalat)');
  await trialField.fill('2');
  await page.getByRole('button', { name: 'Save Telegram settings' }).click();

  await expect(page.getByText('Telegram bot settings saved.')).toBeVisible();
  expect(patchPayload).not.toBeNull();
  expect(patchPayload!.cardToCardInfo).toContain('5041-7211-9988-7766');
  expect(patchPayload!.trialQuotaBytes).toBe(2_000_000_000);
});

test('fa settings telegram panel capture', async ({ page }) => {
  const state: TopupMockState = { approveCalls: [], rejectCalls: [], requests: createTopupRequests() };
  await openTopupsPage(page, { width: 1280, height: 800 }, 'fa', state);

  await page.locator('[data-view="settings"]').click();
  await page.getByRole('tab', { name: /تلگرام/ }).click();
  await expect(page.getByLabel('مقصد کارت‌به‌کارت')).toBeVisible();
  await expect(page.getByLabel('سهمیه آزمایشی (گیگ)')).toBeVisible();
  await page.screenshot({ fullPage: true, path: `${shotDir}/settings-telegram-fa-1280.png` });
});
