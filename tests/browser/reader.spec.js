import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FEEDS } from '../../src/services/feeds.js';

const fixtureFeeds = FEEDS.slice(0, 2);
const localOrigin = 'http://127.0.0.1:4173';

function feedFixture(feed) {
  return { status: 'ok', items: [
    { title: `TEST FIXTURE: ${feed.name}: Naval ship review`, description: 'Synthetic military naval snippet for browser tests only.', link: `https://example.com/${feed.id}/test-naval`, pubDate: '2026-01-02T00:00:00Z' },
    { title: `TEST FIXTURE: ${feed.name}: Aircraft review`, description: 'Synthetic military aerospace snippet for browser tests only.', link: `https://example.com/${feed.id}/test-aircraft`, pubDate: '2026-01-01T00:00:00Z' },
  ] };
}

const fixture = feedFixture(fixtureFeeds[0]);

async function stubFeeds(page, { mode = 'ok', feeds = fixtureFeeds, makeFixture = feedFixture } = {}) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    const endpoint = url.origin === localOrigin && url.pathname === '/api/feeds';
    const rss2json = url.origin === 'https://api.rss2json.com' && url.pathname === '/v1/api.json';
    if (endpoint || rss2json) {
      const feed = FEEDS.find(feed => endpoint ? feed.id === url.searchParams.get('id') : feed.url === url.searchParams.get('rss_url'));
      if (mode !== 'ok' || !feed) return route.abort('blockedbyclient');
      const data = feeds.some(selected => selected.id === feed.id) ? makeFixture(feed) : { status: 'ok', items: [] };
      if (rss2json) return route.fulfill({ json: data });
      return route.fulfill({ json: {
        source: { id: feed.id, name: feed.name }, fetchedAt: new Date().toISOString(),
        articles: data.items.map(item => ({ title: item.title, description: item.description, url: item.link, publishedAt: item.pubDate })),
      } });
    }
    if (url.origin === localOrigin) return route.continue();
    return route.abort('blockedbyclient');
  });
}

async function tabTo(page, control) {
  for (let attempt = 0; attempt < 100; attempt++) {
    await page.keyboard.press('Tab');
    if (await control.evaluate(element => element === document.activeElement)) return;
  }
  await expect(control).toBeFocused();
}

