import { describe, it, expect, vi } from 'vitest';
import './testStorage';
import * as storage from './storage';
const article = { title: 'Navy relief report', url: 'https://example.com/navy', description: 'x'.repeat(900), content: 'full article', publishedAt: 'bad' };

const capacityFixtures = Array.from({ length: 500 }, (_, index) => ({
  ...article, title: `Test fixture: saved navy report ${index}`, url: `https://example.test/saved-${index}`, publishedAt: '2026-01-02T00:00:00.000Z',
}));

describe('bookmark storage', () => {
  it.each(['2026-01-03T00:00:00.000Z', '2026-01-01T00:00:00.000Z'])('rejects a distinct addition dated %s at capacity without changing stored bytes', publishedAt => {
    expect(storage.saveBookmarks(capacityFixtures)).toEqual({ success: true });
    const before = localStorage.getItem('military_bookmarks');
    const addition = { ...article, title: 'Test fixture: additional navy report', url: 'https://example.test/additional', publishedAt };
    const write = vi.spyOn(localStorage, 'setItem');
    const rejected = storage.saveBookmarks([...capacityFixtures, addition]);
    expect(rejected.success).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(rejected.error).toMatch(/500.*Remove.*before saving/i);
    expect(localStorage.getItem('military_bookmarks')).toBe(before);
    expect(JSON.parse(before).articles).toHaveLength(500);
  });

  it('counts only normalized distinct bookmarks toward capacity and keeps every existing ID', () => {
    const duplicate = { ...capacityFixtures[0], url: `${capacityFixtures[0].url}#same-article` };
    const invalid = { title: 'Test fixture: invalid navy report', url: 'javascript:invalid' };
    expect(storage.saveBookmarks([...capacityFixtures, duplicate, invalid])).toEqual({ success: true });
    const read = storage.readBookmarks();
    expect(read).not.toHaveProperty('storageError');
    expect(read).toHaveLength(500);
    expect(new Set(read.map(item => item.id))).toEqual(new Set(capacityFixtures.map(item => item.url)));
    expect(JSON.parse(localStorage.getItem('military_bookmarks')).articles).toEqual(read);
  });

  it.each(['legacy array', 'versioned collection'])('reads every distinct record from an oversized %s without rewriting or evicting records', format => {
    const fixtures = [...capacityFixtures, { ...article, title: 'Test fixture: legacy navy report', url: 'https://example.test/legacy-extra' }];
    const before = JSON.stringify(format === 'legacy array' ? fixtures : { version: 1, articles: fixtures });
    localStorage.setItem('military_bookmarks', before);
    const write = vi.spyOn(localStorage, 'setItem');
    const read = storage.readBookmarks();
    expect(write).not.toHaveBeenCalled();
    expect(read).toHaveLength(501);
    expect(new Set(read.map(item => item.id))).toEqual(new Set(fixtures.map(item => item.url)));
    expect(read).not.toHaveProperty('storageError');
    expect(localStorage.getItem('military_bookmarks')).toBe(before);
    expect(storage.saveBookmarks(read.filter(item => item.id !== 'https://example.test/legacy-extra'))).toEqual({ success: true });
    expect(storage.readBookmarks()).toHaveLength(500);
  });

  it.each(['legacy array', 'versioned collection'])('removes only the requested persisted ID from an oversized %s and returns every remaining normalized record', format => {
    const extras = Array.from({ length: 3 }, (_, index) => ({ ...article, title: `Test fixture: extra navy report ${index}`, url: `https://example.test/extra-${index}` }));
    const fixtures = [...capacityFixtures, ...extras];
    const duplicate = { ...fixtures[0], url: `${fixtures[0].url}#duplicate` };
    const raw = [...fixtures, duplicate];
    localStorage.setItem('military_bookmarks', JSON.stringify(format === 'legacy array' ? raw : { version: 1, articles: raw }));
    let expected = storage.readBookmarks();
    const write = vi.spyOn(localStorage, 'setItem');
    for (const removed of extras) {
      write.mockClear();
      expected = expected.filter(item => item.id !== removed.url);
      const saved = storage.removeBookmark(removed.url);
      expect(saved).toEqual({ success: true, articles: expected });
      expect(write).toHaveBeenCalledExactlyOnceWith('military_bookmarks', JSON.stringify({ version: 1, articles: expected }));
      expect(JSON.parse(localStorage.getItem('military_bookmarks'))).toEqual({ version: 1, articles: expected });
    }
    expect(expected).toHaveLength(500);
  });

  it.each(['addition', 'same-size replacement', 'shrinking replacement', 'caller-claimed removal'])('rejects an above-capacity %s without accepting caller-supplied proof of removal', mutation => {
    const extras = Array.from({ length: 3 }, (_, index) => ({ ...article, title: `Test fixture: extra navy report ${index}`, url: `https://example.test/extra-${index}` }));
    const fixtures = [...capacityFixtures, ...extras];
    const before = JSON.stringify({ version: 1, articles: fixtures });
    localStorage.setItem('military_bookmarks', before);
    const addition = { ...article, title: 'Test fixture: replacement navy report', url: 'https://example.test/replacement' };
    const next = mutation === 'addition' ? [...fixtures, addition]
      : mutation === 'same-size replacement' ? [...fixtures.slice(1), addition]
        : mutation === 'shrinking replacement' ? [...fixtures.slice(2), addition] : fixtures.slice(1);
    const write = vi.spyOn(localStorage, 'setItem');
    const saved = storage.saveBookmarks(next, { removalOnly: true, previous: [...next, addition] });
    expect(saved.success).toBe(false);
    expect(saved.error).toMatch(/500.*Remove.*before saving/i);
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem('military_bookmarks')).toBe(before);
  });

  it.each(['read', 'write'])('preserves oversized bookmark bytes and reports a failed removal %s', failure => {
    const fixtures = [...capacityFixtures, article, { ...article, title: 'Test fixture: extra navy report', url: 'https://example.test/extra' }];
    const before = JSON.stringify({ version: 1, articles: fixtures });
    localStorage.setItem('military_bookmarks', before);
    const get = localStorage.getItem;
    const write = vi.spyOn(localStorage, 'setItem');
    if (failure === 'read') localStorage.getItem = () => { throw new Error('Test fixture: blocked read'); };
    else write.mockImplementation(() => { throw new Error('Test fixture: quota'); });
    expect(storage.removeBookmark(article.url)).toEqual({ success: false, error: failure === 'read' ? 'Unable to read browser storage.' : 'Unable to save browser storage.' });
    expect(get('military_bookmarks')).toBe(before);
    if (failure === 'read') expect(write).not.toHaveBeenCalled();
    else expect(write).toHaveBeenCalledTimes(1);
  });

  it('rejects removal of an ID not present in current storage without trusting a stale collection', () => {
    const fixtures = [...capacityFixtures, { ...article, title: 'Test fixture: extra navy report', url: 'https://example.test/extra' }];
    const before = JSON.stringify({ version: 1, articles: fixtures });
    localStorage.setItem('military_bookmarks', before);
    const write = vi.spyOn(localStorage, 'setItem');
    expect(storage.removeBookmark(article.url, [article, ...fixtures])).toEqual({ success: false, error: 'This article is no longer saved. Retry saved articles to recover your collection.' });
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem('military_bookmarks')).toBe(before);
  });

  it('distinguishes blocked bookmark reads from genuinely empty saved collections', () => {
    expect(storage.readBookmarks()).not.toHaveProperty('storageError');
    localStorage.getItem = () => { throw new Error('blocked'); };
    const result = storage.readBookmarks();
    expect(Array.isArray(result)).toBe(true);
    expect(result.storageError).toBe('Unable to read browser storage.');
    expect(Object.keys(result)).toEqual([]);
  });

  it('reports blocked cache reads while preserving the missing-cache return contract', () => {
    localStorage.getItem = () => { throw new Error('blocked'); };
    const errors = [];
    expect(storage.readPool('military_info_cache_pool', { onStorageError: error => errors.push(error) })).toBeNull();
    expect(errors).toEqual(['Unable to read browser storage.']);
  });

  it('keeps bookmark snippets and flags a failed sanitizing write', () => {
    localStorage.setItem('military_bookmarks', JSON.stringify([article]));
    localStorage.setItem = () => { throw new Error('quota'); };
    const result = storage.readBookmarks();
    expect(result).toHaveLength(1);
    expect(result.storageError).toBe('Unable to save browser storage.');
    expect(Object.keys(result)).toEqual(['0']);
  });

  it('returns validated cached data while reporting a failed sanitizing cache write', () => {
    localStorage.setItem('military_info_cache_pool', JSON.stringify({ version: 1, articles: [article], fetchedAt: new Date().toISOString() }));
    localStorage.setItem = () => { throw new Error('quota'); };
    const errors = [];
    const result = storage.readPool('military_info_cache_pool', { onStorageError: error => errors.push(error) });
    expect(result.articles).toHaveLength(1);
    expect(errors).toEqual(['Unable to save browser storage.']);
  });

  it('does not treat a cache without successful source evidence as a successful empty pool', () => {
    localStorage.setItem('military_info_cache_pool', JSON.stringify({ version: 1, articles: [], fetchedAt: new Date().toISOString(), feedHealth: [{ id: 'broken', name: 'Broken', status: 'error', articleCount: 0 }] }));
    expect(storage.readPool('military_info_cache_pool')).toBeNull();
  });

  it('removes legacy full content from a validated cached pool during readback', () => {
    const fetchedAt = new Date().toISOString();
    localStorage.setItem('military_info_cache_pool', JSON.stringify({ version: 1, articles: [article], fetchedAt }));
    const result = storage.readPool('military_info_cache_pool');
    expect(result.articles[0]).not.toHaveProperty('content');
    const stored = JSON.parse(localStorage.getItem('military_info_cache_pool'));
    expect(stored.articles[0]).not.toHaveProperty('content');
    expect(stored.articles[0].description).toHaveLength(250);
  });

  it('validates cached pools with real timestamps and never stores truncated caller selections', () => {
    expect(storage.writePool).toBeTypeOf('function');
    const fetchedAt = new Date().toISOString();
    expect(storage.writePool('military_info_cache_pool', { articles: [article], fetchedAt, feedHealth: [{ id: 'navy', name: 'Navy', status: 'ok', articleCount: 1 }] })).toEqual({ success: true });
    expect(storage.readPool('military_info_cache_pool')).toMatchObject({ fetchedAt, articles: [{ id: article.url, description: expect.any(String) }] });
    localStorage.setItem('military_info_cache_pool', JSON.stringify({ version: 1, articles: [article], fetchedAt: 'bad' }));
    expect(storage.readPool('military_info_cache_pool')).toBeNull();
    localStorage.setItem('military_info_cache_pool', JSON.stringify({ version: 1, articles: [{ url: 'javascript:bad', title: 'bad' }], fetchedAt }));
    expect(storage.readPool('military_info_cache_pool')).toBeNull();
  });
  it('migrates existing bookmarks into validated snippets and reports write failures explicitly', () => {
    expect(storage.readBookmarks).toBeTypeOf('function');
    localStorage.setItem('military_bookmarks', JSON.stringify([article, { title: '', url: 'javascript:bad' }]));
    const bookmarks = storage.readBookmarks();
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].description).toHaveLength(250);
    expect(bookmarks[0]).not.toHaveProperty('content');
    expect(bookmarks[0].publishedAt).toBeNull();
    expect(JSON.parse(localStorage.getItem('military_bookmarks')).articles).toEqual(bookmarks);
    expect(storage.saveBookmarks(bookmarks)).toEqual({ success: true });
    localStorage.setItem = () => { throw new Error('quota'); };
    expect(storage.saveBookmarks(bookmarks)).toEqual({ success: false, error: 'Unable to save browser storage.' });
  });
});
