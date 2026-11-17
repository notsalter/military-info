import { describe, expect, it, vi } from 'vitest';
import { FEEDS } from '../src/services/feeds.js';
import { createFeedHandler } from './feedHandler.js';

function response() {
  return { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
const xml = '<rss><channel><item><title>Army update</title><link>https://www.defensenews.com/story</link><description>Public summary</description><pubDate>17 Nov 2026 08:00:00 GMT</pubDate></item></channel></rss>';

describe('fixed feed endpoint', () => {
  it('coalesces concurrent requests and retains the original fetchedAt without extending CDN freshness', async () => {
    let resolveFetch;
    let clock = Date.parse('2026-11-17T09:00:00Z');
    const fetchFeed = vi.fn(() => new Promise(resolve => { resolveFetch = resolve; }));
    const handler = createFeedHandler({ fetchFeed, now: () => clock });
    const first = response();
    const second = response();
    const pending = handler({ method: 'GET', url: '/api/feeds?id=defense-news' }, first);
    const pending2 = handler({ method: 'GET', url: '/api/feeds?id=defense-news' }, second);
    expect(fetchFeed).toHaveBeenCalledTimes(1);
    resolveFetch(xml);
    await Promise.all([pending, pending2]);
    expect(second.body).toEqual(first.body);
    clock += 60_000;
    const cached = response();
    await handler({ method: 'GET', url: '/api/feeds?id=defense-news' }, cached);
    expect(fetchFeed).toHaveBeenCalledTimes(1);
    expect(cached.body.fetchedAt).toBe('2026-11-17T09:00:00.000Z');
    expect(cached.headers['Cache-Control']).toBe('public, max-age=0, s-maxage=840');
    clock += 840_000;
    fetchFeed.mockResolvedValueOnce(xml);
    const expired = response();
    await handler({ method: 'GET', url: '/api/feeds?id=defense-news' }, expired);
    expect(fetchFeed).toHaveBeenCalledTimes(2);
    expect(expired.body.fetchedAt).toBe('2026-11-17T09:15:00.000Z');
    expect(expired.headers['Cache-Control']).toBe('public, max-age=0, s-maxage=900');
  });
  it('does not serve expired memory data as fresh when an upstream refresh fails', async () => {
    let clock = 1_000_000;
    const fetchFeed = vi.fn().mockResolvedValueOnce(xml).mockRejectedValueOnce(new Error('upstream fail'));
    const handler = createFeedHandler({ fetchFeed, now: () => clock });
    await handler({ method: 'GET', url: '/api/feeds?id=defense-news' }, response());
    clock += 900_001;
    const res = response();
    await handler({ method: 'GET', url: '/api/feeds?id=defense-news' }, res);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'Feed unavailable.' });
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
  it('RSS discards invalid items, deduplicates links, caps articles/snippets, and never exports content', async () => {
    const item = n => `<item><title><![CDATA[<b>Army ${n}</b>]]></title><link>/story/${n}</link><description><![CDATA[<script>secret()</script><p>${'s'.repeat(400)}</p>]]></description><pubDate>2026-02-30T10:00:00Z</pubDate><content:encoded>full content secret</content:encoded></item>`;
    const body = `<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item>bad</item><item><title>Bad link</title><link>javascript:alert(1)</link></item>${item(0)}${Array.from({ length: 15 }, (_, n) => item(n)).join('')}</channel></rss>`;
    const res = response();
    await createFeedHandler({ fetchFeed: async () => body })({ method: 'GET', url: '/api/feeds?id=defense-news' }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.articles).toHaveLength(10);
    expect(new Set(res.body.articles.map(article => article.id)).size).toBe(10);
    for (const article of res.body.articles) {
      expect(article.description).toHaveLength(250);
      expect(article.publishedAt).toBeNull();
      expect(article.title).toMatch(/^Army \d+$/);
      expect(Object.keys(article).sort()).toEqual(['description', 'id', 'publishedAt', 'source', 'title', 'url', 'urlToImage']);
    }
    expect(JSON.stringify(res.body)).not.toMatch(/secret|<p>|content:encoded/);
  });
  it.each([
    ['<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Army Atom</title><link rel="self" href="/self"/><link rel="alternate" href="/atom"/><summary>Atom snippet</summary><updated>2026-11-17T01:00:00Z</updated></entry></feed>', 'Army Atom', '/atom'],
    ['<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><channel><title>RSS1</title></channel><item><title>Army RDF</title><link>/rdf</link><description>RDF snippet</description><dc:date xmlns:dc="http://purl.org/dc/elements/1.1/">2026-11-17T01:00:00Z</dc:date></item></rdf:RDF>', 'Army RDF', '/rdf'],
  ])('parses Atom/RSS1 feed metadata', async (body, title, path) => {
    const res = response();
    await createFeedHandler({ fetchFeed: async () => body })({ method: 'GET', url: '/api/feeds?id=defense-news' }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.articles[0]).toMatchObject({ title, url: `https://www.defensenews.com${path}`, publishedAt: '2026-11-17T01:00:00.000Z' });
  });
  it.each(['<rss><channel/></rss>', '<feed xmlns="http://www.w3.org/2005/Atom"/>'])('valid empty feed is an empty successful result', async body => {
    const res = response();
    await createFeedHandler({ fetchFeed: async () => body })({ method: 'GET', url: '/api/feeds?id=defense-news' }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.articles).toEqual([]);
  });
  it.each(['<html/><rss><channel/></rss>', '<rss><channel/></rss><rss><channel/></rss>', '<rss><channel/></rss><feed/>'])('rejects multiple XML document roots instead of caching an ambiguous result', async body => {
    const res = response();
    await createFeedHandler({ fetchFeed: async () => body })({ method: 'GET', url: '/api/feeds?id=defense-news' }, res);
    expect(res.statusCode).toBe(502);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
  it.each(['<html>upstream failure</html>', '<rss><channel>', '<!DOCTYPE rss [<!ENTITY x "expanded">]><rss><channel/></rss>', '<feed/>'.repeat(300000)])('rejects unsafe or invalid XML with a non-leaking no-store error', async body => {
    const res = response();
    await createFeedHandler({ fetchFeed: async () => body })({ method: 'GET', url: '/api/feeds?id=defense-news' }, res);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'Feed unavailable.' });
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
  it('hides upstream errors and permits retry', async () => {
    const fetchFeed = vi.fn().mockRejectedValueOnce(new Error('429 secret upstream response')).mockResolvedValue(xml);
    const handler = createFeedHandler({ fetchFeed });
    const res = response();
    await handler({ method: 'GET', url: '/api/feeds?id=defense-news' }, res);
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: 'Feed unavailable.' });
    const retry = response();
    await handler({ method: 'GET', url: '/api/feeds?id=defense-news' }, retry);
    expect(retry.statusCode).toBe(200);
  });
  it.each([
    ['POST', '/api/feeds?id=defense-news', 405], ['HEAD', '/api/feeds?id=defense-news', 405],
    ['GET', '/api/feeds', 400], ['GET', '/api/feeds?id=unknown', 404],
    ['GET', '/api/feeds?id=defense-news&url=https://localhost', 400],
    ['GET', '/api/feeds?id=defense-news&force=true', 400],
    ['GET', '/api/feeds?id=defense-news&_=123', 400],
    ['GET', '/api/feeds?id=defense-news&id=naval-news', 400],
    ['GET', '/api/feeds?%69d=defense-news', 400],
    ['GET', '/api/feeds?id=defense%2dnews', 400],
    ['GET', 'https://attacker.invalid/api/feeds?id=defense-news', 400],
    ['GET', '/api/feeds?id=defense-news#ignored', 400],
    ['GET', '/api/feeds?id=defense-news\n', 400],
    ['GET', '/api/feeds?id=defense-news\r', 400],
  ])('rejects %s %s before any upstream access', async (method, url, status) => {
    const fetchFeed = vi.fn().mockResolvedValue(xml);
    const res = response();
    await createFeedHandler({ fetchFeed })({ method, url, query: { id: 'defense-news' } }, res);
    expect(fetchFeed).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(status);
    expect(res.body).toEqual({ error: status === 405 ? 'Method not allowed.' : status === 404 ? 'Unknown feed.' : 'Invalid request.' });
    expect(res.headers['Cache-Control']).toBe('no-store');
    if (status === 405) expect(res.headers.Allow).toBe('GET');
  });
  it('GET returns normalized snippets from the exact shared registry URL', async () => {
    const fetchFeed = vi.fn().mockResolvedValue(xml);
    const handler = createFeedHandler({ fetchFeed, now: () => Date.parse('2026-11-17T09:00:00Z') });
    const res = response();
    await handler({ method: 'GET', url: '/api/feeds?id=defense-news' }, res);
    expect(FEEDS).toHaveLength(30);
    expect(fetchFeed).toHaveBeenCalledExactlyOnceWith(FEEDS[0].url);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      articles: [{ id: 'https://www.defensenews.com/story', title: 'Army update', description: 'Public summary', url: 'https://www.defensenews.com/story', urlToImage: null, publishedAt: '2026-11-17T08:00:00.000Z', source: { id: 'defense-news', name: 'Defense News' } }],
      fetchedAt: '2026-11-17T09:00:00.000Z', source: { id: 'defense-news', name: 'Defense News' },
    });
    expect(res.headers['Cache-Control']).toBe('public, max-age=0, s-maxage=900');
  });
});
