import { beforeEach, describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import './testStorage';
import { FEEDS } from './feeds';
let rss;
vi.mock('axios');
beforeEach(async () => {
  vi.resetModules();
  rss = await import('./rssService');
  vi.clearAllMocks();
});
const feed = { id: 'defense-news', name: 'Defense News', url: 'https://example.com/feed', region: 'US' };

describe('XML feed parsing', () => {
  it('preserves document order and punctuation in Atom XHTML mixed content', () => {
    const atom = rss.parseXMLRSS('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Army report</title><link href="https://example.com/order"/><summary type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Army <strong>denies</strong> retreat reports.</p></div></summary></entry></feed>', feed.url, feed.name);
    expect(atom[0].description).toBe('Army denies retreat reports.');
  });

  it('surfaces RSS storage read clear and cache-write failures without discarding articles', async () => {
    localStorage.setItem('military_info_rss_cache:old', 'old');
    localStorage.getItem = () => { throw new Error('blocked'); };
    localStorage.setItem = () => { throw new Error('blocked'); };
    localStorage.removeItem = () => { throw new Error('blocked'); };
    axios.get.mockResolvedValue({ data: { status: 'ok', items: [{ title: 'Army report', link: 'https://example.com/army' }] } });
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [feed], force: true, minIntervalMs: 0 });
    expect(result).toMatchObject({ success: true, cached: false, stale: false });
    expect(result.articles).toHaveLength(1);
    expect(result.storageWarnings).toEqual(expect.arrayContaining(['Unable to read browser storage.', 'Unable to save browser storage.', 'Unable to clear browser storage.']));
  });

  it('limits only the affected publisher on registered endpoint 429', async () => {
    const fetchedAt = new Date(Date.now() - 120000).toISOString();
    axios.get.mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '60' } } })
      .mockResolvedValueOnce({ data: { articles: [{ title: 'Army report', url: 'https://example.com/army' }], fetchedAt } });
    const result = await rss.fetchFromRSSFeeds(200, { feeds: FEEDS.slice(0, 2), concurrency: 1, minIntervalMs: 0 });
    expect(axios.get.mock.calls.map(([url]) => url)).toEqual(['/api/feeds', '/api/feeds']);
    expect(result.feedHealth.map(f => f.status)).toEqual(['rate-limited', 'ok']);
    expect(result.fetchedAt).toBe(fetchedAt);
    expect(localStorage.getItem('military_info_rss_retry_after')).toBeNull();
  });

  it('keeps registered endpoints available during converter cooldown', async () => {
    localStorage.setItem('military_info_rss_retry_after', String(Date.now() + 60000));
    axios.get.mockResolvedValue({ data: { articles: [], fetchedAt: new Date().toISOString() } });
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [FEEDS[0]], force: true, minIntervalMs: 0 });
    expect(axios.get.mock.calls.map(([url]) => url)).toEqual(['/api/feeds']);
    expect(result.feedHealth[0].status).toBe('empty');
  });

  it('persists publisher-only cooldown without suppressing other feed refreshes', async () => {
    const nextFeed = { ...feed, id: 'other-feed', url: 'https://example.com/other-feed' };
    axios.get.mockRejectedValueOnce(new Error('converter failed'))
      .mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '60' } } })
      .mockResolvedValue({ data: { status: 'ok', items: [] } });
    await rss.fetchFromRSSFeeds(200, { feeds: [feed, nextFeed], concurrency: 1, minIntervalMs: 0 });
    const second = await rss.fetchFromRSSFeeds(200, { feeds: [feed, nextFeed], concurrency: 1, minIntervalMs: 0, force: true });
    expect(axios.get).toHaveBeenCalledTimes(4);
    expect(second.feedHealth.map(f => f.status)).toEqual(['rate-limited', 'empty']);
    expect(localStorage.getItem('military_info_rss_retry_after')).toBeNull();
  });

  it('retains converter cooldown in memory and reports its failed persistence', async () => {
    localStorage.getItem = () => { throw new Error('blocked'); };
    localStorage.setItem = () => { throw new Error('blocked'); };
    axios.get.mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '60' } } });
    const first = await rss.fetchFromRSSFeeds(200, { feeds: [feed], minIntervalMs: 0 });
    expect(first.storageWarnings).toEqual(expect.arrayContaining(['Unable to read browser storage.', 'Unable to save browser storage.']));
    const second = await rss.fetchFromRSSFeeds(200, { feeds: [feed], minIntervalMs: 0, force: true });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(second.feedHealth[0].status).toBe('rate-limited');
  });

  it('resolves inherited and overridden Atom xml:base in link document order', () => {
    const articles = rss.parseXMLRSS('<feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://example.com/news/"><entry xml:base="army/"><title>Army report</title><link href="report"/></entry><entry xml:base="navy/"><title>Navy report</title><link xml:base="../updates/" href="report"/></entry></feed>', feed.url, feed.name);
    expect(articles.map(a => a.url)).toEqual(['https://example.com/news/army/report', 'https://example.com/news/updates/report']);
  });

  it('omits actual script and style subtree bodies from Atom XHTML snippets', () => {
    const articles = rss.parseXMLRSS('<feed><entry><title>Army report</title><link href="https://example.com/army"/><summary type="xhtml"><div><p>Army <script>malicious marker</script><style>style marker</style>denies retreat.</p></div></summary></entry></feed>', feed.url, feed.name);
    expect(articles[0].description).toBe('Army denies retreat.');
  });

  it('uses populated content when earlier descriptions or summaries normalize to empty text', () => {
    const atom = rss.parseXMLRSS('<feed><entry><title>Army report</title><link href="https://example.com/army"/><summary> </summary><content type="xhtml"><div>Army report body.</div></content></entry></feed>', feed.url, feed.name);
    expect(atom[0].description).toBe('Army report body.');
    const articles = rss.parseXMLRSS('<rss><channel><item><title>Navy report</title><link>https://example.com/navy</link><description><![CDATA[<p> </p>]]></description><content:encoded xmlns:content="https://example.com/content">Navy report body.</content:encoded></item></channel></rss>', feed.url, feed.name);
    expect(articles[0].description).toBe('Navy report body.');
  });

  it('includes storageWarnings on pre-cancelled RSS fetch results', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [feed], signal: controller.signal });
    expect(result.storageWarnings).toEqual([]);
  });

  it.each([
    ['pool deadline', 'timeout'],
    ['caller abort', 'cancelled'],
  ])('leaves queued registered endpoints interrupted by %s after converter 429', async (interruption, status) => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
      axios.get.mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '60' } } });
      const controller = new AbortController();
      const request = rss.fetchFromRSSFeeds(200, {
        feeds: [feed, ...FEEDS.slice(0, 2)], concurrency: 1, minIntervalMs: 1000,
        deadlineMs: 50, signal: controller.signal,
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(axios.get.mock.calls.map(([url]) => url)).toEqual(['https://api.rss2json.com/v1/api.json']);
      expect(localStorage.getItem('military_info_rss_retry_after')).toBe(String(Date.parse('2026-11-17T00:01:00Z')));
      if (interruption === 'caller abort') controller.abort();
      else await vi.advanceTimersByTimeAsync(50);
      const result = await request;
      expect(result.feedHealth.map(item => item.status)).toEqual(['rate-limited', status, status]);
      expect(result.success).toBe(false);
      expect(axios.get).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it('classifies an individual endpoint TimeoutError fixture before the pool deadline', async () => {
    axios.get.mockRejectedValueOnce(new DOMException('Individual transport timeout fixture.', 'TimeoutError'))
      .mockResolvedValueOnce({ data: { articles: [], fetchedAt: new Date().toISOString() } });
    const progress = vi.fn();
    const result = await rss.fetchFromRSSFeeds(200, {
      feeds: FEEDS.slice(0, 2), concurrency: 1, minIntervalMs: 0, deadlineMs: 1000, onProgress: progress,
    });
    expect(result.feedHealth.map(item => item.status)).toEqual(['timeout', 'empty']);
    expect(result.success).toBe(true);
    expect(progress.mock.calls[0][0].feedHealth.map(item => item.status)).toEqual(['timeout', 'pending']);
    expect(axios.get.mock.calls.map(([url]) => url)).toEqual(['/api/feeds', '/api/feeds']);
    expect(axios.get.mock.calls.every(([, options]) => !options.signal.aborted)).toBe(true);
  });

  it.each([
    ['ECONNABORTED', 'timeout of 5000ms exceeded', 'timeout'],
    ['ETIMEDOUT', 'connect ETIMEDOUT', 'timeout'],
    ['ECONNABORTED', 'Request aborted', 'error'],
    ['ERR_CANCELED', 'canceled', 'error'],
  ])('classifies forwarded Axios %s fixture %j as %s without a pool abort', async (code, message, status) => {
    axios.get.mockRejectedValueOnce(Object.assign(new Error(message), { name: 'AxiosError', code }));
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [FEEDS[0]], minIntervalMs: 0, deadlineMs: 1000 });
    expect(result.feedHealth[0].status).toBe(status);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][1].signal.aborted).toBe(false);
  });

  it('classifies a publisher TimeoutError fixture after converter fallback as timeout', async () => {
    axios.get.mockRejectedValueOnce(new Error('Converter unavailable fixture.'))
      .mockRejectedValueOnce(new DOMException('Publisher timeout fixture.', 'TimeoutError'));
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [feed], minIntervalMs: 0, deadlineMs: 1000 });
    expect(result.feedHealth[0].status).toBe('timeout');
    expect(axios.get.mock.calls.map(([url]) => url)).toEqual(['https://api.rss2json.com/v1/api.json', feed.url]);
  });

  it('reports the request-wrapper timeout while subsequent endpoint work remains live', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
      axios.get.mockImplementationOnce(() => new Promise(() => {}))
        .mockResolvedValueOnce({ data: { articles: [], fetchedAt: '2026-11-17T00:00:05Z' } });
      const request = rss.fetchFromRSSFeeds(200, {
        feeds: FEEDS.slice(0, 2), concurrency: 1, minIntervalMs: 0, deadlineMs: 10000,
      });
      await vi.advanceTimersByTimeAsync(5000);
      const result = await request;
      expect(result.feedHealth.map(item => item.status)).toEqual(['timeout', 'empty']);
      expect(axios.get.mock.calls.map(([, options]) => options.signal.aborted)).toEqual([true, false]);
    } finally { vi.useRealTimers(); }
  });

  it('preserves explicit endpoint 429 priority over a TimeoutError fixture', async () => {
    axios.get.mockRejectedValueOnce(Object.assign(new DOMException('Timeout-shaped rate-limit fixture.', 'TimeoutError'), {
      response: { status: 429, headers: { 'retry-after': '60' } },
    }));
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [FEEDS[0]], minIntervalMs: 0, deadlineMs: 1000 });
    expect(result.feedHealth[0].status).toBe('rate-limited');
    expect(Number(localStorage.getItem(`military_info_feed_retry_after_${FEEDS[0].url}`))).toBeGreaterThan(Date.now());
    expect(localStorage.getItem('military_info_rss_retry_after')).toBeNull();
  });

  it('preserves caller cancellation priority over an individual TimeoutError fixture', async () => {
    const controller = new AbortController();
    axios.get.mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(new DOMException('Timeout during caller cancellation fixture.', 'TimeoutError'));
    });
    const result = await rss.fetchFromRSSFeeds(200, {
      feeds: FEEDS.slice(0, 2), concurrency: 1, minIntervalMs: 0, signal: controller.signal,
    });
    expect(result.feedHealth.map(item => item.status)).toEqual(['cancelled', 'cancelled']);
    expect(result).toMatchObject({ success: false, articles: [], error: 'Request cancelled.' });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('preserves earlier source failures when a later source reaches the pool deadline', async () => {
    axios.get.mockRejectedValueOnce(new Error('failed primary')).mockRejectedValueOnce(new Error('failed direct')).mockImplementation(() => new Promise(() => {}));
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [feed, { ...feed, id: 'later' }], concurrency: 1, minIntervalMs: 0, deadlineMs: 50 });
    expect(result.feedHealth.map(f => f.status)).toEqual(['error', 'timeout']);
  });

  it('returns cancelled failure even if one feed completed before caller abort', async () => {
    const controller = new AbortController();
    axios.get.mockResolvedValueOnce({ data: { status: 'ok', items: [{ title: 'Navy report', link: 'https://example.com/navy' }] } }).mockImplementation(() => new Promise(() => {}));
    const request = rss.fetchFromRSSFeeds(200, { feeds: [feed, { ...feed, id: 'second' }], concurrency: 1, minIntervalMs: 0, signal: controller.signal });
    await vi.waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    controller.abort();
    const result = await request;
    expect(result.success).toBe(false);
    expect(result.articles).toEqual([]);
    expect(result.error).toBe('Request cancelled.');
  });

  it('honors Retry-After across refresh requests rather than repeatedly calling a rate-limited provider', async () => {
    axios.get.mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '60' } } });
    await rss.fetchFromRSSFeeds(200, { feeds: [feed] });
    const next = await rss.fetchFromRSSFeeds(200, { feeds: [feed], force: true });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(next.feedHealth[0].status).toBe('rate-limited');
  });

  it('does not repopulate cleared caches with an older request that completes late', async () => {
    let finish;
    axios.get.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const request = rss.fetchFromRSSFeeds(200, { feeds: [feed] });
    await vi.waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    rss.clearRSSCache();
    finish({ data: { status: 'ok', items: [{ title: 'Older Navy report', link: 'https://example.com/old' }] } });
    await request;
    expect(localStorage.getItem('military_info_rss_cache:' + feed.url)).toBeNull();
  });

  it('treats structurally valid empty RSS and Atom feeds as empty rather than failed parsing', () => {
    expect(rss.parseXMLRSS('<rss><channel/></rss>', feed.url, feed.name)).toEqual([]);
    expect(rss.parseXMLRSS('<feed xmlns="http://www.w3.org/2005/Atom"/>', feed.url, feed.name)).toEqual([]);
  });

  it('does not let a consumer progress callback break feed completion', async () => {
    axios.get.mockResolvedValue({ data: { status: 'ok', items: [] } });
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [feed], onProgress: () => { throw new Error('render callback'); } });
    expect(result.success).toBe(true);
    expect(result.feedHealth[0].status).toBe('empty');
  });

  it('keeps stale articles in progress while live sources are still unavailable', async () => {
    const { writePool } = await import('./storage');
    const fetchedAt = new Date(Date.now() - 3600000).toISOString();
    writePool('military_info_rss_cache:' + feed.url, { articles: [{ title: 'Saved Navy report', url: 'https://example.com/saved' }], fetchedAt, feedHealth: [] });
    axios.get.mockRejectedValue(new Error('offline'));
    const progress = vi.fn();
    await rss.fetchFromRSSFeeds(200, { feeds: [feed], onProgress: progress });
    expect(progress.mock.calls.every(([result]) => result.articles.length === 1 && result.stale)).toBe(true);
  });

  it('normalizes entity-escaped RSS link URLs and Atom XHTML summaries', () => {
    const rssArticles = rss.parseXMLRSS('<rss><channel><item><title>Army report</title><link>https://example.com/item?a=1&amp;b=2</link></item></channel></rss>', feed.url, feed.name);
    expect(rssArticles[0].url).toBe('https://example.com/item?a=1&b=2');
    const atom = rss.parseXMLRSS('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Army report</title><link href="https://example.com/item"/><summary type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>First <strong>important</strong> report.</p></div></summary></entry></feed>', feed.url, feed.name);
    expect(atom[0].description).toContain('important');
    expect(atom[0]).not.toHaveProperty('content');
  });

  it('bounds individual adapter transport time even when axios never settles', async () => {
    axios.get.mockImplementation(() => new Promise(() => {}));
    const start = Date.now();
    await expect(rss.fetchSingleRSSFeed(feed, { timeoutMs: 20 })).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('never starts delayed workers once an earlier worker reports rate limiting', async () => {
    axios.get.mockRejectedValue({ response: { status: 429 } });
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [feed, { ...feed, id: 'next' }], concurrency: 2, minIntervalMs: 40 });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(result.feedHealth.map(f => f.status)).toEqual(['rate-limited', 'rate-limited']);
  });

  it('does not accept a fresh cache for an already cancelled request', async () => {
    axios.get.mockResolvedValue({ data: { status: 'ok', items: [] } });
    await rss.fetchFromRSSFeeds(200, { feeds: [feed], minIntervalMs: 0 });
    const controller = new AbortController();
    controller.abort();
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [feed], signal: controller.signal });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Request cancelled.');
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('isolates null and malformed rss2json items instead of failing an otherwise valid feed', async () => {
    axios.get.mockResolvedValue({ data: { status: 'ok', items: [null, 42, { title: { unexpected: true }, link: 'https://example.com/bad' }, { title: 'Army report', link: 'https://example.com/army' }] } });
    const result = await rss.fetchSingleRSSFeed(feed);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Army report');
  });

  it('honors forced refresh even with a fresh RSS cache and exposes truthful clearing', async () => {
    axios.get.mockResolvedValue({ data: { status: 'ok', items: [] } });
    await rss.fetchFromRSSFeeds(200, { feeds: [feed], minIntervalMs: 0 });
    await rss.fetchFromRSSFeeds(200, { feeds: [feed], minIntervalMs: 0, force: true });
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(rss.clearRSSCache()).toEqual({ success: true });
    localStorage.removeItem = () => { throw new Error('blocked'); };
    localStorage.setItem('military_info_rss_cache', 'bad');
    expect(rss.clearRSSCache()).toMatchObject({ success: false });
  });

  it('serves stale validated snippets on network failure without relabelling old timestamps as fresh', async () => {
    const { writePool } = await import('./storage');
    const fetchedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    writePool('military_info_rss_cache:' + feed.url, { articles: [{ title: 'Saved Navy report', url: 'https://example.com/saved' }], fetchedAt, feedHealth: [{ id: feed.id, name: feed.name, status: 'ok', articleCount: 1 }] });
    axios.get.mockRejectedValue(new Error('offline'));
    const progress = vi.fn();
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [feed], minIntervalMs: 0, onProgress: progress });
    expect(progress.mock.calls[0][0]).toMatchObject({ stale: true, cached: true, fetchedAt });
    expect(result).toMatchObject({ success: true, stale: true, cached: true, fetchedAt });
    expect(result.articles[0].title).toBe('Saved Navy report');
    expect(result.feedHealth[0].status).toBe('error');
  });

  it('caches the complete RSS pool before limiting caller output', async () => {
    axios.get.mockResolvedValue({ data: { status: 'ok', items: [
      { title: 'First Navy report', link: 'https://example.com/first' },
      { title: 'Second Army report', link: 'https://example.com/second' },
    ] } });
    const first = await rss.fetchFromRSSFeeds(1, { feeds: [feed], minIntervalMs: 0 });
    expect(first.articles).toHaveLength(1);
    const second = await rss.fetchFromRSSFeeds(200, { feeds: [feed], minIntervalMs: 0 });
    expect(second.articles).toHaveLength(2);
    expect(second.cached).toBe(true);
    expect(second.stale).toBe(false);
    expect(second.fetchedAt).toBe(first.fetchedAt);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('stops rss2json requests after 429 instead of hammering remaining queued feeds', async () => {
    axios.get.mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '60' } } });
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [feed, { ...feed, id: 'next' }], concurrency: 1, minIntervalMs: 0 });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(result.feedHealth.map(f => f.status)).toEqual(['rate-limited', 'rate-limited']);
    expect(result.success).toBe(false);
  });

  it('cancels queued work and suppresses late transport results after caller abort', async () => {
    const controller = new AbortController();
    let resolve;
    axios.get.mockImplementation(() => new Promise(done => { resolve = done; }));
    const progress = vi.fn();
    const request = rss.fetchFromRSSFeeds(200, { feeds: [feed, { ...feed, id: 'next' }], concurrency: 1, minIntervalMs: 0, signal: controller.signal, onProgress: progress });
    await vi.waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    controller.abort();
    const result = await request;
    expect(result.feedHealth.map(f => f.status)).toEqual(['cancelled', 'cancelled']);
    const count = progress.mock.calls.length;
    resolve({ data: { status: 'ok', items: [{ title: 'Late report', link: 'https://example.com/late' }] } });
    await new Promise(done => setTimeout(done, 20));
    expect(progress).toHaveBeenCalledTimes(count);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
  it('enforces a whole-pool deadline even when a transport never settles', async () => {
    axios.get.mockImplementation(() => new Promise(() => {}));
    const started = Date.now();
    const result = await rss.fetchFromRSSFeeds(200, { feeds: [feed], deadlineMs: 40, minIntervalMs: 0 });
    expect(Date.now() - started).toBeLessThan(500);
    expect(result).toMatchObject({ success: false, articles: [], fetchedAt: null });
    expect(result.feedHealth[0].status).toBe('timeout');
    expect(axios.get.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('publishes usable feed progress before all bounded-concurrency sources settle', async () => {
    const feeds = Array.from({ length: 4 }, (_, i) => ({ ...feed, id: `feed-${i}`, name: `Feed ${i}`, url: `https://example.com/feed-${i}` }));
    const pending = [];
    axios.get.mockImplementation((url, options) => new Promise(resolve => pending.push({ resolve, options })));
    const progress = vi.fn();
    const request = rss.fetchFromRSSFeeds(200, { feeds, concurrency: 2, minIntervalMs: 0, onProgress: progress });
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[0].resolve({ data: { status: 'ok', items: [{ title: 'First Navy report', link: 'https://example.com/first' }] } });
    await vi.waitFor(() => expect(progress.mock.calls.some(([result]) => result.articles.length === 1)).toBe(true));
    await vi.waitFor(() => expect(pending).toHaveLength(3));
    pending[1].resolve({ data: { status: 'ok', items: [] } });
    await vi.waitFor(() => expect(pending).toHaveLength(4));
    pending[2].resolve({ data: { status: 'ok', items: [] } });
    pending[3].resolve({ data: { status: 'ok', items: [] } });
    const result = await request;
    expect(result.success).toBe(true);
    expect(result.feedHealth.map(f => f.status)).toEqual(['ok', 'empty', 'empty', 'empty']);
    expect(result.fetchedAt).toEqual(expect.any(String));
  });
  it('falls back to direct public XML on rss2json failure without sending paid keys or arbitrary proxy requests', async () => {
    axios.get.mockRejectedValueOnce(new Error('rss2json unavailable')).mockResolvedValueOnce({ data: '<rss><channel><item><title>Navy report</title><link>https://example.com/navy</link></item></channel></rss>' });
    const articles = await rss.fetchSingleRSSFeed(feed);
    expect(articles).toHaveLength(1);
    expect(axios.get.mock.calls[1][0]).toBe(feed.url);
    expect(articles[0].source.id).toBe(feed.id);
  });
  it('uses keyless rss2json without paid count parameters and normalizes its items', async () => {
    expect(rss.fetchSingleRSSFeed).toBeTypeOf('function');
    axios.get.mockResolvedValue({ data: { status: 'ok', items: [
      { title: 'Army food supply conference', link: 'https://example.com/army', description: 'x'.repeat(900), pubDate: 'bad' },
      { title: '', link: 'https://example.com/missing' },
    ] } });
    const articles = await rss.fetchSingleRSSFeed(feed);
    expect(axios.get.mock.calls[0][1].params).toEqual({ rss_url: feed.url });
    expect(articles).toHaveLength(1);
    expect(articles[0].source).toEqual({ id: feed.id, name: feed.name });
    expect(articles[0].description).toHaveLength(250);
    expect(articles[0].publishedAt).toBeNull();
    expect(articles[0]).not.toHaveProperty('content');
  });
  it('parses Atom alternate links and rejects unsafe XML documents', () => {
    const articles = rss.parseXMLRSS('<feed xmlns="http://www.w3.org/2005/Atom"><title>MoD</title><entry><title>Defense &amp; resilience</title><link rel="self" href="/api/item"/><link rel="alternate" href="/news/item"/><updated>2026-11-14T13:00:00Z</updated><summary>Latest &lt;b&gt;report&lt;/b&gt;.</summary></entry></feed>', feed.url, feed.name);
    expect(articles).toHaveLength(1);
    expect(articles[0].url).toBe('https://example.com/news/item');
    expect(articles[0].description).toBe('Latest report .');
    expect(() => rss.parseXMLRSS('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss><channel/></rss>', feed.url, feed.name)).toThrow(/unsafe/i);
    expect(() => rss.parseXMLRSS('<rss><channel></rss>', feed.url, feed.name)).toThrow(/XML/i);
    expect(() => rss.parseXMLRSS('<html><body>Not a feed</body></html>', feed.url, feed.name)).toThrow(/feed/i);
  });
  it('keeps valid RSS items when a sibling date or field is malformed', () => {
    expect(rss.parseXMLRSS).toBeTypeOf('function');
    const articles = rss.parseXMLRSS(`<rss version="2.0"><channel><title>Defense News</title>
      <item><title>Navy &amp; allies</title><link>https://example.com/navy</link><pubDate>bad</pubDate><description><![CDATA[<p>${'x'.repeat(900)}</p>]]></description></item>
      <item><title>Army report</title><link>https://example.com/army</link><pubDate>Sat, 14 Nov 2026 12:00:00 GMT</pubDate></item>
      <item><title>Unsafe</title><link>javascript:bad</link></item>
    </channel></rss>`, feed.url, feed.name);
    expect(articles).toHaveLength(2);
    expect(articles[0].title).toBe('Navy & allies');
    expect(articles[0].publishedAt).toBeNull();
    expect(articles[0].description).toHaveLength(250);
    expect(articles[0]).not.toHaveProperty('content');
    expect(articles[1].publishedAt).toBe('2026-11-14T12:00:00.000Z');
  });
});
