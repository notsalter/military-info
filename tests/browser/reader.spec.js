import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FEEDS } from '../../src/services/feeds.js';
import { getArticlePath } from '../../src/services/articleLinks.js';
import { CURATION_DISCLAIMER } from '../../src/services/curationDisclaimer.js';

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
    await expect(page.getByRole('link', { name: fixture.items[0].title })).toBeVisible();
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
  await expect(page.getByRole('link', { name: fixture.items[0].title })).toBeVisible();
  await expect(page.locator('.loading-state')).toHaveCount(0);
  const publisher = page.getByLabel('Publisher', { exact: true });
  const choices = publisher.locator('option:not([value="all"])');
  expect(await choices.count()).toBeGreaterThanOrEqual(2);
  expect(await choices.evaluateAll(options => options.map(option => ({ id: option.value, name: option.textContent })))).toEqual(fixtureFeeds.map(feed => ({ id: feed.id, name: feed.name })));
  await expect(page.locator('.article-card')).toHaveCount(4);
  await page.getByLabel('Topic', { exact: true }).selectOption('aerospace');
  await expect(page.getByRole('link', { name: fixture.items[0].title })).toHaveCount(0);
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
      for (const item of feedFixture(other).items) await expect(page.getByRole('link', { name: item.title })).toHaveCount(0);
    }
  }
  await publisher.selectOption('all');
  await expect(page.locator('.article-card')).toHaveCount(4);
  await page.getByLabel('Search headlines').fill('no-such-test-fixture');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No articles match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.getByRole('link', { name: fixture.items[0].title })).toBeVisible();
});

test('native article dialog traps focus, saves metadata, returns focus and supports reload', async ({ page }) => {
  await stubFeeds(page); await page.goto('/');
  const headline = page.getByRole('link', { name: fixture.items[0].title });
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

test('curation disclaimer remains visible in the reader and article drawer', async ({ page }) => {
  await stubFeeds(page); await page.goto('/');
  await expect(page.locator('footer')).toContainText(CURATION_DISCLAIMER);
  await page.getByRole('link', { name: fixture.items[0].title }).click();
  await expect(page.getByRole('dialog')).toContainText(CURATION_DISCLAIMER);
});

for (const format of ['legacy', 'changed-headline']) {
  test(`${format} deep link resolves genuine feed text and retains Back/Forward membership`, async ({ page }) => {
    await stubFeeds(page);
    const item = fixture.items[0];
    const current = getArticlePath({ title: item.title, url: item.link, source: fixtureFeeds[0] });
    const route = format === 'legacy' ? `/article/${fixtureFeeds[0].id}/${btoa(item.link).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}` : current.replace('test-fixture-defense-news-naval-ship-review', 'test-fixture-old-headline');
    await page.goto('/?fixture=readable#news');
    await expect(page.getByRole('link', { name: item.title })).toBeVisible();
    await page.evaluate(route => {
      history.pushState({ militaryInfoArticle: { path: route, listingURL: '/?fixture=readable#news' } }, '', route);
      dispatchEvent(new PopStateEvent('popstate'));
    }, route);
    const dialog = page.getByRole('dialog', { name: item.title });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('link', { name: /Read at/ })).toHaveAttribute('href', item.link);
    await page.getByRole('button', { name: 'Close article' }).click();
    await expect(page).toHaveURL(`${localOrigin}/?fixture=readable#news`);
    await expect(dialog).toHaveCount(0);
    await page.goForward();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(`${localOrigin}${route}`);
    await page.reload();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(`${localOrigin}${route}`);
  });
}

for (const format of ['legacy', 'short']) {
  for (const collection of ['live-only', 'saved-only', 'overlap']) {
    test(`settled unseen ${format} history resolves ${collection} with native Back and Forward`, async ({ page }) => {
      const item = fixture.items[0];
      const saved = { title: 'TEST FIXTURE saved naval headline', description: 'TEST FIXTURE saved naval preview', url: item.link, source: fixtureFeeds[0], publishedAt: '2026-01-01T00:00:00.000Z' };
      if (collection !== 'live-only') await page.addInitScript(saved => {
        localStorage.setItem('military_bookmarks', JSON.stringify({ version: 1, articles: [saved] }));
      }, saved);
      await stubFeeds(page, { feeds: collection === 'saved-only' ? [] : fixtureFeeds });
      const listingURL = '/?fixture=overlap#news';
      await page.goto(listingURL);
      await expect(page.locator('.loading-state')).toHaveCount(0);
      await expect(page.getByRole('button', { name: `Saved articles (${collection === 'live-only' ? 0 : 1})` })).toBeVisible();
      const current = getArticlePath({ title: item.title, url: item.link, source: fixtureFeeds[0] });
      const route = format === 'legacy' ? `/article/${fixtureFeeds[0].id}/${btoa(item.link).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}` : current;
      await page.evaluate(({ route, listingURL }) => {
        history.pushState({ militaryInfoArticle: { path: route, listingURL } }, '', route);
        dispatchEvent(new PopStateEvent('popstate'));
      }, { route, listingURL });
      const preferredTitle = collection === 'saved-only' ? saved.title : item.title;
      const dialog = page.getByRole('dialog', { name: preferredTitle });
      await expect(dialog).toBeVisible();
      expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
      await expect(dialog).toContainText(collection === 'saved-only' ? saved.description : item.description);
      await expect(dialog.getByRole('link', { name: /Read at/ })).toHaveAttribute('href', item.link);
      await expect(page).toHaveURL(`${localOrigin}${route}`);
      await page.getByRole('button', { name: 'Close article' }).click();
      await expect(page).toHaveURL(`${localOrigin}${listingURL}`);
      await expect(dialog).toHaveCount(0);
      await page.goForward();
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(`${localOrigin}${route}`);
      await page.goBack();
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(`${localOrigin}${listingURL}`);
    });
  }
}

test('first-party headline, clipboard and browser history keep visitors on the curated site', async ({ page }) => {
  await page.addInitScript(() => {
    window.__testCopied = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__testCopied.push(value); } } });
  });
  await stubFeeds(page); await page.goto('/');
  const headline = page.getByRole('link', { name: fixture.items[0].title });
  const path = getArticlePath({ title: fixture.items[0].title, url: fixture.items[0].link, source: fixtureFeeds[0] });
  expect(path).toMatch(/^\/article\/defense-news\/test-fixture-defense-news-naval-ship-review~[a-f0-9]{16}$/);
  await expect(headline).toHaveAttribute('href', path);
  await tabTo(page, headline); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: fixture.items[0].title });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(`${localOrigin}${path}`);
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__testCopied)).toEqual([`${localOrigin}${path}`]);
  await expect(dialog.getByRole('status')).toContainText(/copied/i);
  await page.goBack(); await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(`${localOrigin}/`);
  await page.goForward(); await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(`${localOrigin}${path}`);
  await page.getByRole('button', { name: 'Close article' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(`${localOrigin}/`);
});

