import { it, expect } from 'vitest';
import './testStorage';
import * as registry from './feeds';
it('uses the official DoD / War RSS endpoint without changing its stable source identity', () => {
  expect(registry.FEEDS.find(feed => feed.id === 'us-dept-of-defense-replacement')).toEqual({
    id: 'us-dept-of-defense-replacement', name: 'US Department of Defense / War',
    url: 'https://www.war.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=20',
    region: 'United States / Global',
  });
});
it('uses the canonical Indomiliter apex feed URL without changing its stable source identity', () => {
  expect(registry.FEEDS.find(feed => feed.id === 'indomiliter')).toEqual({
    id: 'indomiliter', name: 'Indomiliter',
    url: 'https://indomiliter.com/feed/', region: 'Asia / Indonesia',
  });
});
it('exposes 30 unique verified feed endpoints without claiming current health', () => {
  expect(registry.FEEDS).toBeInstanceOf(Array);
  expect(registry.FEEDS).toHaveLength(30);
  expect(new Set(registry.FEEDS.map(feed => feed.url)).size).toBe(30);
  expect(new Set(registry.FEEDS.map(feed => feed.id)).size).toBe(30);
  for (const feed of registry.FEEDS) {
    expect(feed).toEqual({ id: expect.any(String), name: expect.any(String), url: expect.stringMatching(/^https:\/\//), region: expect.any(String) });
  }
});
