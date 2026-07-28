import { expect, test, type Page, type Route } from '@playwright/test';

// Reseller per-GB pricing + wallet-topup approval + seller oversight
// (docs/reseller-per-gb-pricing-plan.md): mocked-API captures + behavior
// assertions for the GB-price control, the Sellers drill-down + sign-in-as
// banner, the seller top-ups approval queue, and the reseller panel.

const adminToken = 'reseller-gb-admin-token';
const resellerToken = 'reseller-gb-imp-token';
const fixedNow = '2026-07-27T08:00:00.000Z';
const shotDir = 'test-results/reseller-per-gb';

const receiptSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560">
  <rect width="420" height="560" fill="#f4f7f8"/>
  <rect x="24" y="24" width="372" height="512" rx="12" fill="#ffffff" stroke="#d6e0e2"/>
  <text x="210" y="80" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#16262d">Bank transfer</text>
  <text x="210" y="130" text-anchor="middle" font-family="Arial" font-size="16" fill="#5c7782">Card to card receipt</text>
  <line x1="48" y1="160" x2="372" y2="160" stroke="#d6e0e2"/>
  <text x="48" y="210" font-family="Arial" font-size="15" fill="#5c7782">Amount</text>
  <text x="372" y="210" text-anchor="end" font-family="Arial" font-size="17" font-weight="bold" fill="#16262d">5,000,000 IRT</text>
  <text x="48" y="260" font-family="Arial" font-size="15" fill="#5c7782">To card</text>
  <text x="372" y="260" text-anchor="end" font-family="Arial" font-size="17" font-weight="bold" fill="#16262d">6037-99**-****-4455</text>
  <rect x="140" y="420" width="140" height="60" rx="8" fill="#e7f6ef" stroke="#b8e1cf"/>
  <text x="210" y="457" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="#1d7a53">SUCCESS</text>
