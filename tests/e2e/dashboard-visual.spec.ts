import { expect, test, type Page, type Route } from '@playwright/test';

const visualSessionToken = 'visual-session-token';
const fixedNow = '2026-05-28T08:00:00.000Z';

const denseViewports = [
  { name: 'mobile', size: { width: 390, height: 844 } },
  { name: 'tablet', size: { width: 834, height: 1112 } },
  { name: 'desktop', size: { width: 1440, height: 900 } },
  { name: 'second-lcd', size: { width: 1920, height: 1080 } },
];

const snapshots = [
  createMetricSnapshot('server-fra', 'fra-edge-01', 'ubuntu 24.04', 38, 54, 42, 92, 51_200_000, 18_400_000),
  createMetricSnapshot('server-dxb', 'dxb-relay-02', 'ubuntu 24.04', 64, 69, 18, 72, 34_700_000, 12_900_000),
  createMetricSnapshot('server-teh', 'teh-gateway-03', 'ubuntu 22.04', 81, 76, 8, 36, 18_100_000, 7_600_000),
];

type VisualSessionRole = 'superadmin' | 'reseller';

interface VisualDashboardOptions {
  sessionRole?: VisualSessionRole;
}

test.describe('dashboard dense layout visual captures', () => {
  for (const viewport of denseViewports) {
    test(`${viewport.name} dashboard capture`, async ({ page }, testInfo) => {
      const runtimeErrors: string[] = [];
      page.on('pageerror', (error) => runtimeErrors.push(error.message));

      await loadSignedInDashboard(page, viewport.size);

      expect(runtimeErrors).toEqual([]);
      await expect(page.locator('[aria-label="Summary"]')).toBeVisible();
      await expect(page.locator('[aria-label="System resources"]')).toBeVisible();
      await expect(page.locator('[data-view="alerts"]')).toHaveAttribute('aria-label', /critical/i);
      await expect(page.locator('canvas').first()).toBeVisible();

      const horizontalOverflow = await page.evaluate(() =>
        Math.max(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.body.clientWidth,
        ),
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(1);

      await page.evaluate(() => window.scrollTo(0, 0));
      const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
      expect(screenshot.length).toBeGreaterThan(10_000);

      await testInfo.attach(`dashboard-dense-${viewport.name}`, {
        body: screenshot,
        contentType: 'image/png',
      });
    });
  }
});

test('dashboard supports kiosk display mode', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });

  await expect(page.locator('[data-dashboard-kiosk="false"]')).toBeVisible();
  await expect(page.locator('aside')).toBeVisible();

  await page.getByRole('button', { name: 'Enter kiosk display' }).click();

  await expect(page.locator('[data-dashboard-kiosk="true"]')).toBeVisible();
  await expect(page.locator('aside')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Exit kiosk display' })).toBeVisible();

  await page.getByRole('button', { name: 'Exit kiosk display' }).click();

  await expect(page.locator('[data-dashboard-kiosk="false"]')).toBeVisible();
  await expect(page.locator('aside')).toBeVisible();
});

test('dashboard starts on NOC view with backend outbounds and client-side switches', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });
  const initialPath = new URL(page.url()).pathname;

  await expect(page.getByRole('heading', { name: 'Network operations display' })).toBeVisible();
  await expect(page.getByText('Frankfurt WG gaming').first()).toBeVisible();

  await page.locator('[data-view="alerts"]').click();
  await expect(page.getByRole('heading', { name: 'Alerts and delivery' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(initialPath);

  await page.locator('[data-view="dashboard"]').click();
  await expect(page.getByRole('heading', { name: 'Network operations display' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(initialPath);
});

test('alerts page filters open and resolved history rows', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });
  await page.locator('[data-view="alerts"]').click();

  await expect(page.getByRole('heading', { name: 'Open Alerts' })).toBeVisible();
  await expect(page.getByText('Storage below 10%', { exact: true })).toBeVisible();
  const timelinePanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Incident Timeline' }),
  }).last();
  await expect(timelinePanel).toBeVisible();
  await expect(timelinePanel.getByText('Frankfurt WG gaming -> Dubai WG standby')).toBeVisible();

  await page.getByRole('button', { name: 'Resolved' }).click();
  await expect(page.getByRole('heading', { name: 'Alert History' })).toBeVisible();
  await expect(page.getByText('Resolved storage guard')).toBeVisible();
  await expect(page.getByText('Resolved tunnel jitter')).toBeVisible();

  await page.getByLabel('Severity').selectOption('critical');
  await expect(page.getByText('Resolved storage guard')).toBeVisible();
  await expect(page.getByText('Resolved tunnel jitter')).toHaveCount(0);

  await page.getByLabel('Source', { exact: true }).selectOption('teh-gateway-03');
  await expect(page.getByText('Resolved storage guard')).toBeVisible();
});

test('routes page shows route health score history', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });
  await page.locator('[data-view="routes"]').click();
  await page.getByRole('tab', { name: /History/ }).click();

  const historyPanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Route Health History' }),
  }).last();

  await expect(historyPanel).toBeVisible();
  await expect(historyPanel.getByText('Frankfurt WG gaming')).toBeVisible();
  await expect(historyPanel.getByText(/synthetic probes only/)).toBeVisible();

  await page.getByRole('tab', { name: /Canary/ }).click();
  const canaryPanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Route Canary Rollout' }),
  }).last();
  await expect(canaryPanel).toBeVisible();
  await expect(canaryPanel.getByLabel('Record assignment')).toBeVisible();
  await expect(canaryPanel.getByText('Dubai WG standby')).toBeVisible();
  await expect(canaryPanel.getByLabel('Sessions protected').first()).toBeVisible();
});

test('billing page shows catalog and saves reward settings', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });
  await page.locator('[data-view="billing"]').click();

  await expect(page.getByRole('heading', { name: 'Usage and billing' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reward Settings' })).toBeVisible();
  await expect(page.getByText('starter-25gb')).toBeVisible();
  await expect(page.getByText('Payment provider adapters')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Card' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Bank transfer' })).toBeVisible();

  await page.getByLabel('Reward MB').fill('150');
  await page.getByRole('button', { name: 'Save reward settings' }).click();
  await expect(page.getByText('Reward settings saved.')).toBeVisible();

  await page.getByRole('tab', { name: /Telegram/ }).click();
  await expect(page.getByRole('heading', { name: 'Telegram Operations' })).toBeVisible();
  await expect(page.getByText('Usage link')).toBeVisible();
  await expect(page.getByText('Delivery candidates')).toBeVisible();

  await page.getByRole('tab', { name: /Customers/ }).click();
  await expect(page.getByRole('heading', { name: 'Customer limit manager' })).toBeVisible();
  await page.getByLabel('Display name').fill('VIP gamer');
  await page.getByLabel('Telegram username').fill('vip_gamer');
  await page.getByLabel('Account quota GB').fill('80');
  await page.getByLabel('Per-client cap GB').fill('20');
  await page.getByLabel('Quota scope', { exact: true }).selectOption('per_client');
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page.getByText('Customer account saved.')).toBeVisible();
  await expect(page.getByRole('cell', { name: /VIP gamer/ })).toBeVisible();

  await page.getByRole('tab', { name: /Panel import/ }).click();
  await expect(page.getByRole('heading', { name: 'Current panel import' })).toBeVisible();
  await page.getByLabel('Current panel payload JSON').fill(JSON.stringify({
    users: [
      {
        data_limit: '25GB',
        expire: 1893456000,
        status: 'active',
        used_traffic: '6GB',
        username: 'vip_gamer',
      },
    ],
  }));
  await page.getByRole('button', { name: 'Preview import' }).click();
  await expect(page.getByText('1 candidates ready.')).toBeVisible();
  await expect(page.getByRole('cell', { name: /vip_gamer/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Marzban' })).toBeVisible();

  await page.getByLabel('Import to customer').selectOption('account-created');
  await page.getByRole('button', { name: 'Import configs' }).click();
  await expect(page.getByText('1 configs imported, 0 skipped.')).toBeVisible();

  await page.getByLabel('Current panel payload JSON').fill(JSON.stringify({
    users: [
      {
        data_limit: '25GB',
        expire: 1893456000,
        status: 'active',
        used_traffic: '7GB',
        username: 'vip_gamer',
      },
    ],
  }));
  await page.getByRole('button', { name: 'Sync usage' }).click();
  await expect(page.getByText('1 usage updates synced, 0 skipped.')).toBeVisible();

  await page.getByRole('button', { name: 'Export configs' }).click();
  await expect(page.getByText('1 configs exported.')).toBeVisible();
  await expect(page.getByLabel('Exported config JSON')).toHaveValue(/afrogate_client_configs_export_v1/);

  await page.getByLabel('Charge GB').fill('5');
  await page.getByRole('button', { name: 'Charge volume' }).click();
  await expect(page.getByText('5 GB charged locally; external panel write not executed.')).toBeVisible();
});

test('reseller session shows scoped seller dashboard, users, and billing', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 }, { sessionRole: 'reseller' });

  await expect(page.getByRole('heading', { name: 'Seller dashboard' })).toBeVisible();
  await expect(page.locator('[data-view="dashboard"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-view="users"]')).toBeVisible();
  await expect(page.locator('[data-view="billing"]')).toBeVisible();
  await expect(page.locator('[data-view="servers"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Sales trend' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Service experience' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Selling summary' })).toBeVisible();

  await page.locator('[data-view="users"]').click();
  await expect(page.locator('h1', { hasText: 'Sold users' })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Reseller gaming customer/ }).first()).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Sold volume' })).toBeVisible();

  const usersTablePanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Sold users' }),
  }).last();
  await usersTablePanel.getByRole('button', { name: 'Add user' }).click();
  const usersAddDialog = page.getByRole('dialog', { name: 'Add user' });
  await expect(usersAddDialog).toBeVisible();
  await usersAddDialog.getByLabel('Display name').fill('Users page customer');
  await usersAddDialog.getByLabel('Telegram username').fill('users_page_customer');
  await usersAddDialog.getByRole('button', { name: 'Add user' }).click();
  await expect(usersAddDialog).toHaveCount(0);
  await expect(usersTablePanel.getByText(/sold; .* debited from wallet/)).toBeVisible();
  await expect(usersTablePanel.getByRole('cell', { name: /Users page customer/ }).first()).toBeVisible();

  await page.locator('[data-view="billing"]').click();
  await expect(page.getByRole('heading', { name: 'Seller billing' })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Reseller workspace' })).toBeVisible();
  await expect(page.getByText('Mobile Shop Tehran').first()).toBeVisible();
  await expect(page.getByText('Wallet balance').first()).toBeVisible();
  await expect(page.getByText('Available balance').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Selling summary' })).toBeVisible();
  await expect(page.getByText('Sale debit')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reward Settings' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Current panel import' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Telegram Operations' })).toHaveCount(0);

  const packageSalePanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Wallet-gated package sale' }),
  }).last();
  await expect(packageSalePanel).toBeVisible();
  await packageSalePanel.getByLabel('Display name').fill('Wallet sale customer');
  await packageSalePanel.getByLabel('Telegram username').fill('wallet_customer');
  await packageSalePanel.getByRole('button', { name: 'Sell package' }).click();
  await expect(packageSalePanel.getByText(/sold; .* debited from wallet/)).toBeVisible();
  await expect(page.getByRole('cell', { name: /Wallet sale customer/ }).first()).toBeVisible();

  const customerPanel = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'Customer limit manager' }),
  }).last();
  await expect(customerPanel).toBeVisible();
  await customerPanel.getByLabel('Display name').fill('Mobile shop customer');
  await customerPanel.getByLabel('Telegram username').fill('mobile_customer');
  await customerPanel.getByLabel('Account quota GB').fill('50');
  await customerPanel.getByRole('button', { name: 'Create customer' }).click();
  await expect(page.getByText('Customer account saved.')).toBeVisible();
  await expect(page.getByRole('cell', { name: /Mobile shop customer/ })).toBeVisible();
});

