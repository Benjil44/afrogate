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

      await mockDashboardApi(page);
      await page.setViewportSize(viewport.size);
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
          alerts: [
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
          ],
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
