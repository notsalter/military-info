import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { fetchNews } from './newsApi';

vi.mock('axios');

describe('fetchNews', () => {
  it('should not filter out articles with keywords like "cyberattack"', async () => {
    const mockArticles = {
      data: {
        status: 'ok',
        articles: [
          {
            title: 'Military Confronts Major Cyberattack',
            description: 'A cyberattack targeted military infrastructure.',
            source: { name: 'Test News' },
            url: 'http://example.com/cyberattack'
          },
          {
            title: 'Regular Military Drills',
            description: 'Standard military drills.',
            source: { name: 'Test News' },
            url: 'http://example.com/drills'
          }
        ]
      }
    };

    axios.get.mockResolvedValue(mockArticles);

    const result = await fetchNews('military', 10);

    expect(result.articles.length).toBe(2);
    expect(result.articles[0].title).toBe('Military Confronts Major Cyberattack');
  });
});