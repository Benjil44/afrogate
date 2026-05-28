import { expect, test } from '@playwright/test';

test('client app renders on the fixed local client port', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4100');

  await expect(page).toHaveTitle(/AfroGate Client/);
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
