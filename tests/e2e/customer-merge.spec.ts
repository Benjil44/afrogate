import { expect, test, type Page, type Route } from '@playwright/test';

// Customers page "Merge into another account" flow (duplicate bot-created
// account -> real account): mocked-API captures + behavior assertions.
//
// Contract under test (frontend adapter `apps/dashboard/src/api/merge.ts`):
//   POST /api/admin/customer-accounts/:sourceId/merge  body { targetAccountId }
// The SOURCE is archived after its GB/gems/configs move to the TARGET.

const sessionToken = 'customer-merge-session-token';
const fixedNow = '2026-07-24T08:00:00.000Z';
const shotDir = 'test-results/customer-merge';

interface MergeMockState {
  accounts: Array<Record<string, unknown>>;
  mergeCalls: Array<{ source: string; target: string }>;
}

function account(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    activeClientCount: 1,
    clientCount: 1,
    createdAt: fixedNow,
    egressTier: 'normal',
    gamingEntitled: false,
    hasPaidNumberHash: false,
    protocols: [{ protocol: 'vless', usedBytes: 1_000_000_000 }],
    quotaScope: 'account_shared',
    status: 'active',
    updatedAt: fixedNow,
    usedBytes: 1_000_000_000,
    ...overrides,
  };
}

function createAccounts(): Array<Record<string, unknown>> {
  return [
    account({
      displayName: 'Customer-8F3A',
      gemsBalance: 40,
      id: 'account-dup',
      phone: '+989120001122',
      quotaLimitBytes: 10_000_000_000,
      telegramId: '900111222',
      usedBytes: 3_000_000_000,
    }),
    account({
      displayName: 'Hanie Zamani',
      gemsBalance: 120,
      id: 'account-hanie',
      phone: '+989125554433',
      quotaLimitBytes: 50_000_000_000,
      referralCode: 'HANIE1',
      referralCount: 3,
      telegramId: '523111222',
      telegramUsername: 'haniezamani75',
      usedBytes: 12_000_000_000,
    }),
    account({
      displayName: 'Omid Karimi',
      id: 'account-omid',
      loginEmail: 'omid@example.com',
      quotaLimitBytes: 25_000_000_000,
      usedBytes: 6_000_000_000,
    }),
    account({
      deletedAt: '2026-07-01T00:00:00.000Z',
      displayName: 'Sara Archived',
      id: 'account-archived',
      isArchived: true,
      status: 'disabled',
    }),
  ];
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
}

async function mockCustomersApi(page: Page, state: MergeMockState): Promise<void> {
  await page.route('http://127.0.0.1:7000/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === '/api/admin/session') {
      await fulfillJson(route, {
        actor: { id: 'admin-merge', isSuperAdmin: true, role: 'superadmin', type: 'admin', username: 'superadmin' },
        expiresAt: '2026-07-24T12:00:00.000Z',
        issuedAt: fixedNow,
        mfaReady: true,
        mfaRequired: false,
      });
      return;
    }

    const mergeMatch = pathname.match(/^\/api\/admin\/customer-accounts\/([^/]+)\/merge$/);
    if (mergeMatch && request.method() === 'POST') {
      const payload = request.postDataJSON() as { targetAccountId?: string };
      state.mergeCalls.push({ source: mergeMatch[1], target: payload?.targetAccountId ?? '' });
      const source = state.accounts.find((entry) => entry.id === mergeMatch[1]);
      const target = state.accounts.find((entry) => entry.id === payload?.targetAccountId);
      if (source && target) {
        // Backend semantics: target absorbs the source, source is archived.
        target.usedBytes = (target.usedBytes as number) + (source.usedBytes as number);
        target.quotaLimitBytes = (target.quotaLimitBytes as number) + (source.quotaLimitBytes as number);
        target.gemsBalance = ((target.gemsBalance as number) ?? 0) + ((source.gemsBalance as number) ?? 0);
        source.deletedAt = fixedNow;
        source.isArchived = true;
        source.status = 'disabled';
      }
      await fulfillJson(route, { ...target, clientConfigs: [] });
      return;
    }

    if (pathname === '/api/admin/customer-accounts' && request.method() === 'GET') {
      const archived = url.searchParams.get('archived');
      const accounts = archived === 'all'
        ? state.accounts
        : state.accounts.filter((entry) => !entry.isArchived);
      await fulfillJson(route, { accounts, total: accounts.length });
      return;
    }

    if (pathname === '/api/admin/network-overview') {
      await fulfillJson(route, {
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

    await fulfillJson(route, { error: `Unmocked merge spec route: ${pathname}` }, 404);
  });
}

async function openCustomersPage(
  page: Page,
  size: { width: number; height: number },
  language: 'en' | 'fa',
  state: MergeMockState,
): Promise<void> {
  await mockCustomersApi(page, state);
  await page.setViewportSize(size);
  await page.addInitScript(({ token, lang }) => {
    window.localStorage.setItem('afrows.dashboard.language', lang);
    window.sessionStorage.setItem('afrows.dashboard.adminSessionToken', token);
  }, { token: sessionToken, lang: language });

  await page.goto('/customers');
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }',
  });
  await expect(page.getByText('Customer-8F3A').first()).toBeVisible();
}

