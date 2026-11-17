import { decodeArticlePath, findArticleForPath, getArticlePath, safePublisherImage } from '../src/services/articleLinks.js';
import { safeDate } from '../src/services/articleUtils.js';
import { CURATION_DISCLAIMER } from '../src/services/curationDisclaimer.js';

const origin = 'https://military-info.vercel.app';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const meta = (name, value, attribute = 'property') => `<meta ${attribute}="${name}" content="${escapeHTML(value)}">`;

function renderArticle(article, target, fetchedAt) {
  const title = typeof article.title === 'string' ? article.title.slice(0, 250) : '';
  const description = typeof article.description === 'string' ? article.description.slice(0, 250) : '';
  const published = safeDate(article.publishedAt);
  const canonical = origin + target.path;
  const image = safePublisherImage(article.urlToImage);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(title)}</title>${meta('description', description, 'name')}
${meta('og:title', title)}${meta('og:description', description)}${meta('og:url', canonical)}${meta('og:site_name', 'Military Info')}${meta('og:type', 'article')}
${meta('twitter:card', image ? 'summary_large_image' : 'summary', 'name')}${meta('twitter:title', title, 'name')}${meta('twitter:description', description, 'name')}
${image ? meta('og:image', image) + meta('twitter:image', image, 'name') : ''}
${published ? meta('article:published_time', published) : ''}
<link rel="canonical" href="${escapeHTML(canonical)}"><link rel="stylesheet" href="/article-preview.css"></head>
<body><div class="app-shell"><header class="masthead"><a href="/" aria-label="Military Info home">Military Info</a><span>Military &amp; defense news</span></header>
<main id="article" class="article-landing"><div class="article-meta">Source: ${escapeHTML(target.feed.name)}${published ? ` · <time datetime="${escapeHTML(published)}">${escapeHTML(published)}</time>` : ''}</div>
<h1>${escapeHTML(title)}</h1>${image ? `<img class="article-image" src="${escapeHTML(image)}" alt="" width="640" height="360" referrerpolicy="no-referrer" loading="eager" fetchpriority="high">` : ''}<p class="article-preview">${escapeHTML(description)}</p>
<p class="preview-note">This is a headline and snippet from the publisher's source feed, not a permanent archive. The headline becomes unavailable when it is rotated out of the source feed. Feed acquired: <time data-fetched-at datetime="${escapeHTML(fetchedAt)}">${escapeHTML(fetchedAt)}</time>.</p>
<div class="dialog-actions"><a class="primary-button" href="${escapeHTML(article.url)}" target="_blank" rel="noopener noreferrer">Read at publisher</a></div>
<div class="share-link"><label for="article-share-url">Copy this first-party share link</label><input id="article-share-url" type="text" readonly value="${escapeHTML(canonical)}"></div></main>
<footer><nav aria-label="News navigation"><a href="/">Back to latest news</a></nav><p>Publisher attribution: ${escapeHTML(target.feed.name)}. Full reporting is available at the publisher.</p><p>${escapeHTML(CURATION_DISCLAIMER)}</p></footer></div></body></html>`;
}

function errorPage(res, status, message, head = false) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (head) return res.status(status).end();
  return res.status(status).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Article preview unavailable · Military Info</title><link rel="stylesheet" href="/article-preview.css"></head><body><div class="app-shell"><header class="masthead"><a href="/">Military Info</a></header><main class="article-landing error-state"><h1>Article preview unavailable</h1><p>${escapeHTML(message)}</p></main><footer><nav aria-label="News navigation"><a href="/">Back to latest news</a></nav><p>${escapeHTML(CURATION_DISCLAIMER)}</p></footer></div></body></html>`);
}

function requestTarget(url) {
  if (typeof url !== 'string' || /[\r\n]/.test(url)) return null;
  const [pathname, query, extra] = url.split('?');
  if (query === undefined) return decodeArticlePath(pathname);
  if (extra !== undefined) return null;
  const fields = /^feed=([a-z0-9-]{1,100})&article=([A-Za-z0-9_~-]{1,2800})$/.exec(query);
  if (!fields) return null;
  const path = `/article/${fields[1]}/${fields[2]}`;
  if (pathname !== '/api/article' && pathname !== path) return null;
  return decodeArticlePath(path);
}

export function createArticlePreviewHandler({ feedHandler, now = Date.now } = {}) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'none'; style-src 'self'; img-src https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return errorPage(res, 405, 'Method not allowed.');
    }
    const target = requestTarget(req.url);
    if (!target) return errorPage(res, 400, 'Invalid article link.', req.method === 'HEAD');
    const captured = {
      headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
    };
    try {
      await feedHandler({ method: 'GET', url: `/api/feeds?id=${target.feed.id}` }, captured);
    } catch {
      captured.statusCode = 502;
    }
    const acquiredAt = safeDate(captured.body?.fetchedAt);
    const timestamp = acquiredAt ? Date.parse(acquiredAt) : NaN;
    const currentTime = now();
    if (captured.statusCode !== 200 || !Array.isArray(captured.body?.articles)
      || captured.body.articles.length > 10 || captured.body.articles.some(article => !article || typeof article.url !== 'string' || typeof article.title !== 'string')
      || captured.body.source?.id !== target.feed.id || acquiredAt !== captured.body.fetchedAt
      || !Number.isFinite(currentTime) || !Number.isFinite(timestamp) || timestamp > currentTime || currentTime - timestamp >= 900_000) {
      res.setHeader('Retry-After', '60');
      return errorPage(res, 503, 'The source feed is temporarily unavailable. Please try again shortly.', req.method === 'HEAD');
    }
    const article = findArticleForPath(target.path, captured.body.articles.map(article => ({ ...article, source: target.feed })));
    if (!article) return errorPage(res, 404, 'This headline is no longer in the source feed. Headlines become unavailable when rotated out; this is not a permanent archive.', req.method === 'HEAD');
    const upstreamCache = /^public, max-age=0, s-maxage=(\d{1,3})$/.exec(captured.headers['cache-control'] ?? '');
    const seconds = Math.max(0, Math.min(900, upstreamCache ? Number(upstreamCache[1]) : 0, Math.floor((timestamp + 900_000 - currentTime) / 1000)));
    res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${seconds}`);
    res.setHeader('Last-Modified', new Date(captured.body.fetchedAt).toUTCString());
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(renderArticle(article, { ...target, path: getArticlePath(article) || target.path }, captured.body.fetchedAt));
  };
}
