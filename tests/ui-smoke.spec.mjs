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
  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const root = document.scrollingElement || document.documentElement;
        const viewportWidth = window.innerWidth;
        const rootScrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        const overflowTolerance = 12;
        const candidateSelectors = ['body *'];
        const offenders = [];

        const nodes = [...document.querySelectorAll(candidateSelectors)];
        for (const node of nodes) {
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            continue;
          }
          const rect = node.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          const isFixed = style.position === 'fixed';
          const isVisible = rect.right > 0 && rect.left < viewportWidth;
          if (!isVisible && isFixed) continue;

          if (rect.left < -overflowTolerance || rect.right > viewportWidth + overflowTolerance) {
            offenders.push({
              tag: node.tagName,
              id: node.id,
              cls: (node.className || '').toString().slice(0, 120),
              left: Math.round(rect.left * 100) / 100,
              right: Math.round(rect.right * 100) / 100,
              position: style.position,
            });
          }
        }

        return {
          viewportWidth,
          rootClientWidth: root.clientWidth,
          rootScrollWidth,
          offenders: offenders.slice(0, 8),
          hasOverflow: rootScrollWidth > root.clientWidth + overflowTolerance || offenders.length > 0,
        };
      });
    }, { message: 'document has no horizontal overflow' })
    .toEqual({
      viewportWidth: expect.any(Number),
      rootClientWidth: expect.any(Number),
      rootScrollWidth: expect.any(Number),
      offenders: expect.any(Array),
      hasOverflow: false,
    });
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
      const scoreA = Number.isFinite(match.scoreA) ? match.scoreA : null;
      const scoreB = Number.isFinite(match.scoreB) ? match.scoreB : null;
      const fallback = typeof window.displayOutcome === 'function' ? (window.displayOutcome(match) || 'TBD') : (match.winner || 'TBD');
      const winner = typeof window.scoreWinner === 'function'
        ? window.scoreWinner(match, scoreA, scoreB, fallback)
        : (match.scoreA === match.scoreB ? (match.winner || 'Draw') : match.scoreA > match.scoreB ? match.teamA : match.teamB);
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
      if (text.includes('Displayed result:') && winner !== 'Draw' && winner !== 'TBD' && winner !== 'Unresolved draw' && !text.toLowerCase().includes(String(winner).toLowerCase())) {
        bad.push(`M${match.no}: MC text does not name projected winner ${winner}`);
      }
      if (text.includes('MC projection:') && scoreA === scoreB && winner === 'Draw' && !text.toLowerCase().includes('draw') && !/pens/i.test(text)) {
        bad.push(`M${match.no}: MC projection tied score does not include draw or penalty outcome`);
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
      if (tab === 'bracket' && viewport.width <= 760) {
        const bracketLayout = await page.locator('.bracket').evaluate(node => {
          const columns = getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/);
          const widths = Array.from(node.querySelectorAll('.match'), match => match.getBoundingClientRect().width);
          return { columns: columns.length, narrowestMatch: Math.min(...widths) };
        });
        expect(bracketLayout.columns).toBe(1);
        expect(bracketLayout.narrowestMatch).toBeGreaterThan(200);
      }
      await expectNoHorizontalScroll(page);
      await expectNoBrokenVisibleImages(page);
    }
  });
}