test('audit logs page shows sanitized audit events', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });
  await page.locator('[data-view="audit"]').click();

  await expect(page.getByRole('heading', { name: 'Audit logs' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Audit events' })).toBeVisible();
  await expect(page.getByText('admin.login.succeeded')).toBeVisible();
  await expect(page.getByText('[redacted]')).toBeVisible();
});

test('backups page shows monitored backup readiness', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });
  await page.locator('[data-view="backups"]').click();

  await expect(page.getByRole('heading', { name: 'Backups' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Backup monitor' })).toBeVisible();
  await expect(page.getByText('encrypted', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /Backup readiness/ }).click();
  await expect(page.getByText('PostgreSQL dump, Config files, Encrypted secrets').first()).toBeVisible();
  await expect(page.getByText('No backup issues')).toBeVisible();

  await page.getByRole('tab', { name: /Restore runbook/ }).click();
  await expect(page.getByRole('heading', { name: 'Restore readiness' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Restore runbook' })).toBeVisible();
  await expect(page.getByText('execution disabled')).toBeVisible();
});

test('reports page shows operational analysis summary', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });
  await page.locator('[data-view="reports"]').click();

  await expect(page.getByRole('heading', { name: 'Reports and analysis' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operations report' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operational summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Route quality analysis' })).toBeVisible();
  await expect(page.getByText('A degraded route window is upcoming.')).toBeVisible();
});

test('settings page saves tenant branding', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });
  await page.locator('[data-view="settings"]').click();

  await expect(page.getByRole('heading', { name: 'WireGuard and system setup' })).toBeVisible();
  await page.getByRole('tab', { name: /Branding/ }).click();
  await expect(page.getByRole('heading', { name: 'Tenant Branding' })).toBeVisible();
  await expect(page.getByLabel('Brand name')).toHaveValue('AfroGate Pro');

  await page.getByLabel('Brand name').fill('AfroGate Elite');
  await page.getByLabel('Support Telegram').fill('@afrogate_ops');
  await page.getByRole('button', { name: 'Save branding' }).click();

  await expect(page.getByText('Brand settings saved.')).toBeVisible();
  await expect(page.getByText('AfroGate Elite')).toBeVisible();
});

