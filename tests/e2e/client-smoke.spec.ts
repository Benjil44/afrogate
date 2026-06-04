import { expect, test } from '@playwright/test';

test('client app renders on the fixed local client port', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4100');

  await expect(page).toHaveTitle(/Afrows Client/);
  await expect(page.locator('#root')).toBeVisible();

  await page.waitForFunction(() => {
    const root = document.querySelector('#root');
    return Boolean(root && root.childElementCount > 0);
  });

  await expect(page.getByLabel('Client token')).toBeVisible();

  const horizontalOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test('client app shows local per-app VPN split tunneling profile', async ({ page }) => {
  const routePreference = {
    routeGroup: 'main',
    assignmentKey: 'client_config:11111111-1111-1111-1111-111111111111',
    mode: 'auto',
    detectedCountryCode: null,
    detectedCountrySource: null,
    preferredExitCountryCode: null,
    preferredOutboundId: null,
    preferredOutboundName: null,
    scoreProfile: 'gaming',
    autoDetectCountry: true,
    allowClientOverride: true,
    routeLocked: false,
    stickySessionProtection: true,
    updatedAt: null,
  };

  await page.route('**/api/client/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/client/me')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          account: {
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            displayName: 'Client account',
            status: 'active',
            quotaScope: 'account_shared',
            quotaLimitBytes: 10737418240,
            usedBytes: 1073741824,
            remainingBytes: 9663676416,
          },
          clientConfig: {
            id: '11111111-1111-1111-1111-111111111111',
            label: 'Gaming phone',
            protocol: 'vless',
            deviceLimit: 1,
            effectiveQuotaLimitBytes: 10737418240,
            usedBytes: 1073741824,
            remainingBytes: 9663676416,
            status: 'active',
          },
          routePreference,
        }),
      });
      return;
    }

    if (url.pathname.endsWith('/client/route-preference')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ routePreference }),
      });
      return;
    }

    if (url.pathname.endsWith('/client/route-options')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          routeGroup: 'main',
          countries: [],
          outbounds: [],
        }),
      });
      return;
    }

    if (url.pathname.endsWith('/client/subscription')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          subscription: {
            clientConfigId: '11111111-1111-1111-1111-111111111111',
            routeGroup: 'main',
            generatedAt: new Date('2026-05-29T00:00:00.000Z').toISOString(),
            chargedRemainingBytes: 9663676416,
            endpoints: [],
            configLinks: [],
          },
        }),
      });
      return;
    }

    if (url.pathname.endsWith('/client/rewarded-ads')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          rewardedAds: {
            enabled: true,
            rewardBytes: 104857600,
            dailyLimit: 20,
            watchedToday: 0,
            remainingToday: 20,
            nextResetAt: new Date('2026-05-30T00:00:00.000Z').toISOString(),
            provider: 'mvp_rewarded_ad',
            verificationMode: 'client_callback_mvp',
          },
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4100');
  await page.getByLabel('Client token').fill('test-token');
  await page.getByRole('button', { name: 'Connect' }).click();

  await expect(page.getByText('Per-app VPN')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Selected apps' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Telegram/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /WhatsApp/ })).toBeVisible();

  const horizontalOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});
