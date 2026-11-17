import axios from 'axios';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { normalizeArticle, plainText, safeURL, selectArticles } from './articleUtils';
import { readPool, writePool, CACHE_TTL, clearStoredCaches, getCacheGeneration } from './storage';
import { cooldownActive, setCooldown } from './retryCooldown';

import { FEEDS } from './feeds';
import { runRequest, emitProgress } from './requestUtils';

const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json';
const isRegistered = feed => FEEDS.some(registered => registered.id === feed.id && registered.url === feed.url);

const nodes = (children, name) => (children ?? []).filter(node => Object.hasOwn(node, name));
const first = (children, ...names) => names.map(name => nodes(children, name)[0]).find(Boolean);
const children = node => node ? node[Object.keys(node).find(key => key !== ':@')] : [];
const baseURL = (node, inherited) => node?.[':@']?.['@_base'] ? safeURL(node[':@']['@_base'], inherited) : inherited;
const text = value => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(text).join('');
  if (!value || typeof value !== 'object') return '';
  return Object.entries(value).filter(([key]) => ![':@', 'script', 'style'].includes(key)).map(([key, child]) =>
    ['p', 'div', 'br', 'li'].includes(key) ? ` ${text(child)} ` : text(child)).join('');
};
export const parseXMLRSS = (xmlText, feedUrl, defaultFeedName) => {
  if (typeof xmlText !== 'string' || xmlText.length > 2000000 || /<!\s*(DOCTYPE|ENTITY)/i.test(xmlText)) throw new Error('Unsafe XML document.');
  if (XMLValidator.validate(xmlText) !== true) throw new Error('Malformed XML document.');
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, removeNSPrefix: true, processEntities: true, preserveOrder: true, trimValues: false }).parse(xmlText);
  const root = first(parsed, 'rss', 'RDF', 'feed');
  const atom = root && Object.hasOwn(root, 'feed');
  const channel = first(children(root), 'channel');
  if (!root || (Object.hasOwn(root, 'rss') && !channel)) throw new Error('Document is not an RSS or Atom feed.');
  const items = nodes(atom || Object.hasOwn(root, 'RDF') ? children(root) : children(channel), atom ? 'entry' : 'item');
  const rootBase = baseURL(root, feedUrl);
  return items.map(item => {
    const fields = children(item);
    const itemBase = baseURL(item, rootBase);
    const link = atom ? nodes(fields, 'link').find(link => !link[':@']?.['@_rel'] || link[':@']['@_rel'] === 'alternate') : first(fields, 'link');
    const media = nodes(fields, 'content').find(node => node[':@']?.['@_url']) ?? first(fields, 'enclosure', 'thumbnail');
    return normalizeArticle({
      title: text(first(fields, 'title')), description: ['description', 'encoded', 'summary', 'content'].map(name => plainText(text(first(fields, name)))).find(Boolean) || '',
      url: safeURL(atom ? link?.[':@']?.['@_href'] : text(link), atom ? baseURL(link, itemBase) : feedUrl),
      publishedAt: text(first(fields, 'pubDate', 'date', 'published', 'updated')).trim(),
      urlToImage: safeURL(media?.[':@']?.['@_url'], atom ? baseURL(media, itemBase) : feedUrl),
    }, { name: defaultFeedName || text(first(children(channel ?? root), 'title')) });
  }).filter(Boolean);
};



