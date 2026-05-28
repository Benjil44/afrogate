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

test('alerts page filters open and resolved history rows', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });
  await page.locator('[data-view="alerts"]').click();

  await expect(page.getByRole('heading', { name: 'Open Alerts' })).toBeVisible();
  await expect(page.getByText('Storage below 10%')).toBeVisible();

  await page.getByRole('button', { name: 'Resolved' }).click();
  await expect(page.getByRole('heading', { name: 'Alert History' })).toBeVisible();
  await expect(page.getByText('Resolved storage guard')).toBeVisible();
  await expect(page.getByText('Resolved tunnel jitter')).toBeVisible();

  await page.getByLabel('Severity').selectOption('critical');
  await expect(page.getByText('Resolved storage guard')).toBeVisible();
  await expect(page.getByText('Resolved tunnel jitter')).toHaveCount(0);

  await page.getByLabel('Source').selectOption('teh-gateway-03');
  await expect(page.getByText('Resolved storage guard')).toBeVisible();
});

test('billing page shows catalog and saves reward settings', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });
  await page.locator('[data-view="billing"]').click();

  await expect(page.getByRole('heading', { name: 'Usage and billing' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reward Settings' })).toBeVisible();
  await expect(page.getByText('starter-25gb')).toBeVisible();

  await page.getByLabel('Reward MB').fill('150');
  await page.getByRole('button', { name: 'Save reward settings' }).click();
  await expect(page.getByText('Reward settings saved.')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Customer limit manager' })).toBeVisible();
  await page.getByLabel('Display name').fill('VIP gamer');
  await page.getByLabel('Telegram username').fill('vip_gamer');
  await page.getByLabel('Account quota GB').fill('80');
  await page.getByLabel('Per-client cap GB').fill('20');
  await page.getByLabel('Quota scope', { exact: true }).selectOption('per_client');
  await page.getByRole('button', { name: 'Create customer' }).click();
  await expect(page.getByText('Customer account saved.')).toBeVisible();
  await expect(page.getByRole('cell', { name: /VIP gamer/ })).toBeVisible();
});

test('audit logs page shows sanitized audit events', async ({ page }) => {
  await loadSignedInDashboard(page, { width: 1440, height: 900 });
  await page.locator('[data-view="audit"]').click();

  await expect(page.getByRole('heading', { name: 'Audit logs' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Audit events' })).toBeVisible();
  await expect(page.getByText('admin.login.succeeded')).toBeVisible();
  await expect(page.getByText('[redacted]')).toBeVisible();
});

async function loadSignedInDashboard(page: Page, size: { width: number; height: number }): Promise<void> {
  await mockDashboardApi(page);
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

async function mockDashboardApi(page: Page): Promise<void> {
  await page.route('http://127.0.0.1:7000/api/**', async (route) => {
    const url = new URL(route.request().url());

    switch (url.pathname) {
      case '/api/admin/session':
        await fulfillJson(route, {
          actor: {
            id: 'admin-visual',
            isSuperAdmin: true,
            role: 'superadmin',
            type: 'admin',
            username: 'superadmin',
          },
          expiresAt: '2026-05-28T12:00:00.000Z',
          issuedAt: fixedNow,
          mfaReady: true,
          mfaRequired: false,
        });
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
      case '/api/admin/audit-logs':
        await fulfillJson(route, {
          auditLogs: auditLogRows(),
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
