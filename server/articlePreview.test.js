// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { FEEDS } from '../src/services/feeds.js';
import { getArticlePath } from '../src/services/articleLinks.js';
import { CURATION_DISCLAIMER } from '../src/services/curationDisclaimer.js';
import { createFeedHandler } from './feedHandler.js';

const feed = FEEDS[0];
const articleURL = 'https://www.defensenews.com/test-fixture/story?a=1&b=2';
const path = getArticlePath({ url: articleURL, source: feed });
const clock = Date.parse('2026-11-17T09:00:00Z');
const xml = `<rss><channel><item><title>TEST FIXTURE Army update</title><link>${articleURL.replace('&', '&amp;')}</link>
  <description>TEST FIXTURE public snippet.</description><pubDate>2026-11-17T08:00:00Z</pubDate>
</item></channel></rss>`;

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(() => { throw new Error('External network disabled for TEST FIXTURE'); })); });
afterEach(() => { vi.unstubAllGlobals(); });

function response() {
  return {
    headers: {}, statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
    end(body) { if (body !== undefined) this.body = body; return this; },
  };
}
async function setup(body = xml) {
  const { createArticlePreviewHandler } = await import('./articlePreview.js');
  const fetchFeed = vi.fn().mockResolvedValue(body);
  const feedHandler = vi.fn(createFeedHandler({ fetchFeed, now: () => clock }));
  return { handler: createArticlePreviewHandler({ feedHandler, now: () => clock }), fetchFeed, feedHandler };
}
function document(html) { return new JSDOM(html).window.document; }

it.each([path, '/article/unknown/AAAA'])('TEST FIXTURE uses Military Info product branding rather than the styling reference for %s', async url => {
  const { handler } = await setup();
  const res = response();
  await handler({ method: 'GET', url }, res);
  const doc = document(res.body);
  expect(doc.querySelector('header a').textContent).toBe('Military Info');
  expect(res.body).not.toContain('Asterisk');
  if (url === path) {
    expect(doc.querySelector('meta[property="og:site_name"]').content).toBe('Military Info');
    expect(doc.querySelector('header a').getAttribute('aria-label')).toBe('Military Info home');
  } else expect(doc.title).toContain('Military Info');
});

it('TEST FIXTURE bounds crawler and visible titles to 250 characters', async () => {
  const title = `TEST FIXTURE ${'Army '.repeat(100)}`;
  const { handler } = await setup(xml.replace('TEST FIXTURE Army update', title));
  const res = response();
  await handler({ method: 'GET', url: path }, res);
  const doc = document(res.body);
  expect(doc.title).toHaveLength(250);
  expect(doc.querySelector('meta[property="og:title"]').content).toBe(doc.title);
  expect(doc.querySelector('h1').textContent).toBe(doc.title);
});

it('TEST FIXTURE uses only the first ten feed entries and never resolves an article that rotated beyond the cap', async () => {
  const items = Array.from({ length: 10 }, (_, index) => `<item><title>TEST FIXTURE Army ${index}</title><link>https://www.defensenews.com/test-fixture/${index}</link></item>`).join('');
  const { handler, fetchFeed } = await setup(xml.replace('<channel>', `<channel>${items}`));
  const res = response();
  await handler({ method: 'GET', url: path }, res);
  expect(res.statusCode).toBe(404);
  expect(fetchFeed).toHaveBeenCalledExactlyOnceWith(feed.url);
});

