import { beforeEach, describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { fetchFromRSSFeeds, clearRSSCache } from './rssService';
let fetchNews, clearCache;
import { installStorage } from './testStorage';

vi.mock('axios');
vi.mock('./rssService', () => ({ fetchFromRSSFeeds: vi.fn(), clearRSSCache: vi.fn(() => ({ success: true })) }));

const article = (title = 'Military Confronts Major Cyberattack', path = 'cyberattack') => ({
  title, description: 'A cyberattack targeted military infrastructure.',
  source: { id: 'test-news', name: 'Test News' }, url: `https://example.com/${path}`,
});
const rssResult = (articles = []) => ({ success: true, articles, source: 'RSS Feeds', cached: false, stale: false, fetchedAt: new Date().toISOString(), feedHealth: [{ id: 'test-news', name: 'Test News', status: 'ok', articleCount: articles.length }] });

beforeEach(async () => {
  vi.resetModules();
  ({ fetchNews, clearCache } = await import('./newsApi'));
  installStorage();
  vi.clearAllMocks();
  clearCache();
});

describe('fetchNews', () => {
  it('preserves saved NewsAPI provenance with current failed-refresh feed health', async () => {
    const { writePool } = await import('./storage');
    localStorage.setItem('military_newsapi_key', 'fixture-key');
    const fetchedAt = new Date(Date.now() - 3600000).toISOString();
    const savedHealth = [{ id: 'newsapi', name: 'NewsAPI', status: 'ok', articleCount: 1 }];
    expect(writePool('military_info_cache_pool_1_0', { articles: [article()], fetchedAt, feedHealth: savedHealth, source: 'NewsAPI' }).success).toBe(true);
    const rssHealth = [{ id: 'test-news', name: 'Test News', status: 'error', articleCount: 0 }];
    fetchFromRSSFeeds.mockResolvedValue({ success: false, articles: [], source: 'RSS Feeds', cached: false, stale: false, fetchedAt: null, feedHealth: rssHealth, error: 'offline' });
    axios.get.mockRejectedValue(new Error('offline fixture'));
    const result = await fetchNews();
    expect(result).toMatchObject({ success: true, cached: true, stale: true, fetchedAt, source: 'NewsAPI' });
    expect(result.articles.map(item => item.title)).toEqual([article().title]);
    expect(result.feedHealth).toEqual([...rssHealth, { id: 'newsapi', name: 'NewsAPI', status: 'error', articleCount: 0 }]);
  });

  it('excludes fresh cached RSS from a live optional-provider pool and its persisted cache', async () => {
    localStorage.setItem('military_newsapi_key', 'key');
    const fetchedAt = new Date(Date.now() - 120000).toISOString();
    fetchFromRSSFeeds.mockResolvedValue({ ...rssResult([article('Cached Navy report', 'cached')]), cached: true, fetchedAt });
    axios.get.mockResolvedValue({ data: { status: 'ok', articles: [article('Live Army report', 'live')] } });
    const result = await fetchNews();
    expect(result.articles.map(a => a.title)).toEqual(['Live Army report']);
    expect(result).toMatchObject({ cached: false, stale: false, source: 'NewsAPI' });
    const stored = JSON.parse(localStorage.getItem('military_info_cache_pool_1_0'));
    expect(stored.articles.map(a => a.title)).toEqual(['Live Army report']);
  });

  it('reports blocked custom-key reads rather than claiming no providers are configured', async () => {
    const { getCustomKeys } = await import('./newsApi');
    localStorage.getItem = () => { throw new Error('blocked'); };
    expect(getCustomKeys()).toMatchObject({ storageError: 'Unable to read browser storage.' });
  });

  it('surfaces browser-storage failures without discarding usable fetched news', async () => {
    fetchFromRSSFeeds.mockResolvedValue({ ...rssResult([article()]), storageWarnings: ['RSS storage warning'] });
    localStorage.setItem('military_info_cache_old', 'old');
    localStorage.getItem = () => { throw new Error('blocked'); };
    localStorage.setItem = () => { throw new Error('blocked'); };
    localStorage.removeItem = () => { throw new Error('blocked'); };
    const result = await fetchNews('', 200, { force: true });
    expect(result.success).toBe(true);
    expect(result.articles).toHaveLength(1);
    expect(result.storageWarnings).toEqual(expect.arrayContaining(['Unable to read browser storage.', 'Unable to save browser storage.', 'Unable to clear browser storage.', 'RSS storage warning']));
  });

  it('keeps optional-provider cooldowns independent across forced refresh when storage is blocked', async () => {
    vi.resetModules();
    const { fetchNews: fetch } = await import('./newsApi');
    localStorage.setItem('military_newsapi_key', 'key');
    localStorage.setItem('military_thenewsapi_key', 'key');
    localStorage.setItem = () => { throw new Error('quota'); };
    fetchFromRSSFeeds.mockResolvedValue(rssResult([]));
    axios.get.mockImplementation(url => url.includes('newsapi.org')
      ? Promise.reject({ response: { status: 429, headers: { 'retry-after': '60' } } })
      : Promise.resolve({ data: { data: [article()] } }));
    const first = await fetch();
    expect(first.storageWarnings).toContain('Unable to save browser storage.');
    const read = localStorage.getItem;
    localStorage.getItem = key => {
      if (key.includes('retry_after')) throw new Error('blocked');
      return read(key);
    };
    const second = await fetch('', 200, { force: true });
    expect(second.storageWarnings).toContain('Unable to read browser storage.');
    expect(axios.get.mock.calls.filter(([url]) => url.includes('newsapi.org'))).toHaveLength(1);
    expect(axios.get.mock.calls.filter(([url]) => url.includes('thenewsapi.com'))).toHaveLength(2);
  });

  it('keeps a persisted provider cooldown through blocked reads on forced refresh until expiry', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
      localStorage.setItem('military_newsapi_key', 'fixture-key');
      localStorage.setItem('military_info_provider_retry_after_newsapi', String(Date.parse('2026-11-17T00:02:00Z')));
      fetchFromRSSFeeds.mockResolvedValue(rssResult([]));
      axios.get.mockResolvedValue({ data: { status: 'ok', articles: [] } });
      const first = await fetchNews();
      expect(first.feedHealth.find(item => item.id === 'newsapi').status).toBe('rate-limited');
      expect(axios.get).not.toHaveBeenCalled();
      const read = localStorage.getItem;
      localStorage.getItem = key => {
        if (key.includes('retry_after')) throw new Error('blocked fixture');
        return read(key);
      };
      vi.setSystemTime(new Date('2026-11-17T00:01:59Z'));
      const second = await fetchNews('', 200, { force: true });
      expect(second.storageWarnings).toContain('Unable to read browser storage.');
      expect(axios.get).not.toHaveBeenCalled();
      expect(second.feedHealth.find(item => item.id === 'newsapi').status).toBe('rate-limited');
      vi.setSystemTime(new Date('2026-11-17T00:02:00Z'));
      await fetchNews('', 200, { force: true });
      expect(axios.get).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it('honors optional-provider HTTP-date Retry-After until its exact expiry', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
      localStorage.setItem('military_thenewsapi_key', 'key');
      fetchFromRSSFeeds.mockResolvedValue(rssResult([]));
      axios.get.mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': 'Tue, 17 Nov 2026 00:02:00 GMT' } } }).mockResolvedValue({ data: { data: [] } });
      await fetchNews();
      expect(localStorage.getItem('military_info_provider_retry_after_thenewsapi')).toBe(String(Date.parse('2026-11-17T00:02:00Z')));
      vi.setSystemTime(new Date('2026-11-17T00:01:59Z'));
      await fetchNews('', 200, { force: true });
      expect(axios.get).toHaveBeenCalledTimes(1);
      vi.setSystemTime(new Date('2026-11-17T00:02:00Z'));
      await fetchNews('', 200, { force: true });
      expect(axios.get).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });

  it('preserves the earliest live source timestamp in a merged cache', async () => {
    localStorage.setItem('military_newsapi_key', 'key');
    const fetchedAt = new Date(Date.now() - 120000).toISOString();
    fetchFromRSSFeeds.mockResolvedValue({ ...rssResult([article('Navy report', 'navy')]), fetchedAt });
    axios.get.mockResolvedValue({ data: { status: 'ok', articles: [article('Army report', 'army')] } });
    const result = await fetchNews();
    expect(result.fetchedAt).toBe(fetchedAt);
    expect(JSON.parse(localStorage.getItem('military_info_cache_pool_1_0')).fetchedAt).toBe(fetchedAt);
  });

  it('includes storageWarnings on cancelled fetch results without touching storage', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await fetchNews('', 200, { signal: controller.signal });
    expect(result.storageWarnings).toEqual([]);
  });

  it('does not persist an interrupted RSS pool as a complete fresh merged cache', async () => {
    fetchFromRSSFeeds.mockResolvedValue({ ...rssResult([article()]), feedHealth: [{ id: 'late-feed', name: 'Late feed', status: 'timeout', articleCount: 0 }] });
    const result = await fetchNews('', 200);
    expect(result.articles).toHaveLength(1);
    expect(localStorage.getItem('military_info_cache_pool_0_0')).toBeNull();
  });

  it('reports optional configured providers as pending during RSS progress', async () => {
    localStorage.setItem('military_newsapi_key', 'key');
    let finish;
    axios.get.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    fetchFromRSSFeeds.mockImplementation(async (limit, options) => { options.onProgress(rssResult([article()])); return rssResult([article()]); });
    const progress = vi.fn();
    const request = fetchNews('', 200, { onProgress: progress });
    try { await vi.waitFor(() => expect(progress.mock.calls[0][0].feedHealth.find(f => f.id === 'newsapi')?.status).toBe('pending')); }
    finally { finish({ data: { status: 'ok', articles: [] } }); }
    await request;
  });

  it('distinguishes optional provider rate limits from generic network failures', async () => {
    localStorage.setItem('military_newsapi_key', 'key');
    fetchFromRSSFeeds.mockResolvedValue({ success: false, articles: [], source: 'RSS Feeds', cached: false, stale: false, fetchedAt: null, feedHealth: [], error: 'offline' });
    axios.get.mockRejectedValue({ response: { status: 429 } });
    const result = await fetchNews('', 200);
    expect(result.success).toBe(false);
    expect(result.feedHealth.find(f => f.id === 'newsapi').status).toBe('rate-limited');
  });

  it('does not restore merged caches after a user clears them during an in-flight fetch', async () => {
    let finish;
    fetchFromRSSFeeds.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const request = fetchNews('', 200);
    clearCache();
    finish(rssResult([article()]));
    await request;
    expect(localStorage.getItem('military_info_cache_pool_0_0')).toBeNull();
  });

  it('keeps fetched articles when a consumer progress callback throws', async () => {
    fetchFromRSSFeeds.mockResolvedValue(rssResult([article()]));
    const result = await fetchNews('', 200, { onProgress: () => { throw new Error('render'); } });
    expect(result.success).toBe(true);
    expect(result.articles).toHaveLength(1);
  });

  it('returns an honest failure object when the RSS adapter unexpectedly rejects', async () => {
    fetchFromRSSFeeds.mockRejectedValue(new Error('adapter crashed'));
    const result = await fetchNews('', 200);
    expect(result).toMatchObject({ success: false, articles: [], cached: false, stale: false, fetchedAt: null });
    expect(result.error).toEqual(expect.any(String));
  });

  it('refuses already-cancelled requests even when the merged cache is fresh', async () => {
    fetchFromRSSFeeds.mockResolvedValue(rssResult([article()]));
    await fetchNews('', 200);
    const controller = new AbortController();
    controller.abort();
    const result = await fetchNews('', 200, { signal: controller.signal });
    expect(result.success).toBe(false);
    expect(result.articles).toEqual([]);
    expect(fetchFromRSSFeeds).toHaveBeenCalledTimes(1);
  });

  it('does not silently relabel stale RSS stories as fresh when another provider succeeds', async () => {
    localStorage.setItem('military_newsapi_key', 'key');
    const old = new Date(Date.now() - 3600000).toISOString();
    fetchFromRSSFeeds.mockResolvedValue({ ...rssResult([article('Old Navy report', 'old')]), stale: true, cached: true, fetchedAt: old });
    axios.get.mockResolvedValue({ data: { status: 'ok', articles: [article('Live Army report', 'new')] } });
    const result = await fetchNews('', 200);
    expect(result.articles.map(a => a.title)).toEqual(['Live Army report']);
    expect(result.stale).toBe(false);
  });

  it('labels newly fetched API articles as live even when RSS supplied stale cache', async () => {
    localStorage.setItem('military_newsapi_key', 'key');
    const old = new Date(Date.now() - 3600000).toISOString();
    fetchFromRSSFeeds.mockResolvedValue({ ...rssResult([]), stale: true, cached: true, fetchedAt: old, error: 'RSS offline' });
    axios.get.mockResolvedValue({ data: { status: 'ok', articles: [article()] } });
    const result = await fetchNews('', 200);
    expect(result.stale).toBe(false);
    expect(result.cached).toBe(false);
    expect(result.source).toContain('NewsAPI');
    expect(result.error).toBeUndefined();
  });

  it('aborts optional API transports promptly without accepting late articles', async () => {
    localStorage.setItem('military_newsapi_key', 'key');
    fetchFromRSSFeeds.mockResolvedValue(rssResult([]));
    const controller = new AbortController();
    let finish;
    axios.get.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const progress = vi.fn();
    const request = fetchNews('', 200, { signal: controller.signal, onProgress: progress });
    await vi.waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    controller.abort();
    const result = await request;
    expect(result.success).toBe(false);
    expect(result.articles).toEqual([]);
    const count = progress.mock.calls.length;
    finish({ data: { status: 'ok', articles: [article()] } });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(progress).toHaveBeenCalledTimes(count);
  });

  it('publishes optional API articles immediately without waiting for the RSS pool', async () => {
    localStorage.setItem('military_newsapi_key', 'key');
    let finishRSS;
    fetchFromRSSFeeds.mockImplementation(() => new Promise(resolve => { finishRSS = resolve; }));
    axios.get.mockResolvedValue({ data: { status: 'ok', articles: [article('Army supply report', 'army')] } });
    const progress = vi.fn();
    const request = fetchNews('', 200, { onProgress: progress });
    try {
      await vi.waitFor(() => expect(progress.mock.calls.some(([result]) => result.articles.length === 1)).toBe(true));
    } finally { finishRSS(rssResult([])); }
    const result = await request;
    expect(result.articles).toHaveLength(1);
  });

  it('uses expired merged cache honestly when every live provider fails', async () => {
    const { writePool } = await import('./storage');
    const fetchedAt = new Date(Date.now() - 3600000).toISOString();
    writePool('military_info_cache_pool_0_0', { articles: [article()], fetchedAt, feedHealth: [], source: 'RSS Feeds' });
    fetchFromRSSFeeds.mockResolvedValue({ success: false, articles: [], source: 'RSS Feeds', cached: false, stale: false, fetchedAt: null, feedHealth: [], error: 'offline' });
    const progress = vi.fn();
    const result = await fetchNews('', 200, { onProgress: progress });
    expect(result).toMatchObject({ success: true, cached: true, stale: true, fetchedAt });
    expect(result.articles).toHaveLength(1);
    expect(progress.mock.calls[0][0]).toMatchObject({ cached: true, stale: true, fetchedAt });
  });

  it('caches the complete merged pool before applying query and page-size selection', async () => {
    localStorage.setItem('military_newsapi_key', 'key');
    fetchFromRSSFeeds.mockResolvedValue(rssResult([article('Navy report', 'navy')]));
    axios.get.mockResolvedValue({ data: { status: 'ok', articles: [article('Army supply conference', 'army')] } });
    const first = await fetchNews('navy', 1);
    const second = await fetchNews('army', 200);
    expect(first.articles.map(a => a.title)).toEqual(['Navy report']);
    expect(second.articles.map(a => a.title)).toEqual(['Army supply conference']);
    expect(second.cached).toBe(true);
    expect(second.fetchedAt).toBe(first.fetchedAt);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(fetchFromRSSFeeds).toHaveBeenCalledTimes(1);
  });

  it('supports a user TheNewsAPI key while rejecting unrelated general-provider stories with boundary-aware relevance', async () => {
    localStorage.setItem('military_thenewsapi_key', 'optional-key');
    fetchFromRSSFeeds.mockResolvedValue(rssResult([]));
    axios.get.mockResolvedValue({ data: { data: [
      { title: 'Army food supply conference', description: 'military logistics', url: 'https://example.com/army', published_at: 'bad', source: 'Report' },
      { title: 'Award for tankless water technology', url: 'https://example.com/award', source: 'Report' },
      { title: 'Military team football score', url: 'https://espn.com/scores', source: 'ESPN' },
    ] } });
    const result = await fetchNews('', 200);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][1].params.api_token).toBe('optional-key');
    expect(result.articles.map(a => a.title)).toEqual(['Army food supply conference']);
    expect(result.feedHealth.find(feed => feed.id === 'thenewsapi').status).toBe('ok');
  });

  it('uses an optional user NewsAPI key and preserves military stories formerly rejected by substring filters', async () => {
    localStorage.setItem('military_newsapi_key', 'user-key');
    fetchFromRSSFeeds.mockResolvedValue({ success: false, articles: [], source: 'RSS Feeds', cached: false, stale: false, fetchedAt: null, feedHealth: [], error: 'unavailable' });
    axios.get.mockResolvedValue({ data: { status: 'ok', articles: [article('Navy missile interception during hurricane relief', 'navy'), article('Military SpaceX satellite deployment', 'space')] } });
    const result = await fetchNews('', 200);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][1].headers['X-Api-Key']).toBe('user-key');
    expect(result.articles).toHaveLength(2);
    expect(result.success).toBe(true);
    expect(result.feedHealth.find(feed => feed.id === 'newsapi').status).toBe('ok');
  });

  it('filters progressive RSS updates with the same shared query selection as the final response', async () => {
    const progress = vi.fn();
    fetchFromRSSFeeds.mockImplementation(async (limit, options) => {
      options.onProgress(rssResult([article('Navy hurricane relief', 'navy'), article('Army supplies', 'army')]));
      return rssResult([article('Navy hurricane relief', 'navy'), article('Army supplies', 'army')]);
    });
    const result = await fetchNews('navy hurricane', 200, { onProgress: progress });
    expect(progress.mock.calls[0][0].articles.map(a => a.title)).toEqual(['Navy hurricane relief']);
    expect(result.articles).toEqual(progress.mock.calls[0][0].articles);
    expect(result.articles[0].id).toBe('https://example.com/navy');
  });

  it('force refresh clears all news and RSS caches before fetching while preserving bookmarks and user keys', async () => {
    localStorage.setItem('military_info_cache_old', 'bad');
    localStorage.setItem('military_info_rss_cache:old', 'bad');
    localStorage.setItem('military_info_rss_cache', 'legacy');
    localStorage.setItem('military_bookmarks', 'keep');
    localStorage.setItem('military_newsapi_key', 'keep-key');
    fetchFromRSSFeeds.mockResolvedValue(rssResult([]));
    await fetchNews('', 200, { force: true });
    expect(localStorage.getItem('military_info_cache_old')).toBeNull();
    expect(localStorage.getItem('military_info_rss_cache:old')).toBeNull();
    expect(localStorage.getItem('military_info_rss_cache')).toBeNull();
    expect(localStorage.getItem('military_bookmarks')).toBe('keep');
    expect(localStorage.getItem('military_newsapi_key')).toBe('keep-key');
    expect(clearRSSCache).toHaveBeenCalled();
    expect(fetchFromRSSFeeds.mock.calls[0][1].force).toBe(true);
  });

  it('safely manages only user-entered API keys even when browser storage is blocked', async () => {
    const { getCustomKeys, saveCustomKeys, clearCustomKeys } = await import('./newsApi');
    expect(getCustomKeys).toBeTypeOf('function');
    expect(saveCustomKeys(' user-key ', '')).toEqual({ success: true });
    expect(getCustomKeys()).toEqual({ newsApiKey: 'user-key', theNewsApiKey: '' });
    expect(clearCustomKeys()).toEqual({ success: true });
    expect(getCustomKeys()).toEqual({ newsApiKey: '', theNewsApiKey: '' });
    localStorage.getItem = () => { throw new Error('blocked'); };
    localStorage.setItem = () => { throw new Error('blocked'); };
    localStorage.removeItem = () => { throw new Error('blocked'); };
    expect(getCustomKeys()).toEqual({ newsApiKey: '', theNewsApiKey: '' });
    expect(saveCustomKeys('key', '')).toMatchObject({ success: false });
    expect(clearCustomKeys()).toMatchObject({ success: false });
  });
  it('returns a successful empty result for a genuine RSS search miss without inventing fallback stories', async () => {
    fetchFromRSSFeeds.mockResolvedValue(rssResult([article()]));
    const result = await fetchNews('nonexistent-phrase', 200);
    expect(fetchFromRSSFeeds).toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.articles).toEqual([]);
  });
});