test('users page shows RBAC permission matrix', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });
  await page.locator('[data-view="users"]').click();

  await expect(page.getByRole('heading', { name: 'User management' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Admin Users' })).toBeVisible();
  await expect(page.getByText('database', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Permissions/ }).click();
  await expect(page.getByRole('heading', { name: 'Role Permissions' })).toBeVisible();
  await expect(page.getByText('Deny by default')).toBeVisible();
  await expect(page.getByText('Server credential write')).toBeVisible();
  await expect(page.getByText('adminUsers:write')).toBeVisible();
});

async function loadSignedInDashboard(
  page: Page,
  size: { width: number; height: number },
  options: VisualDashboardOptions = {},
): Promise<void> {
  await mockDashboardApi(page, options);
  await page.setViewportSize(size);
  await page.addInitScript((sessionToken) => {
    window.localStorage.setItem('afrogate.dashboard.language', 'en');
    window.sessionStorage.setItem('afrogate.dashboard.adminSessionToken', sessionToken);
  }, visualSessionToken);

  await page.goto('/');
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
}

async function mockDashboardApi(page: Page, options: VisualDashboardOptions = {}): Promise<void> {
  const sessionRole = options.sessionRole ?? 'superadmin';

  await page.route('http://127.0.0.1:7000/api/**', async (route) => {
    const url = new URL(route.request().url());

    switch (url.pathname) {
      case '/api/admin/session':
        await fulfillJson(route, {
          actor: {
            id: sessionRole === 'reseller' ? 'admin-reseller-visual' : 'admin-visual',
            isSuperAdmin: sessionRole === 'superadmin',
            role: sessionRole,
            type: 'admin',
            username: sessionRole === 'reseller' ? 'tehran-shop' : 'superadmin',
          },
          expiresAt: '2026-05-28T12:00:00.000Z',
          issuedAt: fixedNow,
          mfaReady: true,
          mfaRequired: false,
        });
        return;
      case '/api/admin/users':
        await fulfillJson(route, {
          users: [
            {
              canChangePassword: false,
              canDelete: false,
              canDisable: false,
              createdAt: fixedNow,
              id: 'superadmin',
              isSuperAdmin: true,
              lastLoginAt: fixedNow,
              role: 'superadmin',
              source: 'bootstrap',
              status: 'active',
              updatedAt: fixedNow,
              username: 'superadmin',
            },
            {
              canChangePassword: true,
              canDelete: true,
              canDisable: true,
              createdAt: fixedNow,
              id: 'admin:owner-visual',
              isSuperAdmin: false,
              lastLoginAt: null,
              role: 'owner',
              source: 'database',
              status: 'active',
              updatedAt: fixedNow,
              username: 'ops-owner',
            },
          ],
        });
        return;
      case '/api/admin/permissions':
        await fulfillJson(route, {
          currentHasFullAccess: sessionRole === 'superadmin',
          currentPermissions: sessionRole === 'reseller'
            ? ['billing:read', 'customers:read', 'customers:write', 'resellerWallet:read']
            : [
                'dashboard:read',
                'servers:read',
                'serverCredentials:write',
                'adminUsers:write',
              ],
          currentRole: sessionRole,
          deniedByDefault: true,
          permissions: [
            { category: 'operations', id: 'dashboard:read', risk: 'low' },
            { category: 'operations', id: 'servers:read', risk: 'low' },
            { category: 'billing', id: 'billing:read', risk: 'low' },
            { category: 'billing', id: 'customers:read', risk: 'low' },
            { category: 'billing', id: 'customers:write', risk: 'medium' },
            { category: 'billing', id: 'resellerWallet:read', risk: 'medium' },
            { category: 'secrets', id: 'serverCredentials:write', risk: 'critical' },
            { category: 'access', id: 'adminUsers:write', risk: 'critical' },
          ],
          roles: [
            {
              canManageAdminUsers: true,
              inheritsAll: true,
              isSystemOwner: true,
              permissions: [
                'dashboard:read',
                'servers:read',
                'serverCredentials:write',
                'adminUsers:write',
              ],
              role: 'superadmin',
            },
            {
              canManageAdminUsers: true,
              inheritsAll: true,
              isSystemOwner: true,
              permissions: [
                'dashboard:read',
                'servers:read',
                'serverCredentials:write',
                'adminUsers:write',
              ],
              role: 'owner',
            },
            {
              canManageAdminUsers: false,
              inheritsAll: false,
              isSystemOwner: false,
              permissions: ['billing:read', 'customers:read', 'customers:write', 'resellerWallet:read'],
              role: 'reseller',
            },
            {
              canManageAdminUsers: false,
              inheritsAll: false,
              isSystemOwner: false,
              permissions: ['dashboard:read', 'servers:read'],
              role: 'support',
            },
          ],
        });
        return;
      case '/api/admin/reseller/workspace':
        await fulfillJson(route, {
          workspace: resellerWorkspaceResponse(),
        });
        return;
      case '/api/admin/reseller/customer-accounts':
        if (route.request().method() === 'POST') {
          const payload = route.request().postDataJSON() as {
            displayName?: string | null;
            notes?: string | null;
            perClientLimitBytes?: number | null;
            quotaLimitBytes?: number | null;
            quotaScope?: string;
            status?: string;
            telegramUsername?: string | null;
          };
          const quotaLimitBytes = payload.quotaLimitBytes ?? null;
          const usedBytes = 0;

          await fulfillJson(route, {
            activeClientCount: 0,
            clientConfigs: [],
            clientCount: 0,
            createdAt: fixedNow,
            displayName: payload.displayName ?? null,
            hasPaidNumberHash: false,
            id: 'reseller-account-created',
            notes: payload.notes ?? null,
            perClientLimitBytes: payload.perClientLimitBytes ?? null,
            quotaLimitBytes,
            quotaScope: payload.quotaScope ?? 'account_shared',
            remainingBytes: quotaLimitBytes === null ? null : quotaLimitBytes - usedBytes,
            resellerAccountId: 'reseller-visual',
            resellerDisplayName: 'Mobile Shop Tehran',
            status: payload.status ?? 'active',
            telegramId: null,
            telegramUsername: payload.telegramUsername ?? null,
            updatedAt: fixedNow,
            usedBytes,
          });
          return;
        }

        await fulfillJson(route, { error: 'Unsupported reseller customer method' }, 405);
        return;
      case '/api/admin/reseller/package-sales':
        if (route.request().method() === 'POST') {
          const payload = route.request().postDataJSON() as {
            customerAccount?: {
              displayName?: string | null;
              notes?: string | null;
              telegramUsername?: string | null;
            } | null;
            volumePackageId: string;
          };
          await fulfillJson(route, resellerPackageSaleResponse(payload));
          return;
        }

        await fulfillJson(route, { error: 'Unsupported reseller package sale method' }, 405);
        return;
      case '/api/metrics/latest':
        await fulfillJson(route, { servers: snapshots });
        return;
      case '/api/metrics/timeseries':
        await fulfillJson(route, {
          bucketSeconds: 300,
          range: url.searchParams.get('range') ?? '1h',
          series: snapshots.map(createTimeseries),
        });
        return;
      case '/api/admin/alerts':
        await fulfillJson(route, {
          alerts: url.searchParams.get('status') === 'resolved' ? resolvedAlertRows() : openAlertRows(),
        });
        return;
      case '/api/admin/incidents/timeline':
        await fulfillJson(route, incidentTimelineResponse());
        return;
      case '/api/admin/audit-logs':
        await fulfillJson(route, {
          auditLogs: auditLogRows(),
        });
        return;
      case '/api/admin/backups/status':
        await fulfillJson(route, {
          backup: backupStatusRow(),
        });
        return;
      case '/api/admin/backups/restore-plan':
        await fulfillJson(route, {
          restorePlan: backupRestorePlanRow(),
        });
        return;
      case '/api/admin/reports/summary':
        await fulfillJson(route, reportsSummaryRow());
        return;
      case '/api/admin/tenant-branding':
        await fulfillJson(route, {
          branding: tenantBrandingRow(route.request().method() === 'PATCH'
            ? route.request().postDataJSON() as Parameters<typeof tenantBrandingRow>[0]
            : {}),
        });
        return;
      case '/api/admin/servers':
        await fulfillJson(route, {
          servers: snapshots.map((snapshot, index) => ({
            accessProfile: undefined,
            country: ['DE', 'AE', 'IR'][index],
            createdAt: fixedNow,
            externalId: snapshot.serverId,
            firstSeenAt: fixedNow,
            hostname: snapshot.hostname,
            id: snapshot.serverId,
            lastSeenAt: fixedNow,
            latestMetric: snapshot,
            openAlertCount: index === 2 ? 1 : 0,
            outboundCount: index === 0 ? 2 : 1,
            platform: snapshot.platform,
            region: ['Frankfurt', 'Dubai', 'Tehran'][index],
            role: index === 0 ? 'edge' : 'relay',
            status: index === 2 ? 'critical' : index === 1 ? 'degraded' : 'healthy',
            tags: index === 0 ? ['wireguard', 'gaming'] : ['wireguard'],
            updatedAt: fixedNow,
          })),
        });
        return;
      case '/api/admin/outbounds':
        await fulfillJson(route, {
          outbounds: [
            createOutbound('outbound-fra-wg', 'server-fra', 'fra-edge-01', 'Frankfurt WG gaming', 'gaming', 1, 'healthy'),
            createOutbound('outbound-dxb-wg', 'server-dxb', 'dxb-relay-02', 'Dubai WG standby', 'gaming', 2, 'degraded'),
            createOutbound('outbound-teh-direct', 'server-teh', 'teh-gateway-03', 'Tehran direct control', 'control', 3, 'critical'),
          ],
        });
        return;
      case '/api/admin/route-failover-events':
        await fulfillJson(route, {
          events: [
            {
              createdAt: fixedNow,
              fromOutboundId: 'outbound-dxb-wg',
              id: 'event-hold-gaming',
              reason: 'Sticky gaming sessions kept on the current route during elevated jitter.',
              routeGroup: 'gaming',
              toOutboundId: 'outbound-fra-wg',
              triggerMetric: { jitterMs: 14, packetLossPercent: 0.4 },
            },
          ],
        });
        return;
      case '/api/admin/route-assignments/current':
        await fulfillJson(route, {
          assignmentKey: 'default',
          autoRouteEnabled: true,
          cooldownSeconds: 180,
          cooldownUntil: null,
          currentOutboundId: 'outbound-fra-wg',
          currentOutboundName: 'Frankfurt WG gaming',
          hysteresisScoreDelta: 15,
          lastDecisionAt: null,
          lastDecisionReason: null,
          lockedOutboundId: null,
          lockedOutboundName: null,
          protocolProfile: 'udp',
          routeGroup: 'main',
          routeLocked: false,
          speedProfile: 'gaming',
          updatedAt: fixedNow,
          updatedBy: 'admin-visual',
        });
        return;
      case '/api/admin/route-health/history':
        await fulfillJson(route, routeHealthHistoryResponse());
        return;
      case '/api/admin/route-canary/status':
        await fulfillJson(route, routeCanaryStatusResponse());
        return;
      case '/api/admin/tunnels':
        await fulfillJson(route, {
          tunnels: [
            createTunnel('tunnel-fra-wg', 'server-fra', 'fra-edge-01', 'Frankfurt WG0', 'up', 'gaming'),
            createTunnel('tunnel-dxb-wg', 'server-dxb', 'dxb-relay-02', 'Dubai WG0', 'degraded', 'gaming'),
            createTunnel('tunnel-teh-wg', 'server-teh', 'teh-gateway-03', 'Tehran WG0', 'down', 'control'),
          ],
        });
        return;
      case '/api/admin/billing/catalog':
        await fulfillJson(route, {
          paymentMethods: [
            {
              checkoutMode: 'provider_sdk',
              createdAt: fixedNow,
              currency: 'USD',
              id: 'method-paypal',
              instructions: null,
              maxAmount: null,
              minAmount: 1,
              name: 'PayPal',
              provider: 'paypal',
              publicConfig: {},
              slug: 'paypal',
              sortOrder: 1,
              status: 'active',
              supportsAutoCapture: true,
              updatedAt: fixedNow,
            },
          ],
          paymentProviderAdapters: [
            createPaymentProviderAdapter('paypal', 'hosted_redirect', 'auto_capture', 'implemented', true),
            createPaymentProviderAdapter('card', 'hosted_redirect', 'hosted_gateway', 'verification_adapter_required', false),
            createPaymentProviderAdapter('local_gateway', 'hosted_redirect', 'hosted_gateway', 'verification_adapter_required', false),
            createPaymentProviderAdapter('bank_transfer', 'manual', 'manual_verification', 'manual_settlement', false),
            createPaymentProviderAdapter('crypto', 'manual', 'manual_verification', 'manual_settlement', false),
          ],
          packages: [
            {
              createdAt: fixedNow,
              currency: 'USD',
              durationDays: 30,
              id: 'package-starter',
              name: 'Starter 25GB',
              notes: null,
              pricePerGb: 1,
              slug: 'starter-25gb',
              sortOrder: 1,
              status: 'active',
              totalPrice: 25,
              updatedAt: fixedNow,
              volumeBytes: 26_843_545_600,
              volumeGb: 25,
            },
          ],
          settings: {
            createdAt: fixedNow,
            currency: 'USD',
            pricePerGb: 1,
            settingKey: 'default',
            updatedAt: fixedNow,
            updatedBy: 'admin-visual',
          },
        });
        return;
      case '/api/admin/payment-orders':
        await fulfillJson(route, {
          paymentOrders: [
            {
              allocationDelaySeconds: 12,
              allocationId: null,
              allocationStatus: 'pending',
              allocatedAt: null,
              allocatedVolumeBytes: null,
              amount: 25,
              createdAt: fixedNow,
              currency: 'USD',
              customerAccountId: 'account-visual',
              customerDisplayName: 'Gaming customer',
              customerTelegramUsername: 'player_one',
              durationDays: 30,
              expiresAt: null,
              failedAt: null,
              id: 'order-visual',
              idempotencyKey: 'visual-order',
              metadata: {},
              notes: null,
              packageName: 'Starter 25GB',
              packageSlug: 'starter-25gb',
              paidAt: fixedNow,
              paymentMethodId: 'method-paypal',
              paymentMethodName: 'PayPal',
              paymentMethodSlug: 'paypal',
              pricePerGb: 1,
              provider: 'paypal',
              providerCaptureId: 'capture-visual',
              providerOrderId: 'provider-order-visual',
              refundedAt: null,
              status: 'paid',
              updatedAt: fixedNow,
              volumeBytes: 26_843_545_600,
              volumeGb: 25,
              volumePackageId: 'package-starter',
            },
          ],
        });
        return;
      case '/api/admin/customer-accounts':
        if (route.request().method() === 'POST') {
          const payload = route.request().postDataJSON() as {
            displayName?: string | null;
            notes?: string | null;
            perClientLimitBytes?: number | null;
            quotaLimitBytes?: number | null;
            quotaScope?: string;
            status?: string;
            telegramUsername?: string | null;
          };
          const quotaLimitBytes = payload.quotaLimitBytes ?? null;
          const usedBytes = 0;

          await fulfillJson(route, {
            activeClientCount: 0,
            clientConfigs: [],
            clientCount: 0,
            createdAt: fixedNow,
            displayName: payload.displayName ?? null,
            hasPaidNumberHash: false,
            id: 'account-created',
            notes: payload.notes ?? null,
            perClientLimitBytes: payload.perClientLimitBytes ?? null,
            quotaLimitBytes,
            quotaScope: payload.quotaScope ?? 'account_shared',
            remainingBytes: quotaLimitBytes === null ? null : quotaLimitBytes - usedBytes,
            status: payload.status ?? 'active',
            telegramId: null,
            telegramUsername: payload.telegramUsername ?? null,
            updatedAt: fixedNow,
            usedBytes,
          });
          return;
        }

        await fulfillJson(route, {
          accounts: [
            {
              activeClientCount: 1,
              clientCount: 2,
              createdAt: fixedNow,
              displayName: 'Gaming customer',
              hasPaidNumberHash: true,
              id: 'account-visual',
              notes: null,
              perClientLimitBytes: null,
              quotaLimitBytes: 53_687_091_200,
              quotaScope: 'account_shared',
              remainingBytes: 32_212_254_720,
              status: 'active',
              telegramId: null,
              telegramUsername: 'player_one',
              updatedAt: fixedNow,
              usedBytes: 21_474_836_480,
            },
          ],
        });
        return;
      case '/api/admin/settings/telegram-bot':
        await fulfillJson(route, {
          telegramBot: {
            alertChatId: '123456789',
            alertChatIdSource: 'database',
            alertsEnabled: true,
            allowedAdminChatIds: ['123456789'],
            botFirstName: 'AfroGate Demo',
            botId: 987654321,
            botTokenSource: 'database',
            botUsername: 'afrogate_demo_bot',
            commandsEnabled: true,
            hasBotToken: true,
            hasWebhookSecret: true,
            lastTestDurationMs: 84,
            lastTestErrorCode: null,
            lastTestStatus: 'ok',
            lastTestedAt: fixedNow,
            outboundProxyConfigured: true,
            updatedAt: fixedNow,
            updatedBy: 'admin-visual',
            webhookSecretSource: 'database',
          },
        });
        return;
      case '/api/admin/current-panels/import-preview':
        await fulfillJson(route, {
          activeCount: 1,
          adapterVersion: 'current-panel-import-preview-v1',
          candidateCount: 1,
          candidates: [
            {
              deviceLimit: null,
              displayName: 'vip_gamer',
              expiresAt: '2030-01-01T00:00:00.000Z',
              externalPanel: 'marzban',
              externalPanelConfigId: 'vip_gamer',
              externalPanelUserId: 'vip_gamer',
              label: 'vip_gamer',
              protocol: 'vless',
              quotaBytes: 26_843_545_600,
              reasonCodes: ['active_status', 'identity_detected', 'quota_detected', 'usage_detected'],
              remainingBytes: 20_400_000_000,
              status: 'active',
              usedBytes: 6_443_545_600,
              username: 'vip_gamer',
            },
          ],
          disabledCount: 0,
          expiredCount: 0,
          generatedAt: fixedNow,
          limitedCount: 0,
          panelKind: 'marzban',
          rejectedRows: [],
          sourceName: 'visual-export',
          totalQuotaBytes: 26_843_545_600,
          totalUsedBytes: 6_443_545_600,
          warnings: ['raw_panel_payload_not_persisted', 'read_only_preview_no_changes_applied'],
        });
        return;
      case '/api/admin/current-panels/import-configs':
        await fulfillJson(route, {
          adapterVersion: 'current-panel-import-preview-v1',
          baselineUsageEventCount: 1,
          baselineUsedBytes: 6_443_545_600,
          candidateCount: 1,
          customerAccountId: 'account-created',
          generatedAt: fixedNow,
          importedConfigs: [
            {
              createdAt: fixedNow,
              customerAccountId: 'account-created',
              deviceLimit: null,
              effectiveQuotaLimitBytes: 26_843_545_600,
              externalPanel: 'marzban',
              externalPanelConfigId: 'vip_gamer',
              externalPanelUserId: 'vip_gamer',
              id: 'client-imported',
              label: 'vip_gamer',
              notes: null,
              protocol: 'vless',
              quotaLimitBytes: 26_843_545_600,
              remainingBytes: 20_400_000_000,
              routePreference: null,
              status: 'active',
              updatedAt: fixedNow,
              usedBytes: 6_443_545_600,
            },
          ],
          importedCount: 1,
          panelKind: 'marzban',
          skippedCandidates: [],
          skippedCount: 0,
          warnings: ['baseline_usage_events_recorded', 'controlled_import_applied_to_client_configs', 'raw_panel_payload_not_persisted'],
        });
        return;
      case '/api/admin/current-panels/sync-usage':
        await fulfillJson(route, {
          adapterVersion: 'current-panel-import-preview-v1',
          candidateCount: 1,
          customerAccountId: 'account-created',
          generatedAt: fixedNow,
          matchedCount: 1,
          panelKind: 'marzban',
          skippedCandidates: [],
          skippedCount: 0,
          syncedCount: 1,
          syncedUsedBytesDelta: 1_073_741_824,
          updatedConfigs: [
            {
              createdAt: fixedNow,
              customerAccountId: 'account-created',
              deviceLimit: null,
              effectiveQuotaLimitBytes: 26_843_545_600,
              externalPanel: 'marzban',
              externalPanelConfigId: 'vip_gamer',
              externalPanelUserId: 'vip_gamer',
              id: 'client-imported',
              label: 'vip_gamer',
              notes: null,
              protocol: 'vless',
              quotaLimitBytes: 26_843_545_600,
              remainingBytes: 19_326_258_176,
              routePreference: null,
              status: 'active',
              updatedAt: fixedNow,
              usedBytes: 7_517_287_424,
            },
          ],
          usageEventCount: 1,
          warnings: ['controlled_usage_sync_applied_to_client_configs', 'raw_panel_payload_not_persisted', 'usage_sync_events_recorded'],
        });
        return;
      case '/api/admin/current-panels/charge-volume':
        await fulfillJson(route, {
          account: {
            activeClientCount: 1,
            clientCount: 1,
            createdAt: fixedNow,
            displayName: 'VIP gamer',
            hasPaidNumberHash: false,
            id: 'account-created',
            notes: null,
            perClientLimitBytes: 21_474_836_480,
            quotaLimitBytes: 91_268_055_040,
            quotaScope: 'per_client',
            remainingBytes: 83_750_767_616,
            status: 'active',
            telegramId: null,
            telegramUsername: 'vip_gamer',
            updatedAt: fixedNow,
            usedBytes: 7_517_287_424,
          },
          chargeEvent: {
            accountQuotaLimitAfterBytes: 91_268_055_040,
            accountQuotaLimitBeforeBytes: 85_899_345_920,
            clientConfigIds: [],
            clientQuotaChanges: [],
            createdAt: fixedNow,
            createdBy: 'admin-visual',
            customerAccountId: 'account-created',
            externalPanelWriteStatus: 'not_executed',
            id: 'charge-volume-visual',
            idempotencyKey: route.request().postDataJSON().idempotencyKey,
            metadata: {
              dashboardFlow: 'current_panel_charge_volume',
            },
            notes: null,
            scope: 'account_quota',
            volumeBytesDelta: 5_368_709_120,
          },
          duplicate: false,
          externalPanelWrite: {
            attempted: false,
            reasonCode: 'live_external_panel_write_not_enabled',
            status: 'not_executed',
          },
          updatedClients: [],
          warnings: ['external_panel_write_not_executed', 'local_quota_charge_recorded'],
        });
        return;
      case '/api/admin/customer-accounts/account-created/client-configs/export':
        await fulfillJson(route, {
          configCount: 1,
          configs: [
            {
              createdAt: fixedNow,
              customerAccountId: 'account-created',
              deviceLimit: null,
              effectiveQuotaLimitBytes: 26_843_545_600,
              externalPanel: 'marzban',
              externalPanelConfigId: 'vip_gamer',
              externalPanelUserId: 'vip_gamer',
              id: 'client-imported',
              label: 'vip_gamer',
              notes: null,
              protocol: 'vless',
              quotaLimitBytes: 26_843_545_600,
              remainingBytes: 19_326_258_176,
              routePreference: null,
              status: 'active',
              updatedAt: fixedNow,
              usedBytes: 7_517_287_424,
            },
          ],
          customerAccountId: 'account-created',
          exportFormat: 'afrogate_client_configs_export_v1',
          generatedAt: fixedNow,
          warnings: ['sanitized_config_export_no_secrets', 'subscription_credentials_not_included', 'raw_panel_payload_not_included'],
        });
        return;
      case '/api/admin/rewarded-ads/settings':
        await fulfillJson(route, {
          rewardedAds: {
            createdAt: fixedNow,
            dailyLimit: 20,
            enabled: true,
            provider: 'mvp_rewarded_ad',
            rewardBytes: route.request().method() === 'PATCH' ? 157_286_400 : 104_857_600,
            rewardMb: route.request().method() === 'PATCH' ? 150 : 100,
            settingKey: 'default',
            updatedAt: fixedNow,
            updatedBy: 'admin-visual',
            verificationMode: 'client_callback_mvp',
          },
        });
        return;
      default:
        await fulfillJson(route, { error: `Unmocked visual API route: ${url.pathname}` }, 404);
    }
  });
}

function resellerWorkspaceResponse() {
  return {
    accounts: [
      {
        activeClientCount: 1,
        clientCount: 1,
        createdAt: fixedNow,
        displayName: 'Reseller gaming customer',
        hasPaidNumberHash: false,
        id: 'reseller-customer-visual',
        notes: null,
        perClientLimitBytes: 10_737_418_240,
        quotaLimitBytes: 53_687_091_200,
        quotaScope: 'account_shared',
        remainingBytes: 48_318_382_080,
        resellerAccountId: 'reseller-visual',
        resellerDisplayName: 'Mobile Shop Tehran',
        status: 'active',
        telegramId: null,
        telegramUsername: 'reseller_player',
        updatedAt: fixedNow,
        usedBytes: 5_368_709_120,
      },
    ],
    generatedAt: fixedNow,
    ledgerEntries: [
      {
        amount: 5_000_000,
        balanceAfterAmount: 5_000_000,
        balanceBeforeAmount: 0,
        createdAt: fixedNow,
        createdBy: 'superadmin',
        currency: 'IRR',
        entryType: 'topup',
        id: 'ledger-topup-visual',
        idempotencyKey: 'visual-topup',
        metadata: {},
        notes: 'Cash deposit',
        resellerAccountId: 'reseller-visual',
        source: 'manual_topup',
        sourceId: null,
        volumePackageId: null,
        volumePackageName: null,
      },
      {
        amount: -1_000_000,
        balanceAfterAmount: 4_000_000,
        balanceBeforeAmount: 5_000_000,
        createdAt: fixedNow,
        createdBy: 'admin-reseller-visual',
        currency: 'IRR',
        customerAccountId: 'reseller-customer-visual',
        customerDisplayName: 'Reseller gaming customer',
        entryType: 'sale_debit',
        id: 'ledger-sale-visual',
        idempotencyKey: 'visual-sale',
        metadata: {},
        notes: null,
        resellerAccountId: 'reseller-visual',
        source: 'client_sale',
        sourceId: 'reseller-order-visual',
        volumePackageId: 'reseller-package-starter',
        volumePackageName: 'Starter 25GB',
      },
    ],
    packages: [
      {
        createdAt: fixedNow,
        currency: 'IRR',
        durationDays: 30,
        id: 'reseller-package-starter',
        name: 'Starter 25GB',
        notes: null,
        pricePerGb: 40_000,
        slug: 'starter-25gb',
        sortOrder: 1,
        status: 'active',
        totalPrice: 1_000_000,
        updatedAt: fixedNow,
        volumeBytes: 26_843_545_600,
        volumeGb: 25,
      },
    ],
    paymentOrders: [
      {
        allocationDelaySeconds: 0,
        allocationId: 'reseller-allocation-visual',
        allocationStatus: 'allocated',
        allocatedAt: fixedNow,
        allocatedVolumeBytes: 26_843_545_600,
        amount: 1_000_000,
        createdAt: fixedNow,
        currency: 'IRR',
        customerAccountId: 'reseller-customer-visual',
        customerDisplayName: 'Reseller gaming customer',
        customerTelegramUsername: 'reseller_player',
        durationDays: 30,
        expiresAt: null,
        failedAt: null,
        id: 'reseller-order-visual',
        idempotencyKey: 'reseller-order-visual',
        metadata: {},
        notes: null,
        packageName: 'Starter 25GB',
        packageSlug: 'starter-25gb',
        paidAt: fixedNow,
        paymentMethodId: null,
        paymentMethodName: 'Reseller wallet',
        paymentMethodSlug: 'reseller_wallet',
        pricePerGb: 40_000,
        provider: 'reseller_wallet',
        providerCaptureId: null,
        providerOrderId: null,
        refundedAt: null,
        status: 'paid',
        updatedAt: fixedNow,
        volumeBytes: 26_843_545_600,
        volumeGb: 25,
        volumePackageId: 'reseller-package-starter',
      },
    ],
    reseller: {
      activeCustomerAccountCount: 1,
      adminUserId: 'admin-reseller-visual',
      afroGateShareBps: 7500,
      afroGateSharePercent: 75,
      availableBalanceAmount: 4_000_000,
      balanceAmount: 4_000_000,
      contactName: 'Tehran Shop Owner',
      createdAt: fixedNow,
      createdBy: 'superadmin',
      creditLimitAmount: 0,
      currency: 'IRR',
      customerAccountCount: 1,
      displayName: 'Mobile Shop Tehran',
      id: 'reseller-visual',
      ledgerEntryCount: 2,
      notes: null,
      sellerMarginBps: 2500,
      sellerMarginPercent: 25,
      status: 'active',
      telegramUsername: 'tehran_shop',
      updatedAt: fixedNow,
      updatedBy: 'superadmin',
    },
    settings: {
      createdAt: fixedNow,
      currency: 'IRR',
      pricePerGb: 40_000,
      settingKey: 'default',
      updatedAt: fixedNow,
      updatedBy: 'superadmin',
    },
  };
}

function resellerPackageSaleResponse(payload: {
  customerAccount?: {
    displayName?: string | null;
    notes?: string | null;
    telegramUsername?: string | null;
  } | null;
  volumePackageId: string;
}) {
  const customerDisplayName = payload.customerAccount?.displayName ?? 'Wallet sale customer';
  const customerTelegramUsername = payload.customerAccount?.telegramUsername ?? 'wallet_customer';

  return {
    allocation: {
      allocationScope: 'account_quota',
      createdAt: fixedNow,
      createdBy: 'admin-reseller-visual',
      customerAccountId: 'reseller-sale-customer-created',
      id: 'reseller-sale-allocation-created',
      idempotencyKey: 'reseller-sale-allocation',
      metadata: {},
      paymentOrderId: 'reseller-sale-order-created',
      quotaLimitAfterBytes: 26_843_545_600,
      quotaLimitBeforeBytes: null,
      volumeBytesDelta: 26_843_545_600,
    },
    customerAccount: {
      activeClientCount: 0,
      clientConfigs: [],
      clientCount: 0,
      createdAt: fixedNow,
      displayName: customerDisplayName,
      hasPaidNumberHash: false,
      id: 'reseller-sale-customer-created',
      notes: payload.customerAccount?.notes ?? null,
      perClientLimitBytes: null,
      quotaLimitBytes: 26_843_545_600,
      quotaScope: 'account_shared',
      remainingBytes: 26_843_545_600,
      resellerAccountId: 'reseller-visual',
      resellerDisplayName: 'Mobile Shop Tehran',
      status: 'active',
      telegramId: null,
      telegramUsername: customerTelegramUsername,
      updatedAt: fixedNow,
      usedBytes: 0,
    },
    duplicate: false,
    ledgerEntry: {
      amount: -750_000,
      balanceAfterAmount: 3_250_000,
      balanceBeforeAmount: 4_000_000,
      createdAt: fixedNow,
      createdBy: 'admin-reseller-visual',
      currency: 'IRR',
      customerAccountId: 'reseller-sale-customer-created',
      customerDisplayName,
      entryType: 'sale_debit',
      id: 'reseller-sale-ledger-created',
      idempotencyKey: 'reseller-sale',
      metadata: {},
      notes: null,
      resellerAccountId: 'reseller-visual',
      source: 'client_sale',
      sourceId: 'reseller-sale-order-created',
      volumePackageId: payload.volumePackageId,
      volumePackageName: 'Starter 25GB',
    },
    paymentOrder: {
      allocationDelaySeconds: 0,
      allocationId: 'reseller-sale-allocation-created',
      allocationStatus: 'allocated',
      allocatedAt: fixedNow,
      allocatedVolumeBytes: 26_843_545_600,
      amount: 1_000_000,
      createdAt: fixedNow,
      currency: 'IRR',
      customerAccountId: 'reseller-sale-customer-created',
      customerDisplayName,
      customerTelegramUsername,
      durationDays: 30,
      expiresAt: null,
      failedAt: null,
      id: 'reseller-sale-order-created',
      idempotencyKey: 'reseller-sale-order',
      metadata: {},
      notes: null,
      packageName: 'Starter 25GB',
      packageSlug: 'starter-25gb',
      paidAt: fixedNow,
      paymentMethodId: null,
      paymentMethodName: 'Reseller wallet',
      paymentMethodSlug: 'reseller_wallet',
      pricePerGb: 40_000,
      provider: 'reseller_wallet',
      providerCaptureId: null,
      providerOrderId: 'reseller-sale-provider-order',
      refundedAt: null,
      status: 'paid',
      updatedAt: fixedNow,
      volumeBytes: 26_843_545_600,
      volumeGb: 25,
      volumePackageId: payload.volumePackageId,
    },
    quote: {
      balanceAfterAmount: 3_250_000,
      balanceBeforeAmount: 4_000_000,
      blockedReason: null,
      canDebit: true,
      creditLimitAmount: 0,
      currency: 'IRR',
      customerPriceAmount: 1_000_000,
      packageName: 'Starter 25GB',
      resellerAccountId: 'reseller-visual',
      sellerMarginAmount: 250_000,
      sellerMarginBps: 2500,
      volumePackageId: payload.volumePackageId,
      walletDebitAmount: 750_000,
    },
    reseller: {
      activeCustomerAccountCount: 2,
      adminUserId: 'admin-reseller-visual',
      afroGateShareBps: 7500,
      afroGateSharePercent: 75,
      availableBalanceAmount: 3_250_000,
      balanceAmount: 3_250_000,
      contactName: 'Tehran Shop Owner',
      createdAt: fixedNow,
      createdBy: 'superadmin',
      creditLimitAmount: 0,
      currency: 'IRR',
      customerAccountCount: 2,
      displayName: 'Mobile Shop Tehran',
      id: 'reseller-visual',
      ledgerEntryCount: 3,
      notes: null,
      sellerMarginBps: 2500,
      sellerMarginPercent: 25,
      status: 'active',
      telegramUsername: 'tehran_shop',
      updatedAt: fixedNow,
      updatedBy: 'admin-reseller-visual',
    },
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  });
}