export const fetchSingleRSSFeed = async (feed, { signal, timeoutMs = 5000, converterBlocked = () => false } = {}) => {
  if (isRegistered(feed)) {
    try {
      const response = await runRequest(requestSignal => axios.get('/api/feeds', { params: { id: feed.id }, timeout: timeoutMs, signal: requestSignal }), { signal, timeoutMs });
      const data = response.data;
      if (typeof data === 'string' && /<!doctype html|<html/i.test(data)) throw Object.assign(new Error('Local endpoint unavailable.'), { localEndpointMissing: true });
      if (!Array.isArray(data?.articles) || !Number.isFinite(Date.parse(data.fetchedAt)) || Date.parse(data.fetchedAt) > Date.now() || Date.now() - Date.parse(data.fetchedAt) >= CACHE_TTL) throw new Error('Invalid feed endpoint response.');
      const articles = data.articles.map(item => normalizeArticle(item, feed)).filter(Boolean);
      Object.defineProperty(articles, 'fetchedAt', { value: new Date(data.fetchedAt).toISOString() });
      return articles;
    } catch (error) {
      if (signal?.aborted || (!error.localEndpointMissing && error.response?.status !== 404)) throw Object.assign(error, { transport: 'endpoint', retryScope: feed.url });
    }
  }
  if (converterBlocked()) throw Object.assign(new Error('Converter cooldown active.'), { response: { status: 429 }, transport: 'rss2json', retryScope: RSS2JSON_API, cooldown: true });
  try {
    const response = await runRequest(requestSignal => axios.get(RSS2JSON_API, { params: { rss_url: feed.url }, timeout: timeoutMs, signal: requestSignal }), { signal, timeoutMs });
    if (response.data?.status !== 'ok' || !Array.isArray(response.data.items)) throw new Error('RSS service rejected feed.');
    return response.data.items.filter(item => item && typeof item === 'object').map(item => normalizeArticle({
      title: item.title, description: item.description || item.content, url: item.link,
      urlToImage: item.thumbnail || item.enclosure?.link, publishedAt: item.pubDate,
    }, feed)).filter(Boolean);
  } catch (error) {
    if (signal?.aborted || error.code === 'ERR_CANCELED' || error.response?.status === 429) throw Object.assign(error, { transport: 'rss2json', retryScope: RSS2JSON_API });
    try {
      const response = await runRequest(requestSignal => axios.get(feed.url, { responseType: 'text', timeout: timeoutMs, signal: requestSignal }), { signal, timeoutMs });
      return parseXMLRSS(response.data, feed.url, feed.name).map(article => normalizeArticle(article, feed)).filter(Boolean);
    } catch (directError) { throw Object.assign(directError, { transport: 'publisher', retryScope: feed.url }); }
  }
};



function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Request cancelled.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
}

