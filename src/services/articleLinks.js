import { FEEDS } from './feeds.js';
import { safeURL } from './articleUtils.js';

const encodeURL = url => btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function publicURL(value) {
  const safe = safeURL(value);
  if (!safe || safe.length > 2048 || /[^\x21-\x7e]/.test(safe)) return null;
  const url = new URL(safe);
  const host = url.hostname;
  if (url.port || !host.includes('.') || host.includes(':') || /^[\d.]+$/.test(host)
    || /(^|\.)(localhost|local|internal|lan|home|onion|arpa)$/.test(host)
    || host.split('.').some(label => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))) return null;
  return safe;
}

export function safePublisherImage(value) {
  const safe = publicURL(value);
  return safe && new URL(safe).protocol === 'https:' ? safe : null;
}

export function getArticlePath(article) {
  const feed = FEEDS.find(feed => feed.id === article?.source?.id);
  const url = publicURL(article?.url);
  if (!feed || !url) return null;
  return `/article/${feed.id}/${encodeURL(url)}`;
}

export function decodeArticlePath(path) {
  const match = typeof path === 'string' && /^\/article\/([a-z0-9-]{1,100})\/([A-Za-z0-9_-]{1,2800})$/.exec(path);
  if (!match) return null;
  const feed = FEEDS.find(feed => feed.id === match[1]);
  if (!feed) return null;
  try {
    const url = atob(match[2].replace(/-/g, '+').replace(/_/g, '/'));
    if (publicURL(url) !== url || encodeURL(url) !== match[2]) return null;
    return { feed, url, path };
  } catch { return null; }
}

export function getArticleShareURL(article, origin) {
  const path = getArticlePath(article);
  const site = safeURL(origin);
  return path && site && new URL(site).origin === origin ? `${origin}${path}` : null;
}
