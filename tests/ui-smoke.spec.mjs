import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const localAppUrl = pathToFileURL(resolve('docs/index.html')).href;
const configuredUrl = process.env.FIFA_UI_BASE_URL || localAppUrl;
const isLiveUrl = /^https?:/i.test(configuredUrl);
const appUrl = isLiveUrl
  ? configuredUrl + (configuredUrl.includes('?') ? '&' : '?') + `uiSmoke=${Date.now()}`
  : configuredUrl;
const viewports = process.env.FIFA_UI_EXHAUSTIVE === '1'
  ? [
      { name: 'small-phone', width: 320, height: 568 },
      { name: 'phone', width: 390, height: 844 },
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'large', width: 1920, height: 1080 }
    ]
  : [
      { name: 'phone', width: 390, height: 844 },
      { name: 'desktop', width: 1440, height: 900 }
    ];

async function loadApp(page) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  if (!isLiveUrl) {
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith('file:')) return route.continue();
      return route.abort('blockedbyclient');
    });
  }
  await page.goto(appUrl);
  await expect(page.locator('#mcBtn')).toBeVisible();
  await expect.poll(() => pageErrors, { message: 'no uncaught browser errors' }).toEqual([]);
}

async function expectNoHorizontalScroll(page) {
  await expect.poll(async () => page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(root.scrollWidth, document.body.scrollWidth) <= window.innerWidth + 2;
  }), { message: 'document has no horizontal overflow' }).toBe(true);
}

async function expectNoBrokenVisibleImages(page) {
  await expect.poll(async () => page.evaluate(() => [...document.images]
    .filter(img => img.offsetParent !== null && (!img.complete || img.naturalWidth === 0))
    .map(img => img.currentSrc || img.src)
  ), { message: 'visible images load' }).toEqual([]);
}

async function expectNoMcOutcomeContradictions(page) {
  await expect.poll(async () => page.evaluate(() => {
    const run = window.LAST || window.MC?.representative;
    const matches = [...(run?.matches || []), ...(run?.ko || [])];
    const bad = [];
    for (const match of matches) {
      if (!Number.isFinite(match.scoreA) || !Number.isFinite(match.scoreB) || typeof window.matchMCHtml !== 'function') continue;
      const probe = document.createElement('div');
      probe.innerHTML = window.matchMCHtml(match);
      const text = probe.textContent || '';
      const winner = match.scoreA === match.scoreB ? (match.winner || 'Draw') : match.scoreA > match.scoreB ? match.teamA : match.teamB;
      if (text.includes('Pre-match MC:')) bad.push(`M${match.no}: scored result still shows pre-match text`);
      if (text.includes('MC outcome frequency')) bad.push(`M${match.no}: displayed result uses ambiguous MC outcome label`);
      if (text.includes('Displayed outcome frequency')) bad.push(`M${match.no}: displayed result uses old ambiguous outcome-frequency label`);
      if (text.includes('MC projection:')) {
        const state = window.matchDisplayState?.(match);
        if (!state?.projection) bad.push(`M${match.no}: MC projection text without projection state`);
        const score = Number.isFinite(state?.scoreA) && Number.isFinite(state?.scoreB) ? `${state.scoreA}–${state.scoreB}` : '';
        if (score && !text.includes(score)) bad.push(`M${match.no}: MC projection text omits projected score ${score}`);
        if (state?.winner && state.winner !== 'Draw' && !text.includes(state.winner)) {
          bad.push(`M${match.no}: MC projection text omits projected winner ${state.winner}`);
        }
        if (state?.fav && state.fav[0] !== state.winner) {
          bad.push(`M${match.no}: MC projection winner ${state.winner} differs from favored bucket ${state.fav[0]}`);
        }
      }
      if (text.includes('Displayed result:') && !text.includes('Overall MC')) {
        bad.push(`M${match.no}: displayed result lacks Overall MC context`);
      }
      if (text.includes('Displayed result:') && winner !== 'Draw' && !text.includes(winner)) {
        bad.push(`M${match.no}: MC text does not name displayed winner ${winner}`);
      }
      if (text.includes('Displayed result:') && winner === 'Draw' && !text.toLowerCase().includes('draw')) {
        bad.push(`M${match.no}: MC text does not describe displayed draw`);
      }
    }
    return bad;
  }), { message: 'MC probability text does not contradict displayed outcomes' }).toEqual([]);
}

for (const viewport of viewports) {
  test(`app predicts and remains responsive at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await loadApp(page);
    await expectNoHorizontalScroll(page);
    await expectNoBrokenVisibleImages(page);

    const settings = page.locator('#predictionSettings');
    await settings.locator('summary').click();
    await expect(settings).toHaveJSProperty('open', true);
    await page.locator('#runs').fill('120');
    await page.locator('#chaos').fill('1.18');
    await page.locator('#weather').selectOption('off');
    await expect(page.locator('#runs')).toHaveValue('120');
    await expect(page.locator('#chaos')).toHaveValue('1.18');
    await expect(page.locator('#weather')).toHaveValue('off');

    await expect(page.locator('#mcBtn')).toBeEnabled({ timeout: 20000 });
    await page.locator('#mcBtn').click();
    await expect(page.locator('#appStatus')).toContainText(/Predictions complete|Monte Carlo complete/, { timeout: 20000 });
    await expect(page.locator('#topProbs')).toContainText(/%/, { timeout: 20000 });
    await expect(page.locator('#todayView')).toContainText(/M\d+/, { timeout: 20000 });
    await expect(page.locator('#path')).toContainText(/Champion:/, { timeout: 20000 });
    await expectNoMcOutcomeContradictions(page);
    await expectNoHorizontalScroll(page);
    await expectNoBrokenVisibleImages(page);

    const tabs = await page.locator('.tab').evaluateAll(nodes => nodes.map(node => node.dataset.tab).filter(Boolean));
    for (const tab of tabs) {
      await page.locator(`[data-tab="${tab}"]`).click();
      await expect(page.locator(`#${tab}`)).toBeVisible();
      await expect(page.locator(`#${tab}`)).not.toBeEmpty();
      await expectNoHorizontalScroll(page);
      await expectNoBrokenVisibleImages(page);
    }
  });
}
