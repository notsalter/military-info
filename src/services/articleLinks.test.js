import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import * as links from './articleLinks.js';
import { FEEDS } from './feeds.js';

const article = { title: 'TEST FIXTURE: Army update', url: 'https://www.defensenews.com/story?q=naval%20news', source: { id: FEEDS[0].id, name: FEEDS[0].name } };

describe('first-party article links', () => {
  it('matches legacy and changed-headline short routes by URL identity, refusing ambiguous records', () => {
    const short = links.getArticlePath(article);
    const legacy = `/article/${FEEDS[0].id}/${btoa(article.url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
    const changed = { ...article, title: 'TEST FIXTURE changed headline' };
    for (const path of [short, legacy, short.replace('test-fixture-army-update', 'decorative-not-reporting')]) {
      expect(links.findArticleForPath(path, [changed])).toBe(changed);
      expect(links.articleMatchesPath(changed, path)).toBe(true);
      expect(links.findArticleForPath(path, [article, changed])).toBeNull();
      expect(links.findArticleForPath(path, [{ ...changed, source: FEEDS[1] }])).toBeNull();
    }
    expect(links.decodeArticlePath(legacy)).toEqual({ feed: FEEDS[0], url: article.url, path: legacy });
  });
  it('reconciles only cross-collection canonical URL/source copies and prefers the live record unchanged', () => {
    const live = { ...article, id: 'TEST FIXTURE untrusted copied id', description: 'TEST FIXTURE live preview' };
    const saved = { ...article, id: 'TEST FIXTURE different copied id', url: `${article.url}#saved`, title: 'TEST FIXTURE saved headline', description: 'TEST FIXTURE saved preview' };
    const merged = links.mergeLiveAndSavedArticles([live], [saved]);
    expect(merged).toEqual([live]);
    expect(merged[0]).toBe(live);
    const legacy = `/article/${FEEDS[0].id}/${btoa(article.url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
    for (const path of [legacy, links.getArticlePath(article)]) {
      expect(links.findArticleForPath(path, merged)).toBe(live);
      expect(links.findArticleForPath(path, [live, saved])).toBeNull();
    }
    expect(links.mergeLiveAndSavedArticles([], [saved])).toEqual([saved]);
    expect(links.mergeLiveAndSavedArticles([live], [])).toEqual([live]);
  });
  it('retains differing actual URL/source identities, invalid URLs and within-collection ambiguity regardless of copied ids', () => {
    const live = { ...article, id: article.url };
    const differentURL = { ...live, url: 'https://example.com/different', title: article.title };
    const differentSource = { ...live, source: FEEDS[1] };
    const invalidURL = { ...live, url: 'https://localhost/story' };
    const saved = [differentURL, differentSource, invalidURL];
    expect(links.mergeLiveAndSavedArticles([live], saved)).toEqual([live, ...saved]);
    const duplicate = { ...live, title: 'TEST FIXTURE conflicting live row' };
    const path = links.getArticlePath(live);
    expect(links.findArticleForPath(path, links.mergeLiveAndSavedArticles([live, duplicate], [live]))).toBeNull();
    expect(links.findArticleForPath(path, links.mergeLiveAndSavedArticles([], [live, duplicate]))).toBeNull();
    expect(links.findArticleForPath(path, links.mergeLiveAndSavedArticles([], saved))).toBeNull();
  });
  it('preserves the exact supplied indomiliter legacy token without normalizing its spelling', () => {
    const publicURL = 'https://indomiliter.com/eks-pesawat-vvip-turki-airbus-a340-500-muncul-dengan-livery-republik-indonesia-dan-registrasi-pk-grd/';
    const token = btoa(publicURL).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const path = `/article/indomiliter/${token}`;
    const target = links.decodeArticlePath(path);
    expect(target?.url).toBe(atob(token));
    expect(target?.feed.id).toBe('indomiliter');
    expect(target?.path).toBe(path);
    // Identifier-only compatibility test; this is not a live feed result.
    const record = { title: 'TEST FIXTURE identifier compatibility', url: target.url, source: target.feed };
    expect(links.findArticleForPath(path, [record])).toBe(record);
    expect(links.getArticlePath(record).split('~')[1]).toBe(createHash('sha256').update(target.url).digest('hex').slice(0, 16));
  });
  it('agrees with Node SHA-256 across ASCII URL padding and maximum-length boundaries', () => {
    for (const length of [0, 1, 30, 31, 32, 33, 55, 56, 63, 64, 65, 127, 128, 2000]) {
      const url = `https://example.com/${'x'.repeat(length)}`;
      expect(links.getArticlePath({ ...article, url }).split('~')[1]).toBe(createHash('sha256').update(url).digest('hex').slice(0, 16));
    }
  });
  it('uses at most eight actual words and stops at a whole-word 60-character boundary without inventing a fallback', () => {
    expect(links.getArticlePath({ ...article, title: `TEST FIXTURE ${'longword '.repeat(12)}` }).split('/').at(-1).split('~')[0]).toBe('test-fixture-longword-longword-longword-longword-longword');
    for (const title of [undefined, '', '!!!', 'x'.repeat(61)]) expect(links.getArticlePath({ ...article, title })).toBeNull();
    const valid = links.getArticlePath(article);
    for (const token of [`${'x'.repeat(61)}~0123456789abcdef`, 'word--word~0123456789abcdef', '-word~0123456789abcdef', 'word~0123456789ABCDEF', 'word~0123456789abcde', 'word~0123456789abcdef0', 'word%7E0123456789abcdef']) {
      expect(links.decodeArticlePath(`/article/defense-news/${token}`)).toBeNull();
    }
    expect(links.articleMatchesPath(article, `${valid}?extra=1`)).toBe(false);
  });
  it('issues synchronous headline-word links with a stable SHA-256 prefix instead of encoding the source URL', () => {
    const path = links.getArticlePath(article);
    expect(path).toMatch(/^\/article\/defense-news\/test-fixture-army-update~[a-f0-9]{16}$/);
    expect(path).not.toContain(btoa(article.url).slice(0, 20));
    expect(links.decodeArticlePath(path)).toEqual({ feed: FEEDS[0], id: path.split('~')[1], path });
    expect(links.getArticleShareURL(article, 'https://military-info.vercel.app')).toBe(`https://military-info.vercel.app${path}`);
  });
  it.each([
    'https://localhost/story', 'https://127.0.0.1/story', 'https://[::1]/story',
    'http://10.0.0.146/story', 'https://169.254.169.254/latest', 'https://example.local/story',
    'https://example.com:8443/story', 'https://user:password@example.com/story',
    `https://example.com/${'a'.repeat(2050)}`,
  ])('does not issue or resolve a link for unsafe article URL %s', url => {
    expect(links.getArticlePath({ ...article, url })).toBeNull();
    const token = btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(links.decodeArticlePath(`/article/defense-news/${token}`)).toBeNull();
  });
  it('rejects noncanonical, extra, malformed and unsupported routes', () => {
    const path = links.getArticlePath(article);
    expect(links.getArticlePath({ ...article, source: { id: 'unregistered' } })).toBeNull();
    for (const bad of [path + '=', path + '?url=https://localhost', path + '#frag', path + '\n', path.replace('defense-news', 'unknown'), '/article/defense-news/_']) {
      expect(links.decodeArticlePath(bad)).toBeNull();
    }
  });
  it('only accepts public HTTPS publisher images without fetching them', () => {
    expect(typeof links.safePublisherImage).toBe('function');
    expect(links.safePublisherImage('https://cdn.example.com/naval.jpg')).toBe('https://cdn.example.com/naval.jpg');
    for (const value of ['http://cdn.example.com/image.jpg', 'data:image/png;base64,abcd', 'https://127.1/image.jpg', 'https://cdn.example.local/image.jpg', 'https://user:pw@cdn.example.com/image.jpg', 'https://cdn.example.com:8443/image.jpg', null]) {
      expect(links.safePublisherImage(value)).toBeNull();
    }
  });
  it('requires an exact safe site origin rather than credentials or a path', () => {
    for (const origin of ['https://user:pw@example.com', 'https://example.com/path', 'https://example.com?x=1', 'javascript:alert(1)', undefined]) {
      expect(links.getArticleShareURL(article, origin)).toBeNull();
    }
    expect(links.getArticleShareURL(article, 'http://127.0.0.1:4173')).toContain('http://127.0.0.1:4173/article/');
  });
});
