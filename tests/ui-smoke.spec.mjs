import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const appUrl = pathToFileURL(resolve('docs/index.html')).href;

test.beforeEach(async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('file:')) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(appUrl);
  await expect(page.locator('#mcBtn')).toBeVisible();
  await expect.poll(() => pageErrors, { message: 'no uncaught browser errors' }).toEqual([]);
});

async function expectNoHorizontalScroll(page) {
  await expect.poll(async () => page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(root.scrollWidth, document.body.scrollWidth) <= window.innerWidth + 2;
  }), { message: 'document has no horizontal overflow' }).toBe(true);
}

test('static app loads, predicts, and remains responsive', async ({ page }) => {
  await page.evaluate(() => {
    const runs = document.querySelector('#runs');
    if (runs) {
      runs.value = '120';
      runs.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await expect(page.locator('#mcBtn')).toBeEnabled({ timeout: 20000 });
  await page.locator('#mcBtn').click();
  await expect(page.locator('#appStatus')).toContainText(/Predictions complete|Monte Carlo complete/, { timeout: 20000 });
  await expect(page.locator('#path')).toContainText(/Champion:/, { timeout: 20000 });
  await expectNoHorizontalScroll(page);

  await page.locator('[data-tab="groups"]').click();
  await expect(page.locator('#groups')).toBeVisible();
  await expect(page.locator('#groups')).toContainText('Best third-place teams');
  await expectNoHorizontalScroll(page);

  await page.locator('[data-tab="bracket"]').click();
  await expect(page.locator('#bracket')).toBeVisible();
  await expect(page.locator('#bracket')).toContainText(/Round of 32|Final/);
  await expectNoHorizontalScroll(page);

  await page.locator('[data-tab="stats"]').click();
  await expect(page.locator('#stats')).toBeVisible();
  await expect(page.locator('#stats')).toContainText('Schedule progress');
  await expectNoHorizontalScroll(page);
});