function createMetricSnapshot(
  serverId: string,
  hostname: string,
  platform: string,
  cpuPercent: number,
  ramPercent: number,
  diskFreePercent: number,
  healthScore: number,
  inboundBps: number,
  outboundBps: number,
) {
  return {
    cpuPercent,
    diskFreePercent,
    healthScore,
    hostname,
    inboundBps,
    jitterMs: 8 + Math.round(cpuPercent / 12),
    networkInterfaces: [
      {
        name: 'eth0',
        rxBps: inboundBps,
        rxBytes: 912_000_000,
        txBps: outboundBps,
        txBytes: 436_000_000,
      },
    ],
    observedAt: fixedNow,
    outboundBps,
    packetLossPercent: diskFreePercent < 10 ? 1.2 : 0.2,
    pingMs: 38 + Math.round(cpuPercent / 8),
    platform,
    ramPercent,
    routeProbes: [],
    serverId,
    storages: [
      {
        device: '/dev/sda1',
        filesystem: 'ext4',
        freeBytes: 60_000_000_000,
        freePercent: diskFreePercent,
        path: '/',
        totalBytes: 300_000_000_000,
        usedPercent: 100 - diskFreePercent,
      },
    ],
    wireGuardInterfaces: [],
  };
}

function createTimeseries(snapshot: ReturnType<typeof createMetricSnapshot>) {
  const start = Date.parse(fixedNow);

  return {
    hostname: snapshot.hostname,
    platform: snapshot.platform,
    points: Array.from({ length: 12 }, (_, index) => ({
      cpuPercent: Math.min(95, snapshot.cpuPercent + ((index % 3) - 1) * 3),
      diskFreePercent: snapshot.diskFreePercent,
      healthScore: Math.max(25, Math.min(98, snapshot.healthScore + ((index % 4) - 1) * 2)),
      inboundBps: snapshot.inboundBps,
      jitterMs: snapshot.jitterMs,
      observedAt: new Date(start - (11 - index) * 300_000).toISOString(),
      outboundBps: snapshot.outboundBps,
      packetLossPercent: snapshot.packetLossPercent,
      pingMs: snapshot.pingMs,
      ramPercent: Math.min(95, snapshot.ramPercent + (index % 2) * 2),
    })),
    serverId: snapshot.serverId,
  };
}

