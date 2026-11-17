import { describe, it, expect, vi } from 'vitest';
import './testStorage';

const utils = () => import('./articleUtils.js').catch(() => ({}));
const raw = (changes = {}) => ({ title: 'Defense report', url: 'https://example.com/report', source: { name: 'Defense News' }, ...changes });

describe('article snippets', () => {
  it.each(['24:00:00', '99:00:00', '12:60:00', '12:99:00', '12:00:60', '12:00:99', '24:00', '12:60'])('rejects invalid ISO clock %s before Date.parse can fabricate publication time', async clock => {
    const { safeDate, normalizeArticle, selectArticles } = await utils();
    const parse = vi.spyOn(Date, 'parse');
    try {
      for (const [separator, zone] of [['T', 'Z'], ['T', '+05:30'], ['T', '-0530'], ['T', ''], [' ', '']]) {
        const publishedAt = `2026-11-14${separator}${clock}${zone}`;
        expect.soft(safeDate(publishedAt), publishedAt).toBeNull();
        const article = normalizeArticle(raw({ publishedAt }));
        expect.soft(article.publishedAt, publishedAt).toBeNull();
        expect.soft(normalizeArticle(normalizeArticle(article)).publishedAt, publishedAt).toBeNull();
        expect.soft(selectArticles(selectArticles([article]))[0].publishedAt, publishedAt).toBeNull();
      }
      expect.soft(parse).not.toHaveBeenCalled();
    } finally {
      parse.mockRestore();
    }
  });

  it.each(['24:00:00', '99:00:00', '12:60:00', '12:99:00', '12:00:60', '12:00:99', '24:00', '12:60'])('rejects invalid RFC clock %s before Date.parse can normalize it', async clock => {
    const { safeDate, normalizeArticle, selectArticles } = await utils();
    const parse = vi.spyOn(Date, 'parse');
    try {
      for (const zone of ['GMT', 'UTC', '+0530', '-0530', '+2359', '-2359']) {
        const publishedAt = `Sat, 14 Nov 2026 ${clock} ${zone}`;
        expect.soft(safeDate(publishedAt), publishedAt).toBeNull();
        const article = normalizeArticle(raw({ publishedAt }));
        expect.soft(normalizeArticle(normalizeArticle(article)).publishedAt, publishedAt).toBeNull();
        expect.soft(selectArticles(selectArticles([article]))[0].publishedAt, publishedAt).toBeNull();
      }
      expect.soft(parse).not.toHaveBeenCalled();
    } finally {
      parse.mockRestore();
    }
  });

  it.each([
    ['00:00:00', 'GMT', '2026-11-14T00:00:00.000Z'],
    ['00:00:00', 'UTC', '2026-11-14T00:00:00.000Z'],
    ['00:00:00', '+0530', '2026-11-13T18:30:00.000Z'],
    ['00:00:00', '-0530', '2026-11-14T05:30:00.000Z'],
    ['00:00:00', '+2359', '2026-11-13T00:01:00.000Z'],
    ['00:00:00', '-2359', '2026-11-14T23:59:00.000Z'],
    ['23:59:59', 'GMT', '2026-11-14T23:59:59.000Z'],
    ['23:59:59', 'UTC', '2026-11-14T23:59:59.000Z'],
    ['23:59:59', '+0530', '2026-11-14T18:29:59.000Z'],
    ['23:59:59', '-0530', '2026-11-15T05:29:59.000Z'],
    ['23:59:59', '+2359', '2026-11-14T00:00:59.000Z'],
    ['23:59:59', '-2359', '2026-11-15T23:58:59.000Z'],
    ['23:59', 'GMT', '2026-11-14T23:59:00.000Z'],
  ])('preserves valid RFC boundary clock %s %s', async (clock, zone, expected) => {
    const { safeDate, normalizeArticle, selectArticles } = await utils();
    const publishedAt = `Sat, 14 Nov 2026 ${clock} ${zone}`;
    expect(safeDate(publishedAt)).toBe(expected);
    const article = normalizeArticle(raw({ publishedAt }));
    expect(normalizeArticle(normalizeArticle(article)).publishedAt).toBe(expected);
    expect(selectArticles(selectArticles([article]))[0].publishedAt).toBe(expected);
    expect(safeDate(`30 Feb 2026 ${clock} ${zone}`)).toBeNull();
  });

  it.each([
    ['2026-11-14T00:00:00Z', '2026-11-14T00:00:00.000Z'],
    ['2026-11-14T23:59:59Z', '2026-11-14T23:59:59.000Z'],
    ['2026-11-14T00:00:00+05:30', '2026-11-13T18:30:00.000Z'],
    ['2026-11-14T23:59:59+0530', '2026-11-14T18:29:59.000Z'],
    ['2026-11-14T00:00:00-0530', '2026-11-14T05:30:00.000Z'],
    ['2026-11-14T23:59:59-05:30', '2026-11-15T05:29:59.000Z'],
    ['2026-11-14T00:00:00+23:59', '2026-11-13T00:01:00.000Z'],
    ['2026-11-14T23:59:59-2359', '2026-11-15T23:58:59.000Z'],
    ['2026-11-14T23:59:59.999Z', '2026-11-14T23:59:59.999Z'],
    ['2026-11-14T23:59:59', '2026-11-14T23:59:59.000Z'],
    ['2026-11-14 00:00:00', '2026-11-14T00:00:00.000Z'],
    ['2026-11-14 23:59:59.999', '2026-11-14T23:59:59.999Z'],
    ['2026-11-14T23:59', '2026-11-14T23:59:00.000Z'],
    ['2026-11-14', '2026-11-14T00:00:00.000Z'],
  ])('preserves supported ISO publication date %s', async (publishedAt, expected) => {
    const { safeDate, normalizeArticle, selectArticles } = await utils();
    expect(safeDate(publishedAt)).toBe(expected);
    const article = normalizeArticle(raw({ publishedAt }));
    expect(normalizeArticle(normalizeArticle(article)).publishedAt).toBe(expected);
    expect(selectArticles(selectArticles([article]))[0].publishedAt).toBe(expected);
    expect(safeDate(publishedAt.replace('2026-11-14', '2026-02-30'))).toBeNull();
  });

  it.each(['+2400', '+24:00', '-2400', '-24:00', '+1260', '+12:60', '-1260', '-12:60'])('retains rejection of impossible ISO offset %s', async offset => {
    const { safeDate } = await utils();
    expect(safeDate(`2026-11-14T23:59:59${offset}`)).toBeNull();
  });

  it.each(['script', 'style'].flatMap(tag => [' ', '\t', '\n'].map(space => [tag, space])))('suppresses %s bodies with closing-tag whitespace %j', async (tag, space) => {
    const { plainText, normalizeArticle, selectArticles } = await utils();
    const hidden = `<${tag}>secret</${tag}${space}>`;
    expect.soft(plainText(hidden)).toBe('');
    const article = normalizeArticle(raw({ title: `Army ${hidden} update`, description: `${hidden}Public report.` }));
    expect.soft(article.title).toBe('Army update');
    expect.soft(article.description).toBe('Public report.');
    expect.soft(selectArticles([article])).toEqual([article]);
  });

  it.each(['+2400', '+1260', '-2400', '-1260'])('rejects impossible RFC numeric offset %s', async offset => {
    const { safeDate, normalizeArticle, selectArticles } = await utils();
    const publishedAt = `Sat, 14 Nov 2026 12:00:00 ${offset}`;
    expect.soft(safeDate(publishedAt)).toBeNull();
    const article = normalizeArticle(raw({ publishedAt }));
    expect.soft(article.publishedAt).toBeNull();
    expect.soft(selectArticles([article])[0].publishedAt).toBeNull();
  });

  it.each([
    ['GMT', '2026-11-14T12:00:00.000Z'],
    ['UTC', '2026-11-14T12:00:00.000Z'],
    ['+0530', '2026-11-14T06:30:00.000Z'],
    ['-0530', '2026-11-14T17:30:00.000Z'],
    ['+2359', '2026-11-13T12:01:00.000Z'],
    ['-2359', '2026-11-15T11:59:00.000Z'],
  ])('preserves valid RFC numeric or UTC offset %s', async (offset, expected) => {
    const { safeDate } = await utils();
    expect(safeDate(`Sat, 14 Nov 2026 12:00:00 ${offset}`)).toBe(expected);
    expect(safeDate(`30 Feb 2026 12:00:00 ${offset}`)).toBeNull();
  });

  it('rejects impossible RFC feed dates instead of normalizing them to another day', async () => {
    const { normalizeArticle } = await utils();
    expect(normalizeArticle(raw({ publishedAt: 'Mon, 30 Feb 2026 12:00:00 GMT' })).publishedAt).toBeNull();
    expect(normalizeArticle(raw({ publishedAt: 'Sat, 14 Nov 2026 12:00:00 GMT' })).publishedAt).toBe('2026-11-14T12:00:00.000Z');
  });

  it('rejects ambiguous or impossible publication dates rather than showing fabricated freshness', async () => {
    const { normalizeArticle } = await utils();
    for (const publishedAt of ['1', '2026-02-30T12:00:00Z', '2026-13-01', null, 123]) {
      expect(normalizeArticle(raw({ publishedAt })).publishedAt).toBeNull();
    }
    expect(normalizeArticle(raw({ publishedAt: '2026-11-14 12:00:00' })).publishedAt).toBe('2026-11-14T12:00:00.000Z');
  });

  it('rejects untitled or unsafe links while preserving legitimate military reporting', async () => {
    const { normalizeArticle, classifyArticle, selectArticles } = await utils();
    expect(classifyArticle).toBeTypeOf('function');
    expect(selectArticles).toBeTypeOf('function');
    expect(normalizeArticle(raw({ title: '' }))).toBeNull();
    expect(normalizeArticle(raw({ url: 'javascript:alert(1)' }))).toBeNull();
    const articles = [
      normalizeArticle(raw({ title: 'Navy missile interception during hurricane relief', publishedAt: '2026-11-15T12:00:00Z' })),
      normalizeArticle(raw({ title: 'Cyberattack exploits password security', url: 'https://example.com/cyber' })),
      normalizeArticle(raw({ title: 'SpaceX military satellite deployment', url: 'https://example.com/space' })),
      normalizeArticle(raw({ title: 'Army logistics and food supply conference', url: 'https://example.com/army' })),
      normalizeArticle(raw({ title: 'Award to tankless water company', url: 'https://example.com/award' })),
    ];
    expect(articles.map(classifyArticle)).toEqual(['naval', 'cyber', 'aerospace', 'ground', 'geopolitics']);
    expect(selectArticles(articles, { query: 'navy hurricane', category: 'naval', source: 'defense-news', sort: 'newest' })).toEqual([articles[0]]);
    expect(selectArticles(articles, { sort: 'title' }).map(a => a.title)).toEqual([...articles].sort((a, b) => a.title.localeCompare(b.title)).map(a => a.title));
    expect(selectArticles(articles, { query: 'absent', category: 'all' })).toEqual([]);
  });
  it('normalizes HTML to a bounded snippet schema without retaining full content', async () => {
    const { normalizeArticle } = await utils();
    expect(normalizeArticle).toBeTypeOf('function');
    const result = normalizeArticle(raw({ title: '<b>Defense &amp; security</b>', description: `<p>${'x'.repeat(300)} &nbsp; details</p>`, content: 'PRIVATE FULL TEXT', publishedAt: 'not a date', urlToImage: 'javascript:alert(1)' }));
    expect(result.title).toBe('Defense & security');
    expect(result.description).toHaveLength(250);
    expect(result.description.endsWith('...')).toBe(true);
    expect(result).not.toHaveProperty('content');
    expect(result.publishedAt).toBeNull();
    expect(result.urlToImage).toBeNull();
    expect(result.id).toBe('https://example.com/report');
  });
});
