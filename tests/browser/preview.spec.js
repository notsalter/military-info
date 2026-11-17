import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createArticlePreviewHandler } from '../../server/articlePreview.js';
import { getArticlePath } from '../../src/services/articleLinks.js';
import { FEEDS } from '../../src/services/feeds.js';
import { CURATION_DISCLAIMER } from '../../src/services/curationDisclaimer.js';

const article = { title: 'TEST FIXTURE: Naval preview page', description: 'Synthetic military preview for local browser tests only.', url: 'https://example.com/test-fixture/preview', publishedAt: null, source: FEEDS[0], urlToImage: null };
const articlePath = getArticlePath(article);
const localOrigin = 'http://127.0.0.1:4173';

async function servePreview(page) {
  const handler = createArticlePreviewHandler({ feedHandler: async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900');
    res.status(200).json({ source: FEEDS[0], articles: [article], fetchedAt: new Date().toISOString() });
  } });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== localOrigin) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/article/')) return route.continue();
    const response = { headers: {}, status(code) { this.code = code; return this; }, setHeader(name, value) { this.headers[name] = value; }, send(body) { this.body = body; }, end() {} };
    // Replay the pinned reference original-path/query boundary; this is not a deployment.
    const feed = url.pathname.split('/')[2];
    const token = url.pathname.split('/').at(-1);
    await handler({ method: 'GET', url: `${url.pathname}?feed=${feed}&article=${token}${url.search ? `&${url.search.slice(1)}` : ''}` }, response);
    return route.fulfill({ status: response.code, headers: response.headers, body: response.body });
  });
}

test('no-JavaScript legacy preview publishes the current readable canonical and real fixture metadata', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await servePreview(page);
    const legacy = `/article/${article.source.id}/${btoa(article.url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
    const response = await page.goto(`${localOrigin}${legacy}`);
    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', { name: article.title })).toBeVisible();
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', article.title);
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content', article.description);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://military-info.vercel.app${articlePath}`);
    await expect(page.locator('script')).toHaveCount(0);
    const invalid = await page.goto(`${localOrigin}${articlePath}?extra=1`);
    expect(invalid.status()).toBe(400);
    await expect(page.getByRole('heading', { name: 'Article preview unavailable' })).toBeVisible();
  } finally { await context.close(); }
});

for (const width of [320, 390, 768, 1440]) {
  test(`server preview is accessible and has comfortable links at ${width}px`, async ({ page }) => {
    await servePreview(page);
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(articlePath);
    expect(response.status()).toBe(200);
    await expect(page.getByRole('heading', { name: article.title, level: 1 })).toBeVisible();
    await expect(page.locator('footer')).toContainText(CURATION_DISCLAIMER);
    await expect(page.getByRole('link', { name: 'Read at publisher' })).toHaveAttribute('href', article.url);
    await expect(page.getByLabel('Copy this first-party share link')).toHaveValue(`https://military-info.vercel.app${articlePath}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const short = await page.locator('a,input').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().height < 44).map(element => element.textContent || element.id));
    expect(short).toEqual([]);
    expect(errors).toEqual([]);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole('link', { name: 'Back to latest news' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${localOrigin}/`);
  });
}