export const fetchFromRSSFeeds = async (limit = 200, { feeds = FEEDS, concurrency = 3, minIntervalMs = 150, deadlineMs = 18000, signal, onProgress, force = false } = {}) => {
  if (signal?.aborted) return { success: false, articles: [], source: 'RSS Feeds', cached: false, stale: false, fetchedAt: null, storageWarnings: [], feedHealth: feeds.map(feed => ({ id: feed.id, name: feed.name, status: 'cancelled', articleCount: 0 })), error: 'Request cancelled.' };
  const cacheKey = 'military_info_rss_cache:' + feeds.map(feed => feed.url).join('|');
  const storageWarnings = [];
  const warn = error => { if (error && !storageWarnings.includes(error)) storageWarnings.push(error); };
  if (force) warn(clearRSSCache().error);
  const generation = getCacheGeneration();
  const cached = force ? null : readPool(cacheKey, { onStorageError: warn });
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < CACHE_TTL) return { ...cached, storageWarnings: [...storageWarnings], success: true, cached: true, stale: false, articles: cached.articles.slice(0, limit) };
  if (cached && !signal?.aborted) emitProgress(onProgress, { ...cached, storageWarnings: [...storageWarnings], success: true, cached: true, stale: true, articles: cached.articles.slice(0, limit) });
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, deadlineMs);
  const health = feeds.map(feed => ({ id: feed.id || feed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: feed.name, status: 'pending', articleCount: 0 }));
  const pool = [];
  let cursor = 0;
  let nextStart = 0;
  let fetchedAt = null;
  let rateLimited = cooldownActive('military_info_rss_retry_after', warn);
  const result = () => ({ success: health.some(feed => ['ok', 'empty'].includes(feed.status)), articles: selectArticles(pool).slice(0, limit), source: 'RSS Feeds', cached: false, stale: false, fetchedAt, feedHealth: health.map(feed => ({ ...feed })), storageWarnings: [...storageWarnings] });
  const publish = () => {
    if (controller.signal.aborted || typeof onProgress !== 'function') return;
    const current = result();
    emitProgress(onProgress, !current.success && cached ? { ...current, success: true, articles: cached.articles.slice(0, limit), cached: true, stale: true, fetchedAt: cached.fetchedAt } : current);
  };
  const worker = async () => {
    while (cursor < feeds.length && !controller.signal.aborted) {
      const index = cursor++;
      const delay = Math.max(0, nextStart - Date.now());
      nextStart = Math.max(Date.now(), nextStart) + minIntervalMs;
      try {
        if (delay) await abortable(new Promise(resolve => setTimeout(resolve, delay)), controller.signal);
        if (controller.signal.aborted) break;
        if (cooldownActive(`military_info_feed_retry_after_${feeds[index].url}`, warn)) {
          health[index].status = 'rate-limited';
          publish();
          continue;
        }
        const articles = await abortable(fetchSingleRSSFeed(feeds[index], { signal: controller.signal, converterBlocked: () => rateLimited }), controller.signal);
        pool.push(...articles);
        const receivedAt = articles.fetchedAt || new Date().toISOString();
        fetchedAt = !fetchedAt || Date.parse(receivedAt) < Date.parse(fetchedAt) ? receivedAt : fetchedAt;
        Object.assign(health[index], { status: articles.length ? 'ok' : 'empty', articleCount: articles.length, fetchedAt: receivedAt });
      } catch (error) {
        if (error.response?.status === 429 && error.transport !== 'rss2json') setCooldown(`military_info_feed_retry_after_${feeds[index].url}`, error.response.headers?.['retry-after'], warn);
        if (error.response?.status === 429 && error.transport === 'rss2json' && !error.cooldown) {
          setCooldown('military_info_rss_retry_after', error.response.headers?.['retry-after'], warn);
        }
        rateLimited = (error.response?.status === 429 && error.transport === 'rss2json') || rateLimited;
        const transportTimeout = error.name === 'TimeoutError' || error.code === 'ETIMEDOUT' || (error.code === 'ECONNABORTED' && /\btimeout\b/i.test(error.message));
        health[index].status = error.response?.status === 429 ? 'rate-limited' : controller.signal.aborted ? (signal?.aborted ? 'cancelled' : 'timeout') : transportTimeout ? 'timeout' : 'error';
      }
      publish();
    }
  };
  await Promise.all(Array.from({ length: Math.min(feeds.length, Math.max(1, Math.min(6, concurrency))) }, worker));
  clearTimeout(timer);
  signal?.removeEventListener('abort', abort);
  if (controller.signal.aborted) health.forEach(feed => { if (feed.status === 'pending') feed.status = signal?.aborted ? 'cancelled' : 'timeout'; });
  const completed = result();
  if (signal?.aborted) return { ...completed, success: false, articles: [], error: 'Request cancelled.' };
  if (completed.success && !controller.signal.aborted && generation === getCacheGeneration()) warn(writePool(cacheKey, { ...completed, articles: selectArticles(pool) }).error);
  completed.storageWarnings = [...storageWarnings];
  if (!completed.success && cached && !signal?.aborted) return { ...completed, success: true, articles: cached.articles.slice(0, limit), cached: true, stale: true, fetchedAt: cached.fetchedAt, error: 'Live feeds unavailable; showing saved snippets.' };
  if (!completed.success) completed.error = signal?.aborted ? 'Request cancelled.' : 'No live feeds available.';
  return completed;
};

export const clearRSSCache = () => clearStoredCaches();
export default { fetchFromRSSFeeds, clearRSSCache };
