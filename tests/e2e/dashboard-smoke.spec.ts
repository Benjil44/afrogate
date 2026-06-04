import { expect, test } from '@playwright/test';

test('dashboard renders on the fixed local frontend port', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Afrows Operations/);
  await expect(page.locator('#root')).toBeVisible();

  await page.waitForFunction(() => {
    const root = document.querySelector('#root');
    return Boolean(root && root.childElementCount > 0);
  });

  const horizontalOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});