it.each([
  'http://images.example.org/test-fixture.jpg', 'https://127.0.0.1/test-fixture.jpg',
  'https://193.32.204.199/test-fixture.jpg', 'https://images.local/test-fixture.jpg',
  'https://user:secret@images.example.org/test-fixture.jpg', 'https://images.example.org:8443/test-fixture.jpg',
])('TEST FIXTURE endpoint omits unsafe feed image %s without a stock fallback', async image => {
  const body = xml.replace('<rss>', '<rss xmlns:media="http://search.yahoo.com/mrss/">').replace('</item>', `<media:thumbnail url="${image}"/></item>`);
  const { handler, fetchFeed } = await setup(body);
  const res = response();
  await handler({ method: 'GET', url: path }, res);
  expect(res.statusCode).toBe(200);
  const doc = document(res.body);
  expect(doc.querySelector('img,meta[property="og:image"],meta[name="twitter:image"]')).toBeNull();
  expect(doc.querySelector('meta[name="twitter:card"]').content).toBe('summary');
  expect(fetchFeed).toHaveBeenCalledExactlyOnceWith(feed.url);
});

it('TEST FIXTURE invalid publication dates are absent from rendered article metadata', async () => {
  const { handler } = await setup(xml.replace('2026-11-17T08:00:00Z', '2026-02-30T12:00:99Z'));
  const res = response();
  await handler({ method: 'GET', url: path }, res);
  expect(res.statusCode).toBe(200);
  expect(document(res.body).querySelector('meta[property="article:published_time"],.article-meta time')).toBeNull();
});

it.each(['GET', 'HEAD'])('TEST FIXTURE applies no-script security headers to unavailable %s pages', async method => {
  const { handler } = await setup();
  const res = response();
  await handler({ method, url: '/article/unknown/AAAA' }, res);
  expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
  expect(res.headers['Referrer-Policy']).toBe('no-referrer');
  expect(res.headers['Content-Security-Policy']).toContain("script-src 'none'");
});

it('TEST FIXTURE honors a stricter captured feed cache deadline instead of extending it', async () => {
  const { createArticlePreviewHandler } = await import('./articlePreview.js');
  const feedHandler = async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=45');
    res.status(200).json({ articles: [{ url: articleURL, title: 'TEST FIXTURE Army cache', description: '' }], fetchedAt: '2026-11-17T09:00:00.000Z', source: { id: feed.id } });
  };
  const res = response();
  await createArticlePreviewHandler({ feedHandler, now: () => clock })({ method: 'GET', url: path }, res);
  expect(res.statusCode).toBe(200);
  expect(res.headers['Cache-Control']).toBe('public, max-age=0, s-maxage=45');
});

it.each([
  ['invalid acquisition time', { fetchedAt: 'not-a-date' }],
  ['future acquisition time', { fetchedAt: '2026-11-17T09:00:01.000Z' }],
  ['expired acquisition time', { fetchedAt: '2026-11-17T08:44:59.000Z' }],
  ['too many feed articles', { articles: Array.from({ length: 11 }, () => ({ url: articleURL, title: 'TEST FIXTURE' })) }],
  ['mismatched feed attribution', { source: { id: 'naval-news', name: 'TEST FIXTURE wrong source' } }],
  ['missing article object', { articles: [null] }],
])('TEST FIXTURE fails closed on %s from the feed boundary', async (_case, fields) => {
  const { createArticlePreviewHandler } = await import('./articlePreview.js');
  const feedHandler = async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900');
    res.status(200).json({ articles: [{ url: articleURL, title: 'TEST FIXTURE Army boundary', description: 'TEST FIXTURE snippet.' }], fetchedAt: '2026-11-17T09:00:00.000Z', source: { id: feed.id }, ...fields });
  };
  const res = response();
  await createArticlePreviewHandler({ feedHandler, now: () => clock })({ method: 'GET', url: path }, res);
  expect(res.statusCode).toBe(503);
  expect(res.headers['Cache-Control']).toBe('no-store');
  expect(res.headers['Retry-After']).toBe('60');
  expect(res.headers['X-Robots-Tag']).toBe('noindex');
});