function openAlertRows() {
  return [
    {
      firstSeenAt: fixedNow,
      id: 'alert-storage-critical',
      lastSeenAt: fixedNow,
      message: 'Storage is below the critical guard on teh-gateway-03.',
      severity: 'critical',
      sourceId: 'server-teh',
      sourceLabel: 'teh-gateway-03',
      sourceType: 'server',
      status: 'open',
      title: 'Storage below 10%',
    },
    {
      firstSeenAt: fixedNow,
      id: 'alert-health-warning',
      lastSeenAt: fixedNow,
      message: 'The Dubai relay has elevated jitter and should stay under watch.',
      severity: 'warning',
      sourceId: 'server-dxb',
      sourceLabel: 'dxb-relay-02',
      sourceType: 'server',
      status: 'open',
      title: 'Health score degraded',
    },
  ];
}

function resolvedAlertRows() {
  return [
    {
      firstSeenAt: '2026-05-28T06:10:00.000Z',
      id: 'alert-resolved-storage',
      lastSeenAt: '2026-05-28T06:40:00.000Z',
      message: 'The storage reserve recovered after cleanup.',
      resolvedAt: '2026-05-28T06:45:00.000Z',
      severity: 'critical',
      sourceId: 'server-teh',
      sourceLabel: 'teh-gateway-03',
      sourceType: 'server',
      status: 'resolved',
      title: 'Resolved storage guard',
    },
    {
      firstSeenAt: '2026-05-28T05:10:00.000Z',
      id: 'alert-resolved-jitter',
      lastSeenAt: '2026-05-28T05:35:00.000Z',
      message: 'Jitter returned below the warning threshold.',
      resolvedAt: '2026-05-28T05:38:00.000Z',
      severity: 'warning',
      sourceId: 'server-dxb',
      sourceLabel: 'dxb-relay-02',
      sourceType: 'server',
      status: 'resolved',
      title: 'Resolved tunnel jitter',
    },
  ];
}

