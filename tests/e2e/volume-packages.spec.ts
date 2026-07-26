import { expect, test, type Page, type Route } from '@playwright/test';

// Volume packages management panel on the Billing page (the GB bundles the
// Telegram bot sells in Buy Data): mocked-API captures + behavior assertions.

const sessionToken = 'volume-packages-session-token';
const fixedNow = '2026-07-26T08:00:00.000Z';
const shotDir = 'test-results/volume-packages';

interface VolumePackageMockState {
  createCalls: Array<Record<string, unknown>>;
  patchCalls: Array<{ id: string; payload: Record<string, unknown> }>;
  packages: Array<Record<string, unknown>>;
}

function createPackages(): Array<Record<string, unknown>> {
  return [
    {
      createdAt: fixedNow,
      createdBy: 'admin',
      currency: 'IRT',
      durationDays: null,
      id: 'pkg-25',
      name: '25 GB',
      notes: null,
      pricePerGb: 8_800,
      slug: '25-gb',
      sortOrder: 0,
      status: 'active',
      totalPrice: 220_000,
      updatedAt: fixedNow,
      volumeBytes: 25_000_000_000,
      volumeGb: 25,
    },
    {
      createdAt: fixedNow,
      createdBy: 'admin',
      currency: 'IRT',
      durationDays: 90,
      id: 'pkg-100',
      name: '100 GB',
      notes: null,
      pricePerGb: 7_500,
      slug: '100-gb',
      sortOrder: 1,
      status: 'archived',
      totalPrice: 750_000,
      updatedAt: fixedNow,
      volumeBytes: 100_000_000_000,
      volumeGb: 100,
    },
  ];
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
}

// Mirrors the backend: volumeGb arrives whole-GB and is converted to bytes
// server-side with the decimal convention (1 GB = 1,000,000,000 bytes).
function packageFromPayload(id: string, existing: Record<string, unknown> | null, payload: Record<string, unknown>): Record<string, unknown> {
  const volumeGb = typeof payload.volumeGb === 'number' ? payload.volumeGb : (existing?.volumeGb as number ?? 0);
  const name = typeof payload.name === 'string' ? payload.name : (existing?.name as string ?? '');

  return {
    createdAt: fixedNow,
    createdBy: 'admin',
    currency: payload.currency ?? existing?.currency ?? 'IRT',
    durationDays: payload.durationDays !== undefined ? payload.durationDays : existing?.durationDays ?? null,
    id,
    name,
    notes: null,
    pricePerGb: existing?.pricePerGb ?? 0,
    slug: name.trim().toLowerCase().replace(/\s+/g, '-'),
    sortOrder: existing?.sortOrder ?? 0,
    status: payload.status ?? existing?.status ?? 'active',
    totalPrice: payload.totalPrice ?? existing?.totalPrice ?? 0,
    updatedAt: fixedNow,
    volumeBytes: volumeGb * 1_000_000_000,
    volumeGb,
  };
}