test('clipboard rejection exposes a selectable first-party URL without false success', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('TEST FIXTURE: blocked clipboard'); } } });
  });
  await stubFeeds(page); await page.goto('/');
  await page.getByRole('link', { name: fixture.items[0].title }).click();
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  const field = page.getByLabel('Military Info share link');
  await expect(field).toBeVisible();
  await expect(field).toHaveValue(`${localOrigin}${getArticlePath({ title: fixture.items[0].title, url: fixture.items[0].link, source: fixtureFeeds[0] })}`);
  await expect(field).toHaveAttribute('readonly', '');
  await expect(page.getByText(/link copied/i)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

async function prepareScrolledSavedListing(page, fragment, { smooth = false, reducedMotion = 'no-preference' } = {}) {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.emulateMedia({ reducedMotion });
  const saved = Array.from({ length: 36 }, (_, index) => {
    const feed = FEEDS[index < 30 ? 0 : 1];
    const url = `https://fixture.example/${feed.id}/saved-${String(index).padStart(2, '0')}`;
    return { id: url, url, title: `SYNTHETIC OFFLINE FIXTURE: navy saved-${String(index).padStart(2, '0')}`, description: 'Synthetic offline regression fixture, not real news.', publishedAt: '2026-01-01T00:00:00Z', source: { id: feed.id, name: feed.name }, urlToImage: null };
  });
  await page.addInitScript(saved => localStorage.setItem('military_bookmarks', JSON.stringify({ version: 1, articles: saved })), saved);
  await stubFeeds(page, { feeds: [] });
  await page.goto(`/?review=listing${fragment}`);
  await page.getByRole('button', { name: 'Saved articles (36)' }).click();
  await page.getByLabel('Search headlines').fill('saved');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByLabel('Topic', { exact: true }).selectOption('naval');
  await page.getByLabel('Publisher', { exact: true }).selectOption(FEEDS[0].id);
  await page.getByLabel('Sort articles').selectOption('oldest');
  await page.getByRole('button', { name: 'Show more articles' }).click();
  const headline = page.locator('.headline-button').nth(7);
  await headline.focus();
  await page.evaluate(() => scrollBy(0, -150));
  await page.waitForTimeout(150);
  if (smooth) await page.addStyleTag({ content: 'html { scroll-behavior: smooth !important; }' });
  return headline;
}

const listingSnapshot = page => page.evaluate(() => ({
  url: location.href, x: scrollX, y: scrollY,
  focus: { tag: document.activeElement?.tagName, text: document.activeElement?.textContent },
  query: document.querySelector('#headline-search').value,
  topic: document.querySelector('#topic-filter').value, publisher: document.querySelector('#publisher-filter').value,
  sort: document.querySelector('#sort-filter').value, count: document.querySelector('.result-count').textContent,
  headlines: [...document.querySelectorAll('.headline-button')].map(node => node.textContent),
  savedView: document.querySelectorAll('nav button')[1].getAttribute('aria-pressed'),
}));

async function expectSettledListing(page, before, headline) {
  await expect(page).toHaveURL(before.url);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => scrollY)).toBe(before.y);
  await expect(headline).toBeFocused();
  expect(await listingSnapshot(page)).toEqual(before);
  expect(await page.locator('#root').evaluate(node => node.inert)).toBe(false);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
}

