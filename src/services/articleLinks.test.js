import { describe, expect, it } from 'vitest';
import * as links from './articleLinks.js';
import { FEEDS } from './feeds.js';

const article = { title: 'TEST FIXTURE: Army update', url: 'https://www.defensenews.com/story?q=naval%20news', source: { id: FEEDS[0].id, name: FEEDS[0].name } };

describe('first-party article links', () => {
  it('roundtrips a registered publisher article without embedding headlines or snippets', () => {
    expect(typeof links.getArticlePath).toBe('function');
    const path = links.getArticlePath(article);
    expect(path).toMatch(/^\/article\/defense-news\/[A-Za-z0-9_-]+$/);
    expect(links.decodeArticlePath(path)).toEqual({ feed: FEEDS[0], url: article.url, path });
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
