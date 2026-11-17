import axios from 'axios';
import { runRequest, emitProgress } from './requestUtils';
import { cooldownActive, setCooldown } from './retryCooldown';
import { fetchFromRSSFeeds, clearRSSCache } from './rssService';
import { selectArticles, isMilitaryArticle } from './articleUtils';
import { safeGet, safeSet, safeRemove, clearStoredCaches, readPool, writePool, CACHE_TTL, getCacheGeneration } from './storage';

export const getCustomKeys = () => {
  const news = safeGet('military_newsapi_key');
  const other = safeGet('military_thenewsapi_key');
  const result = { newsApiKey: news.value || '', theNewsApiKey: other.value || '' };
  const failure = [news, other].find(read => !read.success);
  if (failure) Object.defineProperty(result, 'storageError', { value: failure.error });
  return result;
};
export const saveCustomKeys = (newsApiKey, theNewsApiKey) => {
  const results = [safeSet('military_newsapi_key', typeof newsApiKey === 'string' ? newsApiKey.trim() : ''), safeSet('military_thenewsapi_key', typeof theNewsApiKey === 'string' ? theNewsApiKey.trim() : '')];
  return results.find(result => !result.success) || { success: true };
};
export const clearCustomKeys = () => {
  const results = [safeRemove('military_newsapi_key'), safeRemove('military_thenewsapi_key')];
  return results.find(result => !result.success) || { success: true };
};

export const clearCache = () => {
  const results = [clearStoredCaches(), clearRSSCache()];
  return results.find(result => !result.success) || { success: true };
};
export const fetchNews = async (query = '', pageSize = 200, { signal, onProgress, force = false } = {}) => {
  if (signal?.aborted) return { success: false, articles: [], source: 'RSS Feeds', cached: false, stale: false, fetchedAt: null, feedHealth: [], storageWarnings: [], error: 'Request cancelled.' };
  const storageWarnings = [];
  const warn = error => { if (error && !storageWarnings.includes(error)) storageWarnings.push(error); };
  if (force) warn(clearCache().error);
  const select = result => ({ ...result, storageWarnings: [...new Set([...storageWarnings, ...(result.storageWarnings ?? [])])], articles: selectArticles(result.articles, { query }).slice(0, pageSize) });
  const keys = getCustomKeys();
  warn(keys.storageError);
  const cacheKey = `military_info_cache_pool_${Number(Boolean(keys.newsApiKey))}_${Number(Boolean(keys.theNewsApiKey))}`;
  const cached = force ? null : readPool(cacheKey, { onStorageError: warn });
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < CACHE_TTL) return select({ ...cached, success: true, cached: true, stale: false });
  if (cached && !signal?.aborted) emitProgress(onProgress, select({ ...cached, success: true, cached: true, stale: true }));
  let rssState = { success: false, articles: [], source: 'RSS Feeds', cached: false, stale: false, fetchedAt: null, feedHealth: [] };
const providers = [];
  if (keys.newsApiKey) providers.push({ id: 'newsapi', name: 'NewsAPI', url: 'https://newsapi.org/v2/everything', options: { headers: { 'X-Api-Key': keys.newsApiKey }, params: { q: 'military OR defense OR defence', language: 'en', sortBy: 'publishedAt', pageSize: 100 } } });
  if (keys.theNewsApiKey) providers.push({ id: 'thenewsapi', name: 'TheNewsAPI', url: 'https://api.thenewsapi.com/v1/news/all', options: { params: { api_token: keys.theNewsApiKey, search: 'military | defense | defence', language: 'en', limit: 50, sort: 'published_at' } } });  const apiStates = providers.map(provider => ({ articles: [], feed: { id: provider.id, name: provider.name, status: 'pending', articleCount: 0 } }));
  const merge = () => {
    const live = apiStates.filter(api => api.fetchedAt);
    const includeRSS = !(live.length && (rssState.cached || rssState.stale));
    return { ...rssState, articles: selectArticles([...(includeRSS ? rssState.articles : []), ...apiStates.flatMap(api => api.articles)]), success: rssState.success || live.length > 0,
      fetchedAt: [...(includeRSS && rssState.fetchedAt ? [rssState.fetchedAt] : []), ...live.map(api => api.fetchedAt)].sort().at(0) || null,
      cached: live.length ? false : rssState.cached, stale: live.length ? false : rssState.stale,
      source: [includeRSS && rssState.success ? 'RSS Feeds' : '', ...live.map(api => api.feed.name)].filter(Boolean).join(' + ') || 'RSS Feeds',
      error: live.length ? undefined : rssState.error, feedHealth: [...rssState.feedHealth, ...apiStates.map(api => api.feed)] };
  };
  const publish = () => { if (!signal?.aborted) emitProgress(onProgress, select(merge())); };
  const rssPromise = fetchFromRSSFeeds(Number.MAX_SAFE_INTEGER, { signal, onProgress: result => { rssState = result; publish(); }, force }).then(result => { rssState = result; publish(); }).catch(() => { rssState = { ...rssState, success: false, articles: [], error: 'RSS feeds unavailable.' }; publish(); });
  const generation = getCacheGeneration();
  
  const apiPromises = providers.map(async provider => {
    const cooldownKey = `military_info_provider_retry_after_${provider.id}`;
    if (cooldownActive(cooldownKey, warn)) {
      apiStates[providers.indexOf(provider)] = { articles: [], feed: { id: provider.id, name: provider.name, status: 'rate-limited', articleCount: 0 } };
      publish();
      return;
    }
    let state;
    try {
      const response = await runRequest(requestSignal => axios.get(provider.url, { ...provider.options, timeout: 8000, signal: requestSignal }), { signal });
      const items = provider.id === 'newsapi' ? (response.data?.status === 'ok' ? response.data.articles : null) : response.data?.data;
      if (!Array.isArray(items)) throw new Error('Invalid provider response.');
      const articles = selectArticles(items).filter(isMilitaryArticle);
      state = { articles, feed: { id: provider.id, name: provider.name, status: articles.length ? 'ok' : 'empty', articleCount: articles.length }, fetchedAt: new Date().toISOString() };
    } catch (error) {
      if (error.response?.status === 429) setCooldown(cooldownKey, error.response.headers?.['retry-after'], warn);
      state = { articles: [], feed: { id: provider.id, name: provider.name, status: error.response?.status === 429 ? 'rate-limited' : error.name === 'TimeoutError' ? 'timeout' : error.name === 'AbortError' ? 'cancelled' : 'error', articleCount: 0 } };
    }
    apiStates[providers.indexOf(provider)] = state;
    publish();
  });
  await Promise.all([rssPromise, ...apiPromises]);
  const result = merge();
  if (signal?.aborted) return select({ ...result, success: false, articles: [], error: 'Request cancelled.' });
  if (!result.success && cached && !signal?.aborted) return select({ ...result, success: true, articles: cached.articles, fetchedAt: cached.fetchedAt, source: cached.source, cached: true, stale: true, error: 'Live sources unavailable; showing saved snippets.' });
  if (result.success && !result.stale && !result.feedHealth.some(feed => ['pending', 'timeout', 'cancelled'].includes(feed.status)) && !signal?.aborted && generation === getCacheGeneration()) warn(writePool(cacheKey, result).error);
  return select(result);
};