function incidentTimelineResponse() {
  return {
    events: [
      {
        actorId: 'admin-visual',
        detail: 'Frankfurt WG gaming -> Dubai WG standby / packetLossHigh',
        id: 'route-decision:visual-assignment',
        kind: 'route_assignment',
        metadata: {
          assignmentKey: 'default',
          decisionKind: 'assignment_apply',
          reasonCodes: 'packetLossHigh, stickySessionProtected',
        },
        occurredAt: '2026-05-28T07:58:00.000Z',
        outboundName: 'Dubai WG standby',
        routeGroup: 'main',
        severity: 'warning',
        sourceId: 'default',
        sourceLabel: 'main',
        sourceType: 'route_decision',
        status: 'switchRecommended',
        title: 'Route assignment applied',
      },
      {
        detail: 'Storage is below the critical guard on teh-gateway-03.',
        id: 'alert-storage-critical:opened',
        kind: 'alert_opened',
        metadata: {
          alertId: 'alert-storage-critical',
          sourceType: 'server',
        },
        occurredAt: '2026-05-28T07:50:00.000Z',
        severity: 'critical',
        sourceId: 'server-teh',
        sourceLabel: 'teh-gateway-03',
        sourceType: 'server',
        status: 'open',
        title: 'Storage below 10%',
      },
    ],
    generatedAt: fixedNow,
    rangeHours: 24,
  };
}