async function mockBillingApi(page: Page, state: VolumePackageMockState): Promise<void> {
  await page.route('http://127.0.0.1:7000/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname === '/api/admin/session') {
      await fulfillJson(route, {
        actor: { id: 'admin-billing', isSuperAdmin: false, role: 'admin', type: 'admin', username: 'admin' },
        expiresAt: '2026-07-26T12:00:00.000Z',
        issuedAt: fixedNow,
        mfaReady: true,
        mfaRequired: false,
      });
      return;
    }

    if (pathname === '/api/admin/billing/catalog') {
      await fulfillJson(route, {
        packages: state.packages,
        paymentMethods: [],
        paymentProviderAdapters: [],
        settings: {
          createdAt: fixedNow,
          currency: 'IRT',
          pricePerGb: 8_000,
          settingKey: 'default',
          updatedAt: fixedNow,
          updatedBy: 'admin',
        },
      });
      return;
    }

    if (pathname === '/api/admin/payment-orders') {
      await fulfillJson(route, { paymentOrders: [] });
      return;
    }

    if (pathname === '/api/admin/customer-accounts') {
      await fulfillJson(route, { accounts: [] });
      return;
    }

    if (pathname === '/api/admin/rewarded-ads/settings') {
      await fulfillJson(route, {
        rewardedAds: {
          createdAt: fixedNow,
          dailyLimit: 20,
          enabled: true,
          provider: 'mvp_rewarded_ad',
          rewardBytes: 104_857_600,
          rewardMb: 100,
          settingKey: 'default',
          updatedAt: fixedNow,
          updatedBy: 'admin',
          verificationMode: 'client_callback_mvp',
        },
      });
      return;
    }

    if (pathname === '/api/admin/volume-packages' && request.method() === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.createCalls.push(payload);
      const created = packageFromPayload(`pkg-new-${state.createCalls.length}`, null, payload);
      state.packages = [created, ...state.packages];
      await fulfillJson(route, created, 201);
      return;
    }

    const packageMatch = pathname.match(/^\/api\/admin\/volume-packages\/([^/]+)$/);
    if (packageMatch && request.method() === 'PATCH') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.patchCalls.push({ id: packageMatch[1], payload });
      const index = state.packages.findIndex((item) => item.id === packageMatch[1]);
      const updated = packageFromPayload(packageMatch[1], state.packages[index] ?? null, payload);
      if (index >= 0) state.packages[index] = updated;
      await fulfillJson(route, updated);
      return;
    }

    if (pathname === '/api/admin/volume-packages') {
      await fulfillJson(route, { packages: state.packages });
      return;
    }

    await fulfillJson(route, { error: `Unmocked volume-packages spec route: ${pathname}` }, 404);
  });
}

async function openBillingPage(
  page: Page,
  size: { width: number; height: number },
  language: 'en' | 'fa',
  state: VolumePackageMockState,
): Promise<void> {
  await mockBillingApi(page, state);
  await page.setViewportSize(size);
  await page.addInitScript(({ token, lang }) => {
    window.localStorage.setItem('afrows.dashboard.language', lang);
    window.sessionStorage.setItem('afrows.dashboard.adminSessionToken', token);
  }, { token: sessionToken, lang: language });

  await page.goto('/billing');
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }',
  });
}

const panelTitle = { en: 'Volume packages', fa: 'پکیج‌های حجمی' } as const;

