import { selectArticles } from './articleUtils';

let cacheGeneration = 0;
export const getCacheGeneration = () => cacheGeneration;
export const CACHE_TTL = 15 * 60 * 1000;
export const MAX_STALE_AGE = 7 * 24 * 60 * 60 * 1000;
function validPool(pool) {
  if (!pool || !Array.isArray(pool.articles) || typeof pool.fetchedAt !== 'string') return null;
  const timestamp = Date.parse(pool.fetchedAt);
  if (!Number.isFinite(timestamp) || timestamp > Date.now() || Date.now() - timestamp > MAX_STALE_AGE) return null;
  const articles = selectArticles(pool.articles);
  if (articles.length !== pool.articles.length) return null;
  const feedHealth = (Array.isArray(pool.feedHealth) ? pool.feedHealth : []).filter(feed => feed && typeof feed.id === 'string' && typeof feed.name === 'string' && ['ok', 'empty', 'error', 'rate-limited', 'pending', 'cancelled', 'timeout'].includes(feed.status)).map(feed => ({
    id: feed.id.slice(0, 100), name: feed.name.slice(0, 150), status: feed.status,
    articleCount: Number.isInteger(feed.articleCount) && feed.articleCount >= 0 ? feed.articleCount : 0,
    ...(Number.isFinite(Date.parse(feed.fetchedAt)) ? { fetchedAt: feed.fetchedAt } : {}),
  }));
  if (!articles.length && !feedHealth.some(feed => feed.status === 'ok' || feed.status === 'empty')) return null;
  return { articles, fetchedAt: new Date(timestamp).toISOString(), feedHealth, source: typeof pool.source === 'string' ? pool.source.slice(0, 200) : 'RSS Feeds' };
}
export function writePool(key, pool) {
  const validated = validPool(pool);
  if (!validated) return { success: false, error: 'Invalid article cache.' };
  return safeSet(key, JSON.stringify({ version: 1, ...validated }));
}
export function readPool(key, { onStorageError } = {}) {
  const stored = safeGet(key);
  if (!stored.success) { onStorageError?.(stored.error); return null; }
  if (!stored.value) return null;
  try {
    const pool = JSON.parse(stored.value);
    const validated = pool.version === 1 ? validPool(pool) : null;
    if (validated) {
      const saved = writePool(key, validated);
      if (!saved.success) onStorageError?.(saved.error);
    }
    return validated;
  } catch { return null; }
}

export function clearStoredCaches() {
  cacheGeneration += 1;
  try {
    const keys = Array.from({ length: globalThis.localStorage.length }, (_, index) => globalThis.localStorage.key(index));
    const results = keys.filter(key => key?.startsWith('military_info_cache_') || key?.startsWith('military_info_rss_cache')).map(safeRemove);
    return results.find(result => !result.success) || { success: true };
  } catch { return { success: false, error: 'Unable to clear browser storage.' }; }
}

export function safeGet(key) {
  try { return { success: true, value: globalThis.localStorage.getItem(key) }; }
  catch { return { success: false, value: null, error: 'Unable to read browser storage.' }; }
}
export function safeSet(key, value) {
  try { globalThis.localStorage.setItem(key, value); return { success: true }; }
  catch { return { success: false, error: 'Unable to save browser storage.' }; }
}
export function safeRemove(key) {
  try { globalThis.localStorage.removeItem(key); return { success: true }; }
  catch { return { success: false, error: 'Unable to clear browser storage.' }; }
}
export const MAX_BOOKMARKS = 500;
export function saveBookmarks(articles) {
  if (!Array.isArray(articles)) return { success: false, error: 'Bookmarks must be an array.' };
  const snippets = selectArticles(articles);
  if (snippets.length > MAX_BOOKMARKS) return { success: false, error: `Saved articles are limited to ${MAX_BOOKMARKS}. Remove a saved article before saving another.` };
  return safeSet('military_bookmarks', JSON.stringify({ version: 1, articles: snippets }));
}
export function removeBookmark(id) {
  const stored = safeGet('military_bookmarks');
  if (!stored.success) return { success: false, error: stored.error };
  let articles;
  try {
    const parsed = JSON.parse(stored.value);
    const raw = Array.isArray(parsed) ? parsed : parsed?.version === 1 ? parsed.articles : null;
    if (!Array.isArray(raw)) return { success: false, error: 'Unable to read saved articles.' };
    articles = selectArticles(raw);
  } catch { return { success: false, error: 'Unable to read saved articles.' }; }
  if (!articles.some(article => article.id === id)) return { success: false, error: 'This article is no longer saved. Retry saved articles to recover your collection.' };
  const remaining = articles.filter(article => article.id !== id);
  const saved = safeSet('military_bookmarks', JSON.stringify({ version: 1, articles: remaining }));
  return saved.success ? { ...saved, articles: remaining } : saved;
}
export function readBookmarks() {
  const result = safeGet('military_bookmarks');
  if (!result.success) return Object.defineProperty([], 'storageError', { value: result.error });
  if (!result.value) return [];
  try {
    const parsed = JSON.parse(result.value);
    const articles = Array.isArray(parsed) ? parsed : parsed?.version === 1 ? parsed.articles : [];
    const snippets = selectArticles(articles);
    if (snippets.length > MAX_BOOKMARKS) return snippets;
    const saved = saveBookmarks(snippets);
    if (!saved.success) Object.defineProperty(snippets, 'storageError', { value: saved.error });
    return snippets;
  } catch { return []; }
}