function auditLogRows() {
  return [
    {
      action: 'admin.login.succeeded',
      actorId: 'admin-visual',
      actorType: 'admin',
      createdAt: fixedNow,
      id: 'audit-login',
      metadata: {
        ipAddress: '127.0.0.1',
        sessionToken: '[redacted]',
      },
      targetId: 'admin-visual',
      targetType: 'admin_session',
    },
    {
      action: 'payment_order.created',
      actorId: 'admin-visual',
      actorType: 'admin',
      createdAt: '2026-05-28T07:45:00.000Z',
      id: 'audit-order',
      metadata: {
        amount: 25,
        provider: 'paypal',
      },
      targetId: 'order-visual',
      targetType: 'payment_order',
    },
  ];
}

function backupStatusRow() {
  return {
    artifacts: ['postgres', 'config', 'secrets'],
    destinationLabel: 's3://afrogate-prod/daily',
    destinationType: 's3',
    durationSeconds: 42,
    encrypted: true,
    encryptionRequired: true,
    issues: [],
    latestBackupAgeHours: 2,
    latestBackupAt: fixedNow,
    latestFailedBackupAt: null,
    latestJobStatus: 'succeeded',
    latestSuccessfulBackupAt: fixedNow,
    maxBackupAgeHours: 30,
    monitoringEnabled: true,
    restoreTestAgeDays: 4,
    restoreTestMaxAgeDays: 30,
    restoreTestedAt: '2026-05-24T08:00:00.000Z',
    retention: {
      dailyDays: 7,
      monthlyMonths: 3,
      weeklyWeeks: 4,
    },
    sizeBytes: 8_388_608,
    status: 'healthy',
    statusFileConfigured: true,
    statusFileReadable: true,
    statusFileUpdatedAt: fixedNow,
    updatedAt: fixedNow,
  };
}

function backupRestorePlanRow() {
  return {
    backupStatus: 'healthy',
    blockerReasonCodes: [],
    canExecuteRestore: false,
    checks: [
      { blocksRestore: true, code: 'monitoring_evidence', id: 'monitoring-evidence', reasonCodes: [], status: 'passed' },
      { blocksRestore: true, code: 'latest_backup_freshness', id: 'backup-freshness', reasonCodes: [], status: 'passed' },
      { blocksRestore: true, code: 'encrypted_backup', id: 'backup-encryption', reasonCodes: [], status: 'passed' },
      { blocksRestore: true, code: 'artifact_coverage', id: 'artifact-coverage', reasonCodes: [], status: 'passed' },
      { blocksRestore: false, code: 'restore_test_evidence', id: 'restore-test', reasonCodes: [], status: 'passed' },
      { blocksRestore: true, code: 'restore_execution_engine', id: 'restore-engine', reasonCodes: ['restore_execution_not_implemented'], status: 'future' },
    ],
    executionEnabled: false,
    executionStatus: 'disabled',
    generatedAt: fixedNow,
    latestSuccessfulBackupAt: fixedNow,
    readinessStatus: 'ready',
    reasonCodes: ['backup_evidence_ready', 'restore_execution_not_implemented', 'restore_plan_read_only'],
    restoreTestedAt: '2026-05-24T08:00:00.000Z',
    safetyNotes: ['restore_is_manual_runbook', 'pre_restore_snapshot_required', 'audit_record_required'],
    steps: [
      { code: 'verify_backup_evidence', destructive: false, executionEnabled: false, id: 'verify-evidence', kind: 'verify', order: 1, reasonCodes: ['manual_operator_required'], requiresOfflineWindow: false },
      { code: 'create_pre_restore_snapshot', destructive: false, executionEnabled: false, id: 'pre-restore-snapshot', kind: 'snapshot', order: 2, reasonCodes: ['pre_restore_snapshot_required'], requiresOfflineWindow: false },
      { code: 'open_maintenance_window', destructive: false, executionEnabled: false, id: 'maintenance-window', kind: 'maintenance', order: 3, reasonCodes: ['manual_operator_required'], requiresOfflineWindow: true },
      { code: 'restore_postgresql_dump', destructive: true, executionEnabled: false, id: 'restore-postgres', kind: 'database', order: 4, reasonCodes: ['manual_operator_required'], requiresOfflineWindow: true },
    ],
    targetArtifacts: ['postgres', 'config', 'secrets'],
    warningReasonCodes: [],
  };
}

function tenantBrandingRow(patch: Partial<{
  accentColor: string;
  clientAppTitle: string;
  clientSupportMessage: string | null;
  dashboardTitle: string;
  displayName: string;
  legalName: string | null;
  logoUrl: string | null;
  primaryColor: string;
  publicBrandingEnabled: boolean;
  supportEmail: string | null;
  supportTelegram: string | null;
  supportUrl: string | null;
  tenantSlug: string;
}> = {}) {
  return {
    accentColor: patch.accentColor ?? '#0E9F8F',
    clientAppTitle: patch.clientAppTitle ?? 'AfroGate Mobile',
    clientSupportMessage: patch.clientSupportMessage ?? 'Message support for route issues.',
    createdAt: fixedNow,
    dashboardTitle: patch.dashboardTitle ?? 'AfroGate Ops',
    displayName: patch.displayName ?? 'AfroGate Pro',
    legalName: patch.legalName ?? 'AfroGate Labs',
    logoUrl: patch.logoUrl ?? null,
    primaryColor: patch.primaryColor ?? '#176B87',
    publicBrandingEnabled: patch.publicBrandingEnabled ?? true,
    settingKey: 'default',
    supportEmail: patch.supportEmail ?? 'support@example.com',
    supportTelegram: patch.supportTelegram ?? '@afrogate_support',
    supportUrl: patch.supportUrl ?? 'https://example.com/support',
    tenantSlug: patch.tenantSlug ?? 'default',
    updatedAt: fixedNow,
    updatedBy: 'admin-visual',
  };
}

function reportsSummaryRow() {
  return {
    alerts: {
      critical: 0,
      open: 2,
      warning: 2,
    },
    backups: {
      criticalIssueCount: 0,
      issueCount: 0,
      latestSuccessfulBackupAt: fixedNow,
      restoreTestedAt: '2026-05-24T08:00:00.000Z',
      status: 'healthy',
      warningIssueCount: 0,
    },
    generatedAt: fixedNow,
    outbounds: {
      critical: 0,
      degraded: 1,
      disabled: 0,
      healthy: 2,
      maintenance: 0,
      total: 3,
    },
    rangeHours: 168,
    reasonCodes: ['warning_alerts_open', 'upcoming_degraded_route_windows'],
    riskLevel: 'watch',
    riskScore: 22,
    routeQuality: {
      bestWindowCount: 1,
      degradedWindowCount: 0,
      insufficientData: false,
      rangeHours: 168,
      recommendationCount: 2,
      routeGroup: 'main',
      topRecommendations: [
        {
          averageScore: 91,
          confidence: 'high',
          hourOfDay: 6,
          kind: 'bestWindow',
          operator: 'Irancell',
          outboundName: 'Frankfurt WG gaming',
          protocol: 'udp',
          reason: 'Best synthetic route window.',
          routeGroup: 'main',
          sampleCount: 18,
          scoreProfile: 'gaming',
        },
        {
          averageScore: 61,
          confidence: 'medium',
          hourOfDay: 18,
          kind: 'upcomingDegradedWindow',
          operator: 'Irancell',
          outboundName: 'Dubai WG standby',
          protocol: 'udp',
          reason: 'Upcoming degraded synthetic route window.',
          routeGroup: 'main',
          sampleCount: 14,
          scoreProfile: 'gaming',
          startsInMinutes: 45,
        },
      ],
      upcomingDegradedWindowCount: 1,
      windowCount: 12,
    },
    servers: {
      critical: 0,
      degraded: 1,
      healthy: 2,
      total: 3,
      unknown: 0,
    },
  };
}

function createPaymentProviderAdapter(
  provider: string,
  checkoutMode: string,
  settlementMode: string,
  status: string,
  supportsWebhookVerification: boolean,
) {
  return {
    checkoutMode,
    provider,
    publicConfigKeys: [],
    requiresSecretRef: provider === 'paypal' || provider === 'card' || provider === 'local_gateway',
    safetyNotes: [],
    settlementMode,
    status,
    supportsHostedCheckout: checkoutMode !== 'manual',
    supportsPaymentReference: true,
    supportsWebhookVerification,
  };
}

function createOutbound(id: string, serverId: string, serverHostname: string, name: string, routeGroup: string, priority: number, healthStatus: string) {
  return {
    config: {},
    cooldownSeconds: 30,
    createdAt: fixedNow,
    enabled: true,
    failThreshold: 3,
    hasSecretRef: true,
    healthIntervalSeconds: 30,
    healthStatus,
    id,
    lastCheckedAt: fixedNow,
    lastHealthyAt: healthStatus === 'healthy' ? fixedNow : null,
    maintenanceMode: false,
    maxUsers: 500,
    name,
    priority,
    recoveryThreshold: 2,
    routeGroup,
    serverExternalId: serverId,
    serverHostname,
    serverId,
    type: 'wireguard',
    updatedAt: fixedNow,
    usageMultiplier: routeGroup === 'gaming' ? 2 : 1,
    weight: Math.max(10, 100 - priority * 20),
  };
}