async function expectDialogFocusTrap(page, dialog) {
  const controls = dialog.locator('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(controls.last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(controls.first()).toBeFocused();
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
  expect(await page.locator('#root').evaluate(element => element.inert)).toBe(true);
}

for (const width of [320, 390, 768, 1440]) {
  test(`reader fits ${width}px with accessible controls`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await stubFeeds(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('button', { name: fixture.items[0].title })).toBeVisible();
    await expect(page.locator('.loading-state')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const short = await page.locator('button,select,input').evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().height && el.getBoundingClientRect().height < 44).map(el => el.outerHTML));
    expect(short).toEqual([]);
    expect(errors).toEqual([]);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('search, topic, publisher and sort change the real displayed collection', async ({ page }) => {
  await stubFeeds(page); await page.goto('/');
  await expect(page.getByRole('button', { name: fixture.items[0].title })).toBeVisible();
  await expect(page.locator('.loading-state')).toHaveCount(0);
  const publisher = page.getByLabel('Publisher', { exact: true });
  const choices = publisher.locator('option:not([value="all"])');
  expect(await choices.count()).toBeGreaterThanOrEqual(2);
  expect(await choices.evaluateAll(options => options.map(option => ({ id: option.value, name: option.textContent })))).toEqual(fixtureFeeds.map(feed => ({ id: feed.id, name: feed.name })));
  await expect(page.locator('.article-card')).toHaveCount(4);
  await page.getByLabel('Topic', { exact: true }).selectOption('aerospace');
  await expect(page.getByRole('button', { name: fixture.items[0].title })).toHaveCount(0);
  await expect(page.locator('.article-card h3')).toHaveText(fixtureFeeds.map(feed => feedFixture(feed).items[1].title));
  await page.getByLabel('Topic', { exact: true }).selectOption('all');
  await page.getByLabel('Sort articles').selectOption('oldest');
  await expect(page.locator('.article-card h3').first()).toHaveText(fixture.items[1].title);
  for (const feed of fixtureFeeds) {
    await publisher.selectOption(feed.id);
    await expect(page.locator('.article-card')).toHaveCount(2);
    await expect(page.locator('.article-card h3')).toHaveText([...feedFixture(feed).items].reverse().map(item => item.title));
    await expect(page.locator('.article-card .article-meta a')).toHaveText([feed.name, feed.name]);
    for (const other of fixtureFeeds.filter(other => other.id !== feed.id)) {
      for (const item of feedFixture(other).items) await expect(page.getByRole('button', { name: item.title })).toHaveCount(0);
    }
  }
  await publisher.selectOption('all');
  await expect(page.locator('.article-card')).toHaveCount(4);
  await page.getByLabel('Search headlines').fill('no-such-test-fixture');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No articles match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.getByRole('button', { name: fixture.items[0].title })).toBeVisible();
});

test('native article dialog traps focus, saves metadata, returns focus and supports reload', async ({ page }) => {
  await stubFeeds(page); await page.goto('/');
  const headline = page.getByRole('button', { name: fixture.items[0].title });
  await headline.click();
  const dialog = page.getByRole('dialog', { name: fixture.items[0].title });
  await expect(dialog).toBeVisible();
  expect(await page.locator('dialog').evaluate(el => el.matches(':modal'))).toBe(true);
  expect(await page.locator('#root').evaluate(el => el.inert)).toBe(true);
  await page.getByRole('button', { name: 'Save article', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove saved article' })).toBeVisible();
  const read = page.getByRole('link', { name: /Read at/ });
  await expect(read).toHaveAttribute('href', fixture.items[0].link);
  await read.focus(); await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close article' })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(read).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(headline).toBeFocused();
  await page.reload();
  await page.getByRole('button', { name: /Saved articles \(1\)/ }).click();
  await expect(headline).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('military_bookmarks')));
  expect(JSON.stringify(saved)).not.toContain('content');
});

test('sources and settings work by keyboard without entering real credentials', async ({ page }) => {
  await stubFeeds(page); await page.goto('/');
  const sources = page.getByRole('button', { name: 'Sources', exact: true });
  await tabTo(page, sources);
  await expect(sources).toBeFocused();
  await page.keyboard.press('Enter');
  const sourcesDialog = page.getByRole('dialog', { name: 'Sources' });
  await expect(sourcesDialog).toBeVisible();
  await expectDialogFocusTrap(page, sourcesDialog);
  await expect(page.locator('.source-register li')).toHaveCount(FEEDS.length);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(sourcesDialog).toHaveCount(0);
  await expect(sources).toBeFocused();
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  await tabTo(page, settings);
  await expect(settings).toBeFocused();
  await page.keyboard.press('Space');
  const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(settingsDialog).toBeVisible();
  await expectDialogFocusTrap(page, settingsDialog);
  await expect(page.getByText(/Keys are stored in plain text/)).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Save keys', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByText('Keys saved in this browser.')).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Clear news cache' }));
  await page.keyboard.press('Space');
  await expect(page.getByText('News cache cleared. Saved articles are unchanged.')).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Remove keys' }));
  await page.keyboard.press('Enter');
  await expect(page.getByText('Keys removed. Public feeds will be used.')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(settingsDialog).toHaveCount(0);
  await expect(settings).toBeFocused();
  expect(await page.locator('#root').evaluate(element => element.inert)).toBe(false);
});

test('pagination and blocked bookmark storage work in the built browser', async ({ page }) => {
  await stubFeeds(page, { feeds: [FEEDS[0]], makeFixture: feed => ({ status: 'ok', items: Array.from({ length: 15 }, (_, i) => ({ title: `TEST FIXTURE: ${feed.name}: Naval pagination ${i}`, description: 'Synthetic military browser pagination test only.', link: `https://example.com/${feed.id}/pagination-${i}` })) }) });
  await page.goto('/');
  await expect(page.locator('.article-card')).toHaveCount(12);
  const more = page.getByRole('button', { name: 'Show more articles' });
  await tabTo(page, more);
  await page.keyboard.press('Enter');
  await expect(page.locator('.article-card')).toHaveCount(15);
  await expect(more).toHaveCount(0);
  await expect(page.locator('.headline-button').nth(12)).toBeFocused();
  await page.locator('.headline-button').first().click();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Synthetic blocked storage'); }; });
  await page.getByRole('button', { name: 'Save article', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Could not save this change. Unable to save browser storage.');
  await expect(page.getByRole('button', { name: 'Save article', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Saved articles (0)' })).toBeVisible();
});

test('failed feeds show failure and never fabricated news', async ({ page }) => {
  await stubFeeds(page, { mode: 'error' }); await page.goto('/');
  await expect(page.getByText('News could not be loaded. Try again or read your saved articles.')).toBeVisible({ timeout: 25000 });
  await expect(page.locator('.article-card')).toHaveCount(0);
  await page.getByRole('button', { name: /Saved articles/ }).click();
  await expect(page.getByText('No saved articles yet. Open a headline and save it to read later.')).toBeVisible();
});
