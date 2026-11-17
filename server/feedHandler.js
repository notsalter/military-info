import { FEEDS } from '../src/services/feeds.js';
import { parseFeed } from './parseFeed.js';

function fail(res, status, error) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({ error });
}

export function createFeedHandler({ fetchFeed, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  return async (req, res) => {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return fail(res, 405, 'Method not allowed.');
    }
    const match = typeof req.url === 'string' && /^\/api\/feeds\?id=([a-z0-9-]{1,100})$/.exec(req.url);
    if (!match) return fail(res, 400, 'Invalid request.');
    const feed = FEEDS.find(feed => feed.id === match[1]);
    if (!feed) return fail(res, 404, 'Unknown feed.');
    try {
      let result = cache.get(feed.id);
      if (!result || now() >= Date.parse(result.fetchedAt) + 900_000) {
        cache.delete(feed.id);
        if (!pending.has(feed.id)) {
          const job = (async () => {
            const articles = parseFeed(await fetchFeed(feed.url), feed);
            const value = { articles, fetchedAt: new Date(now()).toISOString(), source: { id: feed.id, name: feed.name } };
            cache.set(feed.id, value);
            return value;
          })().finally(() => pending.delete(feed.id));
          pending.set(feed.id, job);
        }
        result = await pending.get(feed.id);
      }
      // A warm-instance cache hit must not restart the CDN's 15-minute freshness window.
      const seconds = Math.max(0, Math.min(900, Math.floor((Date.parse(result.fetchedAt) + 900_000 - now()) / 1000)));
      res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${seconds}`);
      return res.status(200).json(result);
    } catch {
      return fail(res, 502, 'Feed unavailable.');
    }
  };
}