function createTunnel(id: string, serverId: string, serverHostname: string, name: string, status: string, routeGroup: string) {
  return {
    createdAt: fixedNow,
    id,
    interfaceName: 'wg0',
    interfaceOperator: 'irancell',
    localInterfaceId: `${id}-iface`,
    localInterfaceName: 'wg0',
    lockable: true,
    name,
    remoteEndpoint: `${serverHostname}.example:51820`,
    routeGroup,
    serverExternalId: serverId,
    serverHostname,
    serverId,
    status,
    type: 'wireguard',
    updatedAt: fixedNow,
  };
}

function routeHealthHistoryResponse() {
  return {
    generatedAt: fixedNow,
    points: [
      {
        averageJitterMs: 5,
        averageLatencyMs: 42,
        averagePacketLossPercent: 0.08,
        averageScore: 94,
        bucketStart: '2026-05-28T07:00:00.000Z',
        criticalSamplePercent: 0,
        degradedSamplePercent: 0,
        healthStatus: 'healthy',
        operator: 'irancell',
        outboundId: 'outbound-fra-wg',
        outboundKey: 'outbound-fra-wg',
        outboundName: 'Frankfurt WG gaming',
        protocol: 'udp',
        routeGroup: 'main',
        sampleCount: 18,
        scoreProfile: 'gaming',
        serverExternalId: 'server-fra',
        serverHostname: 'fra-edge-01',
      },
      {
        averageJitterMs: 28,
        averageLatencyMs: 89,
        averagePacketLossPercent: 1.4,
        averageScore: 58,
        bucketStart: '2026-05-28T06:00:00.000Z',
        criticalSamplePercent: 12,
        degradedSamplePercent: 48,
        healthStatus: 'degraded',
        operator: 'irancell',
        outboundId: 'outbound-dxb-wg',
        outboundKey: 'outbound-dxb-wg',
        outboundName: 'Dubai WG standby',
        protocol: 'udp',
        routeGroup: 'main',
        sampleCount: 16,
        scoreProfile: 'gaming',
        serverExternalId: 'server-dxb',
        serverHostname: 'dxb-relay-02',
      },
    ],
    rangeHours: 168,
    routeGroup: 'main',
  };
}

function routeCanaryStatusResponse() {
  return {
    action: 'switchRecommended',
    assignmentKey: 'default',
    assignmentOnly: true,
    autoRouteEnabled: true,
    canExecuteDataPlane: false,
    canaryReady: false,
    cooldownActive: false,
    cooldownUntil: null,
    currentCandidate: {
      healthStatus: 'healthy',
      id: 'outbound-fra-wg',
      jitterMs: 5,
      latencyMs: 42,
      loadedLatencyDeltaMs: 8,
      loadedLatencyMs: 50,
      loadPercent: 38,
      name: 'Frankfurt WG gaming',
      packetLossPercent: 0.08,
      routeGroup: 'main',
      score: 81,
      selectedScoreProfile: 'gaming',
      serverCountry: 'DE',
      serverRegion: 'Frankfurt',
      source: 'outbound',
    },
    dataPlaneReady: false,
    generatedAt: fixedNow,
    guardReady: true,
    mode: 'automatic',
    reasonCodes: ['score_delta_meets_hysteresis', 'dataPlaneDisabled', 'guardPassed', 'assignmentOnly', 'newSessionsOnly'],
    recommendedAction: 'recordDecision',
    recommendedCandidate: {
      healthStatus: 'healthy',
      id: 'outbound-dxb-wg',
      jitterMs: 7,
      latencyMs: 48,
      loadedLatencyDeltaMs: 9,
      loadedLatencyMs: 57,
      loadPercent: 31,
      name: 'Dubai WG standby',
      packetLossPercent: 0.05,
      routeGroup: 'main',
      score: 96,
      selectedScoreProfile: 'gaming',
      serverCountry: 'AE',
      serverRegion: 'Dubai',
      source: 'outbound',
    },
    routeGroup: 'main',
    routeLocked: false,
    selectedScoreProfile: 'gaming',
    switchOrchestration: {
      activeSessionsMayMove: false,
      activeSessionsProtected: true,
      assignmentOnly: true,
      canExecuteDataPlane: false,
      canaryPercent: 5,
      cooldownActive: false,
      dataPlaneReady: false,
      generatedAt: fixedNow,
      holdSecondsRemaining: 600,
      nextPercent: 0,
      phase: 'assignment',
      preserveExistingSessions: true,
      reasonCodes: ['assignmentOnly', 'dataPlaneDisabled', 'guardPassed', 'stickySessions', 'newSessionsOnly', 'canaryRequired', 'gamingSensitive', 'auditRequired'],
      recommendedAction: 'recordDecision',
      rollbackRequired: false,
      routeLocked: false,
      stageCount: 4,
      stages: [
        {
          code: 'guard_route_locks_cooldown_and_health',
          dataPlaneMutation: false,
          estimatedSeconds: 1,
          id: 'orchestrate-guard-route-gates',
          phase: 'guard',
          reasonCodes: ['guardPassed'],
          sessionImpact: 'none',
          status: 'ready',
          targetOutboundId: 'outbound-dxb-wg',
          targetPercent: 0,
          trafficScope: 'none',
        },
        {
          code: 'record_control_plane_assignment',
          dataPlaneMutation: false,
          estimatedSeconds: 1,
          id: 'orchestrate-record-assignment',
          phase: 'assignment',
          reasonCodes: ['assignmentOnly', 'auditRequired'],
          sessionImpact: 'none',
          status: 'ready',
          targetOutboundId: 'outbound-dxb-wg',
          targetPercent: 100,
          trafficScope: 'controlPlane',
        },
        {
          code: 'pin_existing_active_sessions',
          dataPlaneMutation: true,
          estimatedSeconds: 1,
          id: 'orchestrate-pin-existing',
          phase: 'pinExisting',
          reasonCodes: ['stickySessions'],
          sessionImpact: 'existingSessions',
          status: 'future',
          targetOutboundId: 'outbound-fra-wg',
          targetPercent: 0,
          trafficScope: 'newSessions',
        },
        {
          code: 'canary_new_sessions_only',
          dataPlaneMutation: true,
          estimatedSeconds: 600,
          id: 'orchestrate-canary-new-sessions',
          phase: 'canary',
          reasonCodes: ['canaryRequired', 'newSessionsOnly'],
          sessionImpact: 'newSessionsOnly',
          status: 'future',
          targetOutboundId: 'outbound-dxb-wg',
          targetPercent: 5,
          trafficScope: 'canary',
        },
      ],
      status: 'assignmentOnly',
      switchNewSessionsOnly: true,
    },
    switchRollout: {
      automaticExpansion: false,
      canaryDurationSeconds: 600,
      dataPlaneReady: false,
      existingSessionsPinned: true,
      initialPercent: 5,
      maxPercent: 100,
      newSessionsCanary: true,
      reasonCodes: ['dataPlaneDisabled', 'stickySessions', 'newSessionsOnly', 'canaryRequired', 'gamingSensitive', 'assignmentOnly', 'rollbackGuard', 'healthVerifyRequired'],
      rollbackOnJitterMs: 15,
      rollbackOnLatencyMs: 80,
      rollbackOnLossPercent: 1,
      routeConsistencyHoldSeconds: 600,
      status: 'planningOnly',
      steps: [
        {
          code: 'persist_control_plane_assignment',
          dataPlaneMutation: false,
          durationSeconds: 1,
          id: 'persist-control-plane-assignment',
          phase: 'assignment',
          reasonCodes: ['assignmentOnly'],
          status: 'ready',
          targetPercent: 100,
          trafficScope: 'controlPlane',
        },
        {
          code: 'pin_existing_sessions_for_rollout',
          dataPlaneMutation: true,
          durationSeconds: 600,
          id: 'pin-existing-sessions-for-rollout',
          phase: 'pinExisting',
          reasonCodes: ['stickySessions', 'routeConsistencyHold'],
          status: 'future',
          targetPercent: 0,
          trafficScope: 'newSessions',
        },
        {
          code: 'canary_new_sessions',
          dataPlaneMutation: true,
          durationSeconds: 600,
          id: 'canary-new-sessions',
          phase: 'canary',
          reasonCodes: ['canaryRequired', 'newSessionsOnly'],
          status: 'future',
          targetPercent: 5,
          trafficScope: 'canary',
        },
      ],
      strategy: 'assignmentOnly',
    },
    switchRolloutEvaluation: {
      canaryPercent: 5,
      dataPlaneReady: false,
      evaluatedAt: fixedNow,
      guardPassed: true,
      holdSecondsRemaining: 600,
      maxPercent: 100,
      nextPercent: 0,
      observedJitterMs: 7,
      observedLatencyMs: 48,
      observedLossPercent: 0.05,
      observedScore: 96,
      reasonCodes: ['dataPlaneDisabled', 'routeConsistencyHold', 'gamingSensitive', 'guardPassed'],
      recommendedAction: 'hold',
      routeConsistencyHoldActive: true,
      status: 'planningOnly',
    },
  };
}