// Localized copy under test (must match i18n.en.ts / i18n.fa.ts customersPage).
const copy = {
  en: {
    confirmButton: 'Merge and archive',
    confirmSnippet: 'Merge "Customer-8F3A" into "Hanie Zamani"?',
    mergeAction: 'Merge into another account',
    searchPlaceholder: 'Search by name, phone, Telegram or invite code…',
    success: 'Merged "Customer-8F3A" into "Hanie Zamani".',
  },
  fa: {
    confirmButton: 'ادغام و آرشیو',
    confirmSnippet: 'حساب «Customer-8F3A» در «Hanie Zamani» ادغام شود؟',
    mergeAction: 'ادغام در حساب دیگر',
    searchPlaceholder: 'جستجو با نام، تلفن، تلگرام یا کد دعوت…',
    success: '«Customer-8F3A» در «Hanie Zamani» ادغام شد.',
  },
} as const;

/** Expand the duplicate row's inline detail panel (language-independent: tapping
 * non-interactive row content toggles it) and return its Merge button. */
async function openMergeFromRow(page: Page, language: 'en' | 'fa') {
  await page.getByText('Customer-8F3A').first().click();
  const mergeButton = page.getByRole('button', { name: copy[language].mergeAction });
  await expect(mergeButton).toBeVisible();
  return mergeButton;
}

