import axios from 'axios';

/**
 * RSS to JSON Service
 * Uses rss2json.com API to convert RSS feeds to JSON format
 * This works in the browser (no Node.js dependencies needed)
 */

// RSS2JSON API endpoint (free tier: 10,000 requests/day)
const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json';

// Cache configuration
const RSS_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const RSS_CACHE_KEY = 'military_info_rss_cache';

// Simple RSS cache manager
const RSSCache = {
  set(data) {
    try {
      const cacheData = {
        data: data,
        timestamp: Date.now(),
      };
      localStorage.setItem(RSS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache RSS data:', error);
    }
  },

  get() {
    try {
      const cached = localStorage.getItem(RSS_CACHE_KEY);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age < RSS_CACHE_DURATION) {
        console.log(`📦 Using cached RSS data (${Math.floor(age / 60000)} min old)`);
        return data;
      }

      return null;
    } catch (error) {
      console.warn('Failed to read RSS cache:', error);
      return null;
    }
  },
};

// Curated list of military and defense RSS feeds
const MILITARY_RSS_FEEDS = [
  'https://www.defensenews.com/arc/outboundfeeds/rss/',
  'https://www.militarytimes.com/arc/outboundfeeds/rss/',
  'https://breakingdefense.com/feed/',
  'https://theaviationist.com/feed/',
  'https://www.navalnews.com/feed/',
  'https://www.defenseone.com/rss/all/',
  'https://www.thedefensepost.com/feed/',
  'https://www.nationaldefensemagazine.org/rss',
  'https://warontherocks.com/feed/',
  'https://www.darpa.mil/news/rss',
  'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx',
  // 'https://www.military.com/rss' // Disabled: returns 500 errors
];

/**
 * Fetch a single RSS feed converted to JSON
 */
const fetchSingleRSSFeed = async (feedUrl) => {
  try {
    const response = await axios.get(RSS2JSON_API, {
      params: {
        rss_url: feedUrl,
        count: 10 // Limit to 10 items per feed
      }
    });

    if (response.data.status === 'ok' && response.data.items) {
      return response.data.items.map(item => ({
        title: item.title || '',
        description: item.description || '',
        url: item.link || '',
        urlToImage: item.thumbnail || item.enclosure?.link || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400',
        publishedAt: item.pubDate || new Date().toISOString(),
        source: {
          id: response.data.feed?.title?.toLowerCase().replace(/\s+/g, '-') || 'rss-feed',
          name: response.data.feed?.title || 'RSS Feed'
        },
        content: item.content || item.description || ''
      }));
    }

    return [];
  } catch (error) {
    console.warn(`Failed to fetch RSS feed ${feedUrl}:`, error.message);
    return [];
  }
};

/**
 * Fetch from all military RSS feeds
 * @param {number} limit - Maximum articles to return
 */
export const fetchFromRSSFeeds = async (limit = 20) => {
  // Check cache first to avoid aggressive API calls
  const cachedData = RSSCache.get();
  if (cachedData && cachedData.articles && cachedData.articles.length > 0) {
    return cachedData;
  }

  try {
    console.log('📡 Fetching from RSS feeds via RSS2JSON...');

    // Fetch from all feeds concurrently
    const feedPromises = MILITARY_RSS_FEEDS.map(url => fetchSingleRSSFeed(url));
    const feedResults = await Promise.all(feedPromises);

    // Flatten and combine all articles
    const allArticles = feedResults.flat();

    if (allArticles.length === 0) {
      throw new Error('No articles from RSS feeds');
    }

    // Sort by date (newest first)
    allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // Remove duplicates
    const uniqueArticles = removeDuplicates(allArticles);

    // Take only the requested number
    const articles = uniqueArticles.slice(0, limit);

    console.log(`✅ Fetched ${articles.length} articles from ${MILITARY_RSS_FEEDS.length} RSS feeds`);

    const result = {
      success: true,
      articles: articles,
      totalResults: articles.length,
      source: 'RSS Feeds',
      feedCount: MILITARY_RSS_FEEDS.length
    };

    // Cache the result
    RSSCache.set(result);

    return result;
  } catch (error) {
    console.error('RSS fetch failed:', error);
    
    // Try to return cached data even if expired, as fallback
    const cachedData = RSSCache.get();
    if (cachedData && cachedData.articles) {
      console.log('⚠️ Using expired RSS cache as fallback');
      return cachedData;
    }
    
    return {
      success: false,
      error: 'Failed to fetch RSS feeds',
      articles: []
    };
  }
};

/**
 * Remove duplicate articles based on title similarity
 */
const removeDuplicates = (articles) => {
  const seen = new Set();
  return articles.filter(article => {
    const normalizedTitle = article.title?.toLowerCase().trim();
    if (!normalizedTitle || seen.has(normalizedTitle)) {
      return false;
    }
    seen.add(normalizedTitle);
    return true;
  });
};

export default { fetchFromRSSFeeds };