test('fragment-bearing saved listing restores settled scroll and headline focus after Close and Forward/Back', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const headline = await prepareScrolledSavedListing(page, '#news');
  const before = await listingSnapshot(page);
  expect(before.y).toBeGreaterThan(500);
  await expect(headline).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close article' }).click();
  await expectSettledListing(page, before, headline);
  await page.goForward();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expectSettledListing(page, before, headline);
  expect(errors).toEqual([]);
});

for (const fragment of ['#news', '']) {
  for (const exit of ['Close', 'Escape', 'Back']) {
    for (const motion of ['default', 'smooth', 'reduced', 'smooth/reduced']) {
      test(`saved listing ${fragment || 'no hash'} restores after ${exit} and Forward/Back (${motion})`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const headline = await prepareScrolledSavedListing(page, fragment, { smooth: motion.includes('smooth'), reducedMotion: motion.includes('reduced') ? 'reduce' : 'no-preference' });
        const before = await listingSnapshot(page);
        expect(before.y).toBeGreaterThan(500);
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expectDialogFocusTrap(page, dialog);
        if (exit === 'Close') await page.getByRole('button', { name: 'Close article' }).click();
        else if (exit === 'Escape') await page.keyboard.press('Escape');
        else await page.goBack();
        await expectSettledListing(page, before, headline);
        await page.goForward();
        await expect(dialog).toBeVisible();
        await expectDialogFocusTrap(page, dialog);
        await page.goBack();
        await expectSettledListing(page, before, headline);
        expect(errors).toEqual([]);
      });
    }
  }

  test(`saved listing ${fragment || 'no hash'} restores scroll and main fallback when the headline disappears`, async ({ page }) => {
    const headline = await prepareScrolledSavedListing(page, fragment);
    const before = await listingSnapshot(page);
    const title = await headline.textContent();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Remove saved article' }).click();
    await page.getByRole('button', { name: 'Close article' }).click();
    await expect(page).toHaveURL(before.url);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => scrollY)).toBe(before.y);
    await expect(page.getByRole('main')).toBeFocused();
    await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0);
    await expect(page.locator('.result-count')).toHaveText('Showing 24 of 29 articles.');
    await page.goForward();
    await expect(page.getByRole('dialog', { name: title })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => scrollY)).toBe(before.y);
    await expect(page.getByRole('main')).toBeFocused();
    const after = await listingSnapshot(page);
    expect({ ...after, focus: before.focus, count: before.count, headlines: before.headlines }).toEqual(before);
  });
}

test('fragment listing restoration leaves subsequent Sources and Settings modal focus ownership intact', async ({ page }) => {
  const headline = await prepareScrolledSavedListing(page, '#news');
  const before = await listingSnapshot(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expectSettledListing(page, before, headline);
  for (const name of ['Sources', 'Settings']) {
    const trigger = page.getByRole('button', { name, exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name, exact: true });
    await expect(dialog).toBeVisible();
    await expectDialogFocusTrap(page, dialog);
    const url = page.url();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.waitForTimeout(500);
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(url);
    expect(await page.locator('#root').evaluate(node => node.inert)).toBe(false);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  }
});

test('separate history entries for the same article retain their own listing scroll and focus snapshots', async ({ page }) => {
  const headline = await prepareScrolledSavedListing(page, '#news');
  const first = await listingSnapshot(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expectSettledListing(page, first, headline);
  await page.evaluate(() => scrollBy(0, 120));
  const second = await listingSnapshot(page);
  expect(second.y).not.toBe(first.y);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expectSettledListing(page, second, headline);
  await page.goForward();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expectSettledListing(page, second, headline);
});

test('direct article route Close and Escape use the no-history listing fallback', async ({ page }) => {
  await stubFeeds(page);
  const path = getArticlePath({ title: fixture.items[0].title, url: fixture.items[0].link, source: fixtureFeeds[0] });
  for (const exit of ['Close', 'Escape']) {
    await page.goto(path);
    await expect(page.getByRole('dialog', { name: fixture.items[0].title })).toBeVisible();
    expect(await page.evaluate(() => history.state?.militaryInfoArticle)).toBeUndefined();
    if (exit === 'Close') await page.getByRole('button', { name: 'Close article' }).click();
    else await page.keyboard.press('Escape');
    await expect(page).toHaveURL(`${localOrigin}/`);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    expect(await page.locator('#root').evaluate(node => node.inert)).toBe(false);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  }
});

test('failed feeds show failure and never fabricated news', async ({ page }) => {
  await stubFeeds(page, { mode: 'error' }); await page.goto('/');
  await expect(page.getByText('News could not be loaded. Try again or read your saved articles.')).toBeVisible({ timeout: 25000 });
  await expect(page.locator('.article-card')).toHaveCount(0);
  await page.getByRole('button', { name: /Saved articles/ }).click();
  await expect(page.getByText('No saved articles yet. Open a headline and save it to read later.')).toBeVisible();
});