test.describe('customer merge flow visual captures', () => {
  for (const language of ['en', 'fa'] as const) {
    for (const viewport of [
      { name: '390', size: { width: 390, height: 844 } },
      { name: '768', size: { width: 768, height: 1024 } },
      { name: '1280', size: { width: 1280, height: 800 } },
    ]) {
      test(`${language} ${viewport.name}px merge action, target picker, confirm`, async ({ page }) => {
        const state: MergeMockState = { accounts: createAccounts(), mergeCalls: [] };
        await openCustomersPage(page, viewport.size, language, state);
        if (language === 'fa') {
          await expect(page.locator('main[dir="rtl"]')).toBeVisible();
        }

        // 1) Merge action inside the row's detail panel (same panel as Edit/Configs).
        const mergeButton = await openMergeFromRow(page, language);
        await page.screenshot({ fullPage: true, path: `${shotDir}/merge-action-${language}-${viewport.name}.png` });

        // 2) Target picker with search: source itself and archived accounts excluded.
        await mergeButton.click();
        const search = page.getByPlaceholder(copy[language].searchPlaceholder);
        await expect(search).toBeVisible();
        await expect(page.getByRole('button', { name: /Hanie Zamani/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Omid Karimi/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Sara Archived/ })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /Customer-8F3A/ })).toHaveCount(0);
        await search.fill('zam');
        await expect(page.getByRole('button', { name: /Omid Karimi/ })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /Hanie Zamani/ })).toBeVisible();
        await page.screenshot({ fullPage: true, path: `${shotDir}/merge-picker-${language}-${viewport.name}.png` });

        // 3) Selecting a target opens the explicit confirm step (no call yet).
        await page.getByRole('button', { name: /Hanie Zamani/ }).click();
        await expect(page.getByText(copy[language].confirmSnippet)).toBeVisible();
        await expect(page.getByRole('button', { name: copy[language].confirmButton })).toBeVisible();
        expect(state.mergeCalls).toHaveLength(0);
        await page.screenshot({ fullPage: true, path: `${shotDir}/merge-confirm-${language}-${viewport.name}.png` });

        // Mobile-first: no document-level horizontal scroll at any width.
        const horizontalOverflow = await page.evaluate(() =>
          Math.max(
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
            document.body.scrollWidth - document.body.clientWidth,
          ));
        expect(horizontalOverflow).toBeLessThanOrEqual(1);
      });
    }
  }
});

test('confirm merges exactly once with the chosen source/target and archives the duplicate', async ({ page }) => {
  const state: MergeMockState = { accounts: createAccounts(), mergeCalls: [] };
  await openCustomersPage(page, { width: 1280, height: 800 }, 'en', state);

  const mergeButton = await openMergeFromRow(page, 'en');
  await mergeButton.click();
  await page.getByRole('button', { name: /Hanie Zamani/ }).click();
  await page.getByRole('button', { name: copy.en.confirmButton }).click();

  // Success line, panel closed, source gone from the (active) list. The success
  // copy itself mentions the source name, so assert on table rows specifically.
  await expect(page.getByText(copy.en.success)).toBeVisible();
  await expect(page.getByPlaceholder(copy.en.searchPlaceholder)).toHaveCount(0);
  await expect(page.locator('tbody tr').filter({ hasText: 'Customer-8F3A' })).toHaveCount(0);
  await expect(page.locator('tbody tr').filter({ hasText: 'Hanie Zamani' })).toBeVisible();
  expect(state.mergeCalls).toEqual([{ source: 'account-dup', target: 'account-hanie' }]);
});

test('cancelling the merge panel sends zero merge calls', async ({ page }) => {
  const state: MergeMockState = { accounts: createAccounts(), mergeCalls: [] };
  await openCustomersPage(page, { width: 1280, height: 800 }, 'en', state);

  const mergeButton = await openMergeFromRow(page, 'en');
  await mergeButton.click();
  // Even with a target selected and the confirm step visible…
  await page.getByRole('button', { name: /Hanie Zamani/ }).click();
  await expect(page.getByText(copy.en.confirmSnippet)).toBeVisible();
  // …closing the panel aborts without any API call.
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByPlaceholder(copy.en.searchPlaceholder)).toHaveCount(0);
  await expect(page.getByText(copy.en.confirmSnippet)).toHaveCount(0);
  expect(state.mergeCalls).toHaveLength(0);
  await expect(page.getByText('Customer-8F3A').first()).toBeVisible();
});

test('back from the confirm step returns to the picker without merging', async ({ page }) => {
  const state: MergeMockState = { accounts: createAccounts(), mergeCalls: [] };
  await openCustomersPage(page, { width: 1280, height: 800 }, 'en', state);

  const mergeButton = await openMergeFromRow(page, 'en');
  await mergeButton.click();
  await page.getByRole('button', { name: /Hanie Zamani/ }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByText(copy.en.confirmSnippet)).toHaveCount(0);
  await expect(page.getByPlaceholder(copy.en.searchPlaceholder)).toBeVisible();
  expect(state.mergeCalls).toHaveLength(0);
});