test.describe('volume packages management panel', () => {
  for (const language of ['en', 'fa'] as const) {
    for (const viewport of [
      { name: '390', size: { width: 390, height: 844 } },
      { name: '1280', size: { width: 1280, height: 800 } },
    ]) {
      test(`${language} ${viewport.name}px list and create form render`, async ({ page }) => {
        const state: VolumePackageMockState = { createCalls: [], patchCalls: [], packages: createPackages() };
        await openBillingPage(page, viewport.size, language, state);

        const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: panelTitle[language], exact: true }) }).last();
        await expect(panel.getByRole('heading', { name: panelTitle[language], exact: true })).toBeVisible();
        // Both seeded packages listed with their status and actions reachable.
        await expect(panel.getByText('25 GB', { exact: true })).toBeVisible();
        await expect(panel.getByText('100 GB', { exact: true })).toBeVisible();
        const firstRow = panel.locator('tbody tr').first();
        const actionButton = firstRow.getByRole('button').first();
        await expect(actionButton).toBeVisible();
        // The sticky actions column must be pinned inside the viewport — a
        // clipped/offscreen button still counts as "visible" to Playwright,
        // so assert its box really is within the page width.
        await actionButton.scrollIntoViewIfNeeded();
        const buttonBox = await actionButton.boundingBox();
        expect(buttonBox).not.toBeNull();
        expect(buttonBox!.x).toBeGreaterThanOrEqual(0);
        expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(viewport.size.width + 1);
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

        await panel.scrollIntoViewIfNeeded();
        await page.screenshot({ fullPage: true, path: `${shotDir}/volume-packages-${language}-${viewport.name}.png` });
      });
    }
  }

  test('create posts exactly once with whole-GB volume and price', async ({ page }) => {
    const state: VolumePackageMockState = { createCalls: [], patchCalls: [], packages: createPackages() };
    await openBillingPage(page, { width: 1280, height: 800 }, 'en', state);

    await page.getByLabel('Package name').fill('50 GB');
    await page.getByLabel('Volume (GB)').fill('50');
    await page.getByLabel('Total price').fill('400000');
    await page.getByRole('button', { name: 'Create package' }).click();

    await expect(page.getByText('Volume package saved.')).toBeVisible();
    expect(state.createCalls).toHaveLength(1);
    expect(state.createCalls[0]).toMatchObject({
      currency: 'IRT',
      durationDays: null,
      name: '50 GB',
      status: 'active',
      totalPrice: 400_000,
      volumeGb: 50,
    });
    // Backend derives bytes from volumeGb (decimal GB); the new row shows 50 GB.
    const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Volume packages', exact: true }) }).last();
    await expect(panel.getByText('50 GB', { exact: true }).first()).toBeVisible();
    await page.screenshot({ fullPage: true, path: `${shotDir}/volume-packages-en-1280-created.png` });
  });

  test('client-side validation blocks a non-positive GB volume without posting', async ({ page }) => {
    const state: VolumePackageMockState = { createCalls: [], patchCalls: [], packages: createPackages() };
    await openBillingPage(page, { width: 1280, height: 800 }, 'en', state);

    await page.getByLabel('Package name').fill('Broken');
    await page.getByLabel('Volume (GB)').fill('0');
    await page.getByLabel('Total price').fill('1000');
    await page.getByRole('button', { name: 'Create package' }).click();

    await expect(page.getByText('Enter a name, a whole GB volume above zero, and a price of zero or more.')).toBeVisible();
    expect(state.createCalls).toHaveLength(0);
  });

  test('edit prefills the form and patches the selected package', async ({ page }) => {
    const state: VolumePackageMockState = { createCalls: [], patchCalls: [], packages: createPackages() };
    await openBillingPage(page, { width: 1280, height: 800 }, 'en', state);

    const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Volume packages', exact: true }) }).last();
    await panel.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click();

    await expect(panel.getByText('Editing: 25 GB')).toBeVisible();
    await expect(page.getByLabel('Package name')).toHaveValue('25 GB');
    await expect(page.getByLabel('Volume (GB)')).toHaveValue('25');
    await expect(page.getByLabel('Total price')).toHaveValue('220000');
    await page.screenshot({ fullPage: true, path: `${shotDir}/volume-packages-en-1280-edit.png` });

    await page.getByLabel('Total price').fill('250000');
    await page.getByRole('button', { name: 'Save package' }).click();

    await expect(page.getByText('Volume package saved.')).toBeVisible();
    expect(state.patchCalls).toHaveLength(1);
    expect(state.patchCalls[0].id).toBe('pkg-25');
    expect(state.patchCalls[0].payload).toMatchObject({ name: '25 GB', totalPrice: 250_000, volumeGb: 25 });
  });

  test('archive and activate toggle the package status via PATCH', async ({ page }) => {
    const state: VolumePackageMockState = { createCalls: [], patchCalls: [], packages: createPackages() };
    await openBillingPage(page, { width: 1280, height: 800 }, 'en', state);

    const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Volume packages', exact: true }) }).last();
    const activeRow = panel.locator('tbody tr').filter({ hasText: '25 GB' });
    await activeRow.getByRole('button', { name: 'Archive' }).click();
    await expect(activeRow.getByRole('button', { name: 'Activate' })).toBeVisible();

    const archivedRow = panel.locator('tbody tr').filter({ hasText: '100 GB' });
    await archivedRow.getByRole('button', { name: 'Activate' }).click();
    await expect(archivedRow.getByRole('button', { name: 'Archive' })).toBeVisible();

    expect(state.patchCalls).toEqual([
      { id: 'pkg-25', payload: { status: 'archived' } },
      { id: 'pkg-100', payload: { status: 'active' } },
    ]);
  });
});