it('TEST FIXTURE publishes only a safe feed-supplied image in social metadata and eager branded markup', async () => {
  const image = 'https://images.example.org/test-fixture/army.jpg?a=1&b=2';
  const body = xml.replace('<rss>', '<rss xmlns:media="http://search.yahoo.com/mrss/">').replace('</item>', `<media:thumbnail url="${image.replace('&', '&amp;')}"/></item>`);
  const { handler, fetchFeed } = await setup(body);
  const res = response();
  await handler({ method: 'GET', url: path }, res);
  const doc = document(res.body);
  expect(doc.querySelector('meta[property="og:image"]').content).toBe(image);
  expect(doc.querySelector('meta[name="twitter:image"]').content).toBe(image);
  expect(doc.querySelector('meta[name="twitter:card"]').content).toBe('summary_large_image');
  const img = doc.querySelector('img.article-image');
  expect(img.src).toBe(image);
  expect(img.alt).toBe('');
  expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
  expect(img.width).toBe(640);
  expect(img.height).toBe(360);
  expect(img.getAttribute('loading')).toBe('eager');
  expect(img.getAttribute('fetchpriority')).toBe('high');
  expect(doc.querySelectorAll('img')).toHaveLength(1);
  expect(fetchFeed).toHaveBeenCalledExactlyOnceWith(feed.url);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it.each([path, '/article/unknown/AAAA'])('TEST FIXTURE renders the shared curation disclaimer in footer for %s', async url => {
  const { handler } = await setup();
  const res = response();
  await handler({ method: 'GET', url }, res);
  expect(document(res.body).querySelector('footer').textContent).toContain(CURATION_DISCLAIMER);
});

it('TEST FIXTURE preserves feed acquisition time and remaining cache freshness across warm requests', async () => {
  const { createArticlePreviewHandler } = await import('./articlePreview.js');
  let time = clock;
  const fetchFeed = vi.fn().mockResolvedValue(xml);
  const feedHandler = createFeedHandler({ fetchFeed, now: () => time });
  const handler = createArticlePreviewHandler({ feedHandler, now: () => time });
  const first = response();
  await handler({ method: 'GET', url: path }, first);
  expect(first.headers['Cache-Control']).toBe('public, max-age=0, s-maxage=900');
  time += 60_001;
  const warm = response();
  await handler({ method: 'GET', url: path }, warm);
  expect(warm.headers['Cache-Control']).toBe('public, max-age=0, s-maxage=839');
  expect(warm.headers['Last-Modified']).toBe('Tue, 17 Nov 2026 09:00:00 GMT');
  expect(document(warm.body).querySelector('time[data-fetched-at]').dateTime).toBe('2026-11-17T09:00:00.000Z');
  expect(fetchFeed).toHaveBeenCalledTimes(1);
  time = clock + 900_000;
  const refreshed = response();
  await handler({ method: 'GET', url: path }, refreshed);
  expect(fetchFeed).toHaveBeenCalledTimes(2);
  expect(refreshed.headers['Last-Modified']).toBe('Tue, 17 Nov 2026 09:15:00 GMT');
  expect(refreshed.headers['Cache-Control']).toBe('public, max-age=0, s-maxage=900');
});

it.each(['GET', 'HEAD'])('TEST FIXTURE %s returns 404 when the headline rotates out, not publisher content', async method => {
  const { handler, fetchFeed } = await setup(xml.replace('/test-fixture/story', '/test-fixture/other'));
  const res = response();
  await handler({ method, url: path }, res);
  expect(res.statusCode).toBe(404);
  expect(res.headers['Cache-Control']).toBe('no-store');
  expect(res.headers['X-Robots-Tag']).toBe('noindex');
  expect(res.headers['Retry-After']).toBeUndefined();
  expect(fetchFeed).toHaveBeenCalledExactlyOnceWith(feed.url);
  if (method === 'GET') expect(document(res.body).querySelector('main').textContent).toMatch(/no longer|rotated out/i);
  else expect(res.body).toBeUndefined();
});

it.each(['GET', 'HEAD'])('TEST FIXTURE %s maps upstream failure to non-leaking retryable 503', async method => {
  const { handler, fetchFeed } = await setup();
  fetchFeed.mockRejectedValueOnce(new Error('TEST FIXTURE upstream secret https://193.32.204.199'));
  const res = response();
  await handler({ method, url: path }, res);
  expect(res.statusCode).toBe(503);
  expect(res.headers['Retry-After']).toBe('60');
  expect(res.headers['Cache-Control']).toBe('no-store');
  expect(res.headers['X-Robots-Tag']).toBe('noindex');
  if (method === 'GET') expect(res.body).not.toMatch(/secret|193\.32\.204\.199/);
  else expect(res.body).toBeUndefined();
});

it.each(['POST', 'PUT', 'DELETE', 'OPTIONS'])('TEST FIXTURE rejects %s with explicit GET and HEAD allowance before feed access', async method => {
  const { handler, feedHandler } = await setup();
  const res = response();
  await handler({ method, url: path }, res);
  expect(res.statusCode).toBe(405);
  expect(res.headers.Allow).toBe('GET, HEAD');
  expect(res.headers['Cache-Control']).toBe('no-store');
  expect(res.headers['X-Robots-Tag']).toBe('noindex');
  expect(feedHandler).not.toHaveBeenCalled();
});

it.each([path, '/article/unknown/AAAA'])('TEST FIXTURE HEAD %s retains GET status and headers without a response body', async url => {
  const { handler, feedHandler } = await setup();
  const get = response();
  const head = response();
  await handler({ method: 'GET', url }, get);
  await handler({ method: 'HEAD', url }, head);
  expect(head.statusCode).toBe(get.statusCode);
  expect(head.headers).toEqual(get.headers);
  expect(head.body).toBeUndefined();
  if (url === path) expect(feedHandler.mock.calls.at(-1)[0]).toEqual({ method: 'GET', url: `/api/feeds?id=${feed.id}` });
});

it.each([
  null, '/article', `${path}?extra=1`, `${path}#fragment`, `${path}/`, `${path}\n`, `${path}\r`,
  `https://attacker.invalid${path}`, path.replace('/defense-news/', '/unknown/'),
  '/article/defense-news/AAAA', `${path}=`, path.replace('/article/', '/article/%64'),
  '/api/article', `/api/article?feed=${feed.id}&article=${path.split('/').at(-1)}&extra=1`,
  `/api/article?feed=${feed.id}&article=${path.split('/').at(-1)}&feed=${feed.id}`,
  `/api/article?feed=${feed.id}&article=${path.split('/').at(-1)}&article=AAAA`,
  `/api/article?article=${path.split('/').at(-1)}&feed=${feed.id}`,
  `/api/article?feed=defense%2dnews&article=${path.split('/').at(-1)}`,
])('TEST FIXTURE rejects malformed or ambiguous request %s before fixed feed access', async url => {
  const { handler, fetchFeed, feedHandler } = await setup();
  const res = response();
  await handler({ method: 'GET', url, query: { feed: feed.id, article: path.split('/').at(-1) } }, res);
  expect(res.statusCode).toBe(400);
  expect(res.headers['Cache-Control']).toBe('no-store');
  expect(res.headers['X-Robots-Tag']).toBe('noindex');
  expect(document(res.body).querySelector('meta[name="robots"]').content).toBe('noindex');
  expect(feedHandler).not.toHaveBeenCalled();
  expect(fetchFeed).not.toHaveBeenCalled();
});

it('TEST FIXTURE accepts the exact Vercel rewritten route with the same canonical URL', async () => {
  const { handler } = await setup();
  const res = response();
  await handler({ method: 'GET', url: `/api/article?feed=${feed.id}&article=${path.split('/').at(-1)}` }, res);
  expect(res.statusCode).toBe(200);
  expect(document(res.body).querySelector('link[rel="canonical"]').href).toBe(`https://military-info.vercel.app${path}`);
});

it('TEST FIXTURE supplies bounded social metadata and accessible no-script publisher attribution', async () => {
  const title = 'TEST FIXTURE Army "update" & <10 vehicles';
  const snippet = `TEST FIXTURE ${'x'.repeat(280)}`;
  const body = xml.replace('TEST FIXTURE Army update', 'TEST FIXTURE Army &quot;update&quot; &amp; &lt;10 vehicles')
    .replace('TEST FIXTURE public snippet.', snippet);
  const { handler } = await setup(body);
  const res = response();
  await handler({ method: 'GET', url: path }, res);
  const doc = document(res.body);
  const meta = name => doc.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.content;
  expect(doc.title).toBe(title);
  expect(meta('description')).toHaveLength(250);
  expect(meta('og:title')).toBe(title);
  expect(meta('og:description')).toBe(meta('description'));
  expect(meta('og:url')).toBe(`https://military-info.vercel.app${path}`);
  expect(meta('og:site_name')).toBe('Military Info');
  expect(meta('og:type')).toBe('article');
  expect(meta('twitter:card')).toBe('summary');
  expect(meta('twitter:title')).toBe(title);
  expect(meta('twitter:description')).toBe(meta('description'));
  expect(meta('article:published_time')).toBe('2026-11-17T08:00:00.000Z');
  expect(meta('viewport')).toBe('width=device-width, initial-scale=1');
  expect(doc.documentElement.lang).toBe('en');
  expect(doc.querySelector('link[rel="stylesheet"]').getAttribute('href')).toBe('/article-preview.css');
  expect(doc.querySelector('header.masthead')).not.toBeNull();
  expect(doc.querySelector('main#article.article-landing h1').textContent).toBe(title);
  expect(doc.querySelector('main .article-preview').textContent).toBe(meta('description'));
  expect(doc.querySelector('time').dateTime).toBe('2026-11-17T08:00:00.000Z');
  expect(doc.querySelector('footer')).not.toBeNull();
  expect(doc.querySelector('nav a[href="/"]').textContent).toBe('Back to latest news');
  expect(doc.querySelector('.article-meta').textContent).toContain('Defense News');
  expect(doc.querySelector('.preview-note').textContent).toMatch(/rotated out of (?:the )?source feed/i);
  expect(doc.querySelector('.preview-note').textContent).toMatch(/not a permanent archive/i);
  const share = doc.querySelector('input[readonly]');
  expect(share.value).toBe(`https://military-info.vercel.app${path}`);
  expect(doc.querySelector(`label[for="${share.id}"]`).textContent).toMatch(/copy|share/i);
  expect(doc.querySelector('a[target="_blank"]').rel).toBe('noopener noreferrer');
  expect(doc.querySelector('img,script,[onclick],[onerror]')).toBeNull();
  expect(res.body).toContain('&quot;update&quot; &amp; &lt;10');
  expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
  expect(res.headers['Content-Security-Policy']).toContain("script-src 'none'");
  expect(res.headers['Referrer-Policy']).toBe('no-referrer');
});

it('TEST FIXTURE renders a first-party article found in the exact fixed registry feed', async () => {
  const { handler, fetchFeed, feedHandler } = await setup();
  const res = response();
  await handler({ method: 'GET', url: path, headers: { host: 'attacker.invalid' } }, res);
  expect(res.statusCode).toBe(200);
  expect(res.headers['Content-Type']).toBe('text/html; charset=utf-8');
  expect(fetchFeed).toHaveBeenCalledExactlyOnceWith(feed.url);
  expect(feedHandler.mock.calls[0][0]).toEqual({ method: 'GET', url: `/api/feeds?id=${feed.id}` });
  expect(globalThis.fetch).not.toHaveBeenCalled();
  const doc = document(res.body);
  expect(doc.querySelector('h1').textContent).toBe('TEST FIXTURE Army update');
  expect(doc.querySelector('link[rel="canonical"]').href).toBe(`https://military-info.vercel.app${path}`);
  expect(doc.querySelector('a[target="_blank"]').href).toBe(articleURL);
});
