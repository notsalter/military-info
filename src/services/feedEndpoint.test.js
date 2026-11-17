import { beforeEach, expect, it, vi } from 'vitest';
import axios from 'axios';
import './testStorage';
import { FEEDS } from './feeds';
import { fetchSingleRSSFeed, fetchFromRSSFeeds } from './rssService';
vi.mock('axios');
beforeEach(() => vi.clearAllMocks());

it('uses the fixed-ID same-origin endpoint for registered feeds and preserves original fetched time', async () => {
  const fetchedAt = new Date(Date.now() - 120000).toISOString();
  axios.get.mockResolvedValue({ data: { articles: [{ title: 'TEST FIXTURE: Naval report', url: 'https://example.com/naval', description: 'x'.repeat(600) }], fetchedAt, source: { id: FEEDS[0].id, name: FEEDS[0].name } } });
  const result = await fetchFromRSSFeeds(200, { feeds: [FEEDS[0]], minIntervalMs: 0 });
  expect(axios.get.mock.calls[0][0]).toBe('/api/feeds');
  expect(axios.get.mock.calls[0][1].params).toEqual({ id: FEEDS[0].id });
  expect(result.articles[0].description).toHaveLength(250);
  expect(result.articles[0].source.id).toBe(FEEDS[0].id);
  expect(result.fetchedAt).toBe(fetchedAt);
});

it('falls back to keyless converter only when local static preview has no endpoint', async () => {
  axios.get.mockRejectedValueOnce({ response: { status: 404 } }).mockResolvedValueOnce({ data: { status: 'ok', items: [{ title: 'TEST FIXTURE: Local naval report', link: 'https://example.com/local' }] } });
  const articles = await fetchSingleRSSFeed(FEEDS[0]);
  expect(articles).toHaveLength(1);
  expect(axios.get.mock.calls.map(([url]) => url)).toEqual(['/api/feeds', 'https://api.rss2json.com/v1/api.json']);
});

it('does not bypass a deployed endpoint error with external converter requests', async () => {
  axios.get.mockRejectedValue({ response: { status: 502 } });
  await expect(fetchSingleRSSFeed(FEEDS[0])).rejects.toMatchObject({ response: { status: 502 } });
  expect(axios.get).toHaveBeenCalledTimes(1);
});

it.each([
  ['exact TTL boundary', '2026-11-16T23:45:00.000Z'],
  ['one hour old', '2026-11-16T23:00:00.000Z'],
  ['from 2020', '2020-01-01T00:00:00.000Z'],
])('rejects an expired endpoint timestamp %s without external fallback or fresh caching', async (_, fetchedAt) => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
    axios.get.mockResolvedValue({ data: { articles: [{ title: 'TEST FIXTURE: Old naval report', url: 'https://example.com/old-naval' }], fetchedAt } });
    const result = await fetchFromRSSFeeds(200, { feeds: [FEEDS[0]], minIntervalMs: 0 });
    expect(result).toMatchObject({ success: false, articles: [], fetchedAt: null });
    expect(result.feedHealth[0].status).toBe('error');
    expect(axios.get.mock.calls.map(([url]) => url)).toEqual(['/api/feeds']);
    expect(localStorage.getItem('military_info_rss_cache:' + FEEDS[0].url)).toBeNull();
  } finally { vi.useRealTimers(); }
});

it.each([
  ['current', '2026-11-17T00:00:00.000Z'],
  ['warm', '2026-11-16T23:58:00.000Z'],
  ['just inside TTL', '2026-11-16T23:45:00.001Z'],
])('preserves the original %s endpoint timestamp in results and cache', async (_, fetchedAt) => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
    axios.get.mockResolvedValue({ data: { articles: [{ title: 'TEST FIXTURE: Naval report', url: 'https://example.com/naval' }], fetchedAt } });
    const result = await fetchFromRSSFeeds(200, { feeds: [FEEDS[0]], minIntervalMs: 0 });
    expect(result).toMatchObject({ success: true, cached: false, stale: false, fetchedAt });
    expect(result.feedHealth[0]).toMatchObject({ status: 'ok', fetchedAt });
    expect(JSON.parse(localStorage.getItem('military_info_rss_cache:' + FEEDS[0].url)).fetchedAt).toBe(fetchedAt);
    expect(axios.get).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});

it('accepts a genuinely empty recent 200 endpoint response without redating it', async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-11-17T00:00:00Z'));
    const fetchedAt = '2026-11-16T23:58:00.000Z';
    axios.get.mockResolvedValue({ status: 200, data: { articles: [], fetchedAt } });
    const result = await fetchFromRSSFeeds(200, { feeds: [FEEDS[0]], minIntervalMs: 0 });
    expect(result).toMatchObject({ success: true, articles: [], cached: false, stale: false, fetchedAt });
    expect(result.feedHealth[0]).toMatchObject({ status: 'empty', fetchedAt });
    expect(JSON.parse(localStorage.getItem('military_info_rss_cache:' + FEEDS[0].url)).fetchedAt).toBe(fetchedAt);
    expect(axios.get).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});

it('rejects invalid endpoint timestamps without pretending they were fetched now', async () => {
  axios.get.mockResolvedValue({ data: { articles: [], fetchedAt: 'unknown' } });
  await expect(fetchSingleRSSFeed(FEEDS[0])).rejects.toThrow('Invalid feed endpoint response.');
  expect(axios.get).toHaveBeenCalledTimes(1);
});