</svg>`;

const GB_PRICE = 200_000;
const MARGIN_PERCENT = 20;

const resellerAccount = {
  activeCustomerAccountCount: 2,
  adminUserId: 'user-hanie',
  afrowsShareBps: 8_000,
  afrowsSharePercent: 80,
  availableBalanceAmount: 5_000_000,
  balanceAmount: 5_000_000,
  contactName: 'Hanie Zamani',
  createdAt: fixedNow,
  creditLimitAmount: 0,
  currency: 'IRT',
  customerAccountCount: 2,
  displayName: 'Hanie Store',
  id: 'reseller-hanie',
  ledgerEntryCount: 3,
  sellerMarginBps: MARGIN_PERCENT * 100,
  sellerMarginPercent: MARGIN_PERCENT,
  status: 'active',
  telegramUsername: 'haniezamani75',
  updatedAt: fixedNow,
};

const sellerCustomers = [
  {
    activeClientCount: 2,
    clientCount: 2,
    createdAt: fixedNow,
    displayName: 'Omid Karimi',
    hasPaidNumberHash: false,
    id: 'customer-omid',
    protocols: [],
    quotaLimitBytes: 50_000_000_000,
    quotaScope: 'account_shared',
    remainingBytes: 30_000_000_000,
    resellerAccountId: 'reseller-hanie',
    status: 'active',
    telegramUsername: 'omid_k',
    updatedAt: fixedNow,
    usedBytes: 20_000_000_000,
  },
  {
    activeClientCount: 1,
    clientCount: 1,
    createdAt: fixedNow,
    displayName: 'Sara Ahmadi',
    hasPaidNumberHash: false,
    id: 'customer-sara',
    protocols: [],
    quotaLimitBytes: 25_000_000_000,
    quotaScope: 'account_shared',
    remainingBytes: 2_000_000_000,
    resellerAccountId: 'reseller-hanie',
    status: 'suspended',
    telegramUsername: 'sara_a',
    updatedAt: fixedNow,
    usedBytes: 23_000_000_000,
  },
];

function createResellerTopups(): Array<Record<string, unknown>> {
  return [
    {
      amount: 5_000_000,
      createdAt: fixedNow,
      currency: 'IRT',
      hasReceipt: true,
      id: 'rtopup-1',
      note: null,
      reference: 'RT-2001',
      resellerAccountId: 'reseller-hanie',
      resellerDisplayName: 'Hanie Store',
      reviewedAt: null,
      reviewedBy: null,
      status: 'pending',
      walletLedgerId: null,
    },
    {
      amount: 2_500_000,
      createdAt: '2026-07-26T15:00:00.000Z',
      currency: 'IRT',
      hasReceipt: true,
      id: 'rtopup-2',
      note: null,
      reference: 'RT-2000',
      resellerAccountId: 'reseller-hanie',
      resellerDisplayName: 'Hanie Store',
      reviewedAt: '2026-07-26T16:00:00.000Z',
      reviewedBy: 'superadmin',
      status: 'approved',
      walletLedgerId: 'ledger-topup-1',
    },
  ];
}

interface MockState {
  approveCalls: string[];
  gbChargeCalls: Array<Record<string, unknown>>;
  gbPrice: number;
  gbPricePatches: number[];
  rejectCalls: Array<{ id: string; reason: string }>;
  topupCreateCalls: number;
  topups: Array<Record<string, unknown>>;
}

function createMockState(): MockState {
  return {
    approveCalls: [],
    gbChargeCalls: [],
    gbPrice: GB_PRICE,
    gbPricePatches: [],
    rejectCalls: [],
    topupCreateCalls: 0,
    topups: createResellerTopups(),
  };
}

function buildQuote(state: MockState, gb: number): Record<string, unknown> {
  const costAmount = Math.round(gb * state.gbPrice);
  const marginAmount = Math.round(costAmount * (MARGIN_PERCENT / 100));
  return {
    balanceAfterAmount: resellerAccount.balanceAmount - costAmount,
    balanceBeforeAmount: resellerAccount.balanceAmount,
    blockedReason: null,
    canDebit: costAmount <= resellerAccount.balanceAmount,
    costAmount,
    creditLimitAmount: 0,
    currency: 'IRT',
    gb,
    gbPrice: state.gbPrice,
    marginAmount,
    resellerAccountId: resellerAccount.id,
    resellerSellPrice: costAmount + marginAmount,
    sellerMarginBps: MARGIN_PERCENT * 100,
    walletDebitAmount: costAmount,
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
}

async function mockApi(page: Page, state: MockState): Promise<void> {
  await page.route('http://127.0.0.1:7000/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const authorization = request.headers()['authorization'] ?? '';
    const isResellerSession = authorization.includes(resellerToken);

    if (pathname === '/api/admin/session') {
      await fulfillJson(route, {
        actor: isResellerSession
          ? { id: 'user-hanie', isSuperAdmin: false, role: 'reseller', type: 'admin', username: 'hanie' }
          : { id: 'admin-root', isSuperAdmin: true, role: 'superadmin', type: 'admin', username: 'superadmin' },
        expiresAt: '2026-07-27T20:00:00.000Z',
        issuedAt: fixedNow,
        mfaReady: true,
        mfaRequired: false,
      });
      return;
    }

    // --- GB price setting (superadmin) ---
    if (pathname === '/api/admin/billing/gb-price') {
      if (request.method() === 'PATCH') {
        const payload = request.postDataJSON() as { gbPrice?: number };
        if (typeof payload?.gbPrice === 'number') {
          state.gbPrice = payload.gbPrice;
          state.gbPricePatches.push(payload.gbPrice);
        }
      }
      await fulfillJson(route, { currency: 'IRT', gbPrice: state.gbPrice, updatedAt: fixedNow, updatedBy: 'superadmin' });
      return;
    }

    // --- Sellers list + oversight ---
    if (pathname === '/api/admin/resellers') {
      await fulfillJson(route, { resellers: [resellerAccount] });
      return;
    }
    if (pathname === '/api/admin/users') {
      await fulfillJson(route, { users: [] });
      return;
    }
    if (pathname === `/api/admin/resellers/${resellerAccount.id}/customers`) {
      await fulfillJson(route, { accounts: sellerCustomers });
      return;
    }
    if (pathname === `/api/admin/resellers/${resellerAccount.id}/impersonate` && request.method() === 'POST') {
      await fulfillJson(route, {
        reseller: resellerAccount,
        session: {
          actor: { id: 'user-hanie', isSuperAdmin: false, role: 'reseller', type: 'admin', username: 'hanie' },
          expiresAt: '2026-07-27T20:00:00.000Z',
          issuedAt: fixedNow,
          mfaReady: true,
          mfaRequired: false,
          sessionToken: resellerToken,
        },
      });
      return;
    }

    // --- Seller wallet top-ups: admin approval queue ---
    const approveMatch = pathname.match(/^\/api\/admin\/reseller-topups\/([^/]+)\/approve$/);
    if (approveMatch && request.method() === 'POST') {
      state.approveCalls.push(approveMatch[1]);
      const item = state.topups.find((entry) => entry.id === approveMatch[1]);
      if (item) {
        item.status = 'approved';
        item.reviewedBy = 'superadmin';
        item.reviewedAt = fixedNow;
      }
      await fulfillJson(route, { request: item });
      return;
    }
    const rejectMatch = pathname.match(/^\/api\/admin\/reseller-topups\/([^/]+)\/reject$/);
    if (rejectMatch && request.method() === 'POST') {
      const payload = request.postDataJSON() as { reason?: string };
      if (!payload?.reason || payload.reason.trim() === '') {
        await fulfillJson(route, { error: 'reason required' }, 400);
        return;
      }
      state.rejectCalls.push({ id: rejectMatch[1], reason: payload.reason });
      const item = state.topups.find((entry) => entry.id === rejectMatch[1]);
      if (item) {
        item.status = 'rejected';
        item.reviewedBy = 'superadmin';
        item.reviewedAt = fixedNow;
        item.note = payload.reason;
      }
      await fulfillJson(route, { request: item });
      return;
    }
    const receiptMatch = pathname.match(/^\/api\/admin\/reseller-topups\/([^/]+)\/receipt$/);
    if (receiptMatch) {
      await route.fulfill({ body: receiptSvg, contentType: 'image/svg+xml', status: 200 });
      return;
    }
    if (pathname === '/api/admin/reseller-topups') {
      const status = url.searchParams.get('status');
      const requests = !status || status === 'all'
        ? state.topups
        : state.topups.filter((entry) => entry.status === status);
      await fulfillJson(route, { requests });
      return;
    }

    // --- Reseller-side: workspace + per-GB quote/charge + own top-ups ---
    if (pathname === '/api/admin/reseller/workspace') {
      await fulfillJson(route, {
        workspace: {
          accounts: sellerCustomers,
          gbPrice: state.gbPrice,
          generatedAt: fixedNow,
          ledgerEntries: [],
          packages: [],
          paymentOrders: [],
          reseller: resellerAccount,
          settings: { currency: 'IRT' },
          topupRequests: state.topups,
        },
      });
      return;
    }
    if (pathname === '/api/admin/reseller/gb-quote') {
      const gb = Number(url.searchParams.get('gb') ?? '0');
      await fulfillJson(route, { quote: buildQuote(state, gb) });
      return;
    }
    if (pathname === '/api/admin/reseller/gb-charges' && request.method() === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.gbChargeCalls.push(payload);
      const gb = Number(payload.gb ?? 0);
      await fulfillJson(route, {
        customerAccount: sellerCustomers[0],
        duplicate: false,
        ledgerEntry: {
          amount: -Math.round(gb * state.gbPrice),
          balanceAfterAmount: resellerAccount.balanceAmount - Math.round(gb * state.gbPrice),
          balanceBeforeAmount: resellerAccount.balanceAmount,
          createdAt: fixedNow,
          currency: 'IRT',
          entryType: 'sale_debit',
          id: 'ledger-gb-1',
          resellerAccountId: resellerAccount.id,
          source: 'client_sale',
        },
        quote: buildQuote(state, gb),
        reseller: { ...resellerAccount, availableBalanceAmount: resellerAccount.availableBalanceAmount - Math.round(gb * state.gbPrice), balanceAmount: resellerAccount.balanceAmount - Math.round(gb * state.gbPrice) },
      });
      return;
    }
    if (pathname === '/api/admin/reseller/wallet/topup-requests') {
      if (request.method() === 'POST') {
        state.topupCreateCalls += 1;
        const created = {
          amount: 3_000_000,
          createdAt: fixedNow,
          currency: 'IRT',
          hasReceipt: true,
          id: `rtopup-new-${state.topupCreateCalls}`,
          note: null,
          reference: `RT-30${state.topupCreateCalls}`,
          resellerAccountId: resellerAccount.id,
          resellerDisplayName: 'Hanie Store',
          reviewedAt: null,
          reviewedBy: null,
          status: 'pending',
          walletLedgerId: null,
        };
        state.topups = [created, ...state.topups];
        await fulfillJson(route, { request: created });
        return;
      }
      await fulfillJson(route, { requests: state.topups.filter((entry) => entry.resellerAccountId === resellerAccount.id) });
      return;
    }

    // --- Superadmin billing page data (catalog tab hosts the GB-price panel) ---
    if (pathname === '/api/admin/billing/catalog') {
      await fulfillJson(route, {
        packages: [],
        paymentMethods: [],
        paymentProviderAdapters: [],
        settings: { currency: 'IRT' },
      });
      return;
    }
    if (pathname === '/api/admin/payment-orders') {
      await fulfillJson(route, { paymentOrders: [] });
      return;
    }
    if (pathname === '/api/admin/customer-accounts') {
      await fulfillJson(route, { accounts: sellerCustomers });
      return;
    }
    if (pathname === '/api/admin/rewarded-ads/settings') {
      await fulfillJson(route, {
        rewardedAds: {
          createdAt: fixedNow,
          dailyLimit: 20,
          enabled: true,
          provider: 'mvp_rewarded_ad',
          rewardBytes: 100 * 1024 ** 2,
          rewardMb: 100,
          settingKey: 'rewarded_ads',
          updatedAt: fixedNow,
          verificationMode: 'client_callback_mvp',
        },
      });
      return;
    }
    if (pathname === '/api/admin/telegram/topups') {
      await fulfillJson(route, { requests: [] });
      return;
    }

    await fulfillJson(route, { error: `Unmocked reseller-per-gb route: ${pathname}` }, 404);
  });
}

async function openDashboard(
  page: Page,
  path: string,
  state: MockState,
  options?: { sessionToken?: string; size?: { width: number; height: number } },
): Promise<void> {
  await mockApi(page, state);
  await page.setViewportSize(options?.size ?? { width: 1280, height: 900 });
  await page.addInitScript(({ token }) => {
    window.localStorage.setItem('afrows.dashboard.language', 'en');
    window.sessionStorage.setItem('afrows.dashboard.adminSessionToken', token);
  }, { token: options?.sessionToken ?? adminToken });

  await page.goto(path);
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }',
  });
}

test.describe('reseller per-GB pricing surfaces', () => {
  test('superadmin billing hosts the Price per GB control (view + save)', async ({ page }) => {
    const state = createMockState();
    await openDashboard(page, '/billing', state);

    const panel = page.locator('[data-gb-price-panel]');
    await expect(panel.getByRole('heading', { name: 'Price per GB' })).toBeVisible();
    await expect(panel.getByText(/Current price: 200,000 IRT/)).toBeVisible();
    await page.screenshot({ fullPage: false, path: `${shotDir}/gb-price-control.png` });

    await panel.getByLabel(/New price per GB/).fill('250000');
    await panel.getByRole('button', { name: 'Save price' }).click();
    await expect(panel.getByText('GB price saved.')).toBeVisible();
    expect(state.gbPricePatches).toEqual([250_000]);
    await expect(panel.getByText(/Current price: 250,000 IRT/)).toBeVisible();
  });

  test('sellers page drills into a seller and signs in as them (banner + return)', async ({ page }) => {
    const state = createMockState();
    await openDashboard(page, '/resellers', state);

    await expect(page.getByRole('heading', { name: 'Sellers' }).first()).toBeVisible();
    await expect(page.getByText('Hanie Store').first()).toBeVisible();

    // Drill-down: the seller's customers with used/quota usage.
    await page.locator('[data-seller-customers-toggle]').click();
    const drilldown = page.locator('[data-seller-customers]');
    await expect(drilldown.getByText('Customers of Hanie Store')).toBeVisible();
    await expect(drilldown.getByText('Omid Karimi')).toBeVisible();
    await expect(drilldown.getByText(/Used \/ quota/).first()).toBeVisible();
    await page.screenshot({ fullPage: true, path: `${shotDir}/sellers-drilldown.png` });

    // Sign in as seller: reseller-scoped session + a clearly reversible banner.
    await page.locator('[data-seller-impersonate]').click();
    const banner = page.locator('[data-impersonation-banner]');
    await expect(banner.getByText('Viewing as Hanie Store')).toBeVisible();
    // The app now shows the seller's own panel (their GB-price hero).
    await expect(page.locator('[data-reseller-gb-hero]')).toBeVisible();
    await page.screenshot({ fullPage: true, path: `${shotDir}/sellers-impersonation-banner.png` });

    // Return to admin restores the admin session and hides the banner.
    await banner.getByRole('button', { name: 'Return to admin' }).click();
    await expect(page.locator('[data-impersonation-banner]')).toHaveCount(0);
    await expect(page.locator('[data-reseller-gb-hero]')).toHaveCount(0);
  });

  test('seller top-ups approval page lists receipts and approves/rejects', async ({ page }) => {
    const state = createMockState();
    await openDashboard(page, '/reseller-topups', state);

    await expect(page.getByRole('heading', { name: 'Seller wallet top-ups' }).first()).toBeVisible();
    const pendingCard = page.locator('article').filter({ hasText: 'RT-2001' });
    await expect(pendingCard).toBeVisible();
    await expect(pendingCard.locator('[data-receipt-thumb] img')).toBeVisible();

    // Sidebar badge shows the pending count.
    const navItem = page.locator('[data-view="reseller-topups"]');
    await expect(navItem.getByText('1', { exact: true })).toBeVisible();
    await page.screenshot({ fullPage: true, path: `${shotDir}/reseller-topups-approval.png` });

    // Approve confirms first and credits the wallet.
    page.on('dialog', (dialog) => void dialog.accept());
    await pendingCard.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Top-up approved and the seller wallet was credited.')).toBeVisible();
    expect(state.approveCalls).toEqual(['rtopup-1']);
  });

  test('reseller panel: gb price hero, per-GB sell quote, wallet top-up request', async ({ page }) => {
    const state = createMockState();
    // The local dev server runs with VITE_DEV_SKIP_AUTH (admin session), so the
    // reseller panel is reached through the real "Sign in as seller" flow.
    await openDashboard(page, '/resellers', state);
    await page.locator('[data-seller-impersonate]').click();

    // Prominent "Today: <gbPrice> / GB" + credit + margin + kept markup.
    const hero = page.locator('[data-reseller-gb-hero]');
    await expect(hero.getByText('Today: 200,000 IRT / GB')).toBeVisible();
    await expect(hero.getByText('Available credit')).toBeVisible();
    await expect(hero.getByText('20%').first()).toBeVisible();
    await expect(hero.getByText('40,000 IRT')).toBeVisible();

    // Per-GB sell form: entering GB shows cost debited + suggested sell price.
    const sellPanel = page.locator('[data-reseller-gb-sell]');
    await sellPanel.getByLabel('GB amount').fill('20');
    const quoteBox = page.locator('[data-reseller-gb-quote]');
    await expect(quoteBox.getByText('4,000,000 IRT')).toBeVisible(); // cost debited
    await expect(quoteBox.getByText('4,800,000 IRT')).toBeVisible(); // suggested sell price
    await expect(quoteBox.getByText('800,000 IRT', { exact: true })).toBeVisible(); // markup kept
    await page.screenshot({ fullPage: true, path: `${shotDir}/reseller-panel.png` });

    // Completing the sale debits the wallet through the gb-charges endpoint.
    await sellPanel.getByLabel('Sale customer').selectOption('customer-omid');
    await sellPanel.getByRole('button', { name: 'Sell GB' }).click();
    await expect(sellPanel.getByText(/20 GB sold; 4,000,000 IRT debited/)).toBeVisible();
    expect(state.gbChargeCalls).toHaveLength(1);
    expect(state.gbChargeCalls[0].gb).toBe(20);
    expect(state.gbChargeCalls[0].customerAccountId).toBe('customer-omid');

    // Wallet top-up request: amount + card-to-card receipt upload -> pending.
    const topupPanel = page.locator('[data-reseller-wallet-topup]');
    await topupPanel.getByLabel(/Amount \(IRT\)/).fill('3000000');
    await topupPanel.getByLabel(/Card-to-card receipt/).setInputFiles({
      buffer: Buffer.from(receiptSvg, 'utf8'),
      mimeType: 'image/svg+xml',
      name: 'receipt.svg',
    });
    await topupPanel.getByRole('button', { name: 'Submit top-up request' }).click();
    await expect(topupPanel.getByText('Top-up request submitted. Your wallet is credited after approval.')).toBeVisible();
    expect(state.topupCreateCalls).toBe(1);
    await expect(topupPanel.getByText('3,000,000 IRT').first()).toBeVisible();
    await page.screenshot({ fullPage: true, path: `${shotDir}/reseller-panel-topup-request.png` });
  });

  test('reseller panel stays usable at 390px with no horizontal scroll', async ({ page }) => {
    const state = createMockState();
    await openDashboard(page, '/resellers', state, { size: { width: 390, height: 844 } });
    await page.locator('[data-seller-impersonate]').click();

    await expect(page.locator('[data-reseller-gb-hero]').getByText('Today: 200,000 IRT / GB')).toBeVisible();
    const horizontalOverflow = await page.evaluate(() =>
      Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
      ));
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
    await page.screenshot({ fullPage: true, path: `${shotDir}/reseller-panel-390.png` });
  });
});
