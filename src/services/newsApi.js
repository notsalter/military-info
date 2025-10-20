import axios from 'axios';
import { fetchFromRSSFeeds } from './rssService';

// API Configuration
const NEWSAPI_BASE_URL = 'https://newsapi.org/v2';
const THENEWSAPI_BASE_URL = 'https://api.thenewsapi.com/v1/news';

const NEWSAPI_KEY = import.meta.env.VITE_NEWS_API_KEY;
const THENEWSAPI_KEY = import.meta.env.VITE_THENEWSAPI_KEY;

// Cache configuration
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const CACHE_KEY_PREFIX = 'military_info_cache_';

/**
 * Cache Manager
 * Stores API responses in localStorage to work in production environments
 * where API calls might be blocked (CORS issues on Vercel/Netlify)
 */
const CacheManager = {
  set(key, data) {
    try {
      const cacheData = {
        data: data,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  },

  get(key) {
    try {
      const cached = localStorage.getItem(CACHE_KEY_PREFIX + key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      // Return cached data if less than 15 minutes old
      if (age < CACHE_DURATION) {
        console.log(`Using cached data (${Math.floor(age / 1000)}s old)`);
        return data;
      }

      // Cache expired
      return null;
    } catch (error) {
      console.warn('Failed to read cache:', error);
      return null;
    }
  },

  clear() {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith(CACHE_KEY_PREFIX))
        .forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }
};

/**
 * Fetch from NewsAPI.org
 */
const fetchFromNewsAPI = async (query, pageSize) => {
  // Calculate date range: 1 month ago to today
  const toDate = new Date().toISOString().split('T')[0]; // Today
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
  
  const response = await axios.get(`${NEWSAPI_BASE_URL}/everything`, {
    headers: {
      'X-Api-Key': NEWSAPI_KEY,
    },
    params: {
      q: query,
      language: 'en',
      sortBy: 'publishedAt',
      from: fromDate, // Start date (1 month ago)
      to: toDate,     // End date (today)
      pageSize: pageSize * 4, // Fetch 4x more to account for aggressive filtering
      excludeDomains: 'biztoc.com,fark.com,sportingnews.com,espn.com,bleacherreport.com', // Exclude aggregator and sports sites
    },
  });

  if (response.data.status === 'ok') {
    // Filter out irrelevant articles by checking title/description
    const filtered = response.data.articles.filter(article => {
      const text = `${article.title} ${article.description}`.toLowerCase();
      const source = article.source?.name?.toLowerCase() || '';
      const url = article.url?.toLowerCase() || '';
      
      // Block sports domains
      const sportsDomains = ['yahoo.com/sports', 'espn.com', 'sportingnews.com', 
        'bleacherreport.com', 'cbssports.com', 'si.com', 'foxsports.com'];
      const isSportsSite = sportsDomains.some(domain => url.includes(domain));
      
      if (isSportsSite) return false;
      
      // Comprehensive exclusion list - NON-MILITARY CONTENT
      const excludeKeywords = [
        // Food & Lifestyle
        'mustard', 'lox', 'restaurant', 'recipe', 'food', 'thanksgiving', 'gratitude',
        'curry', 'bar', 'grill', 'chef', 'cooking', 'menu', 'dining',
        
        // Sports & Entertainment (MASSIVELY EXPANDED)
        'haaland', 'soccer', 'football', 'basketball', 'baseball', 'sports', 
        'game', 'match', 'celebs', 'celebrity', 'anime', 'compression shirt',
        'nfl', 'nba', 'mlb', 'fifa', 'premier league', 'champions league',
        'sec home win', 'aggies', 'gators', 'crimson tide', 'longhorns',
        'quarterback', 'touchdown', 'playoff', 'season', 'coach',
        'scoring', 'wins', 'loses', 'team wins', 'victory over',
        'defeats', 'improves to', 'college football', 'ncaa', 'bowl game',
        'espn', 'sporting news', '6-0', 'undefeated', 'rivals', 'rankings',
        'usc', 'michigan', 'trojans', 'wolverines', 'big ten', 'pac-12', 'sec',
        'ranked team', 'conference', 'shines in', 'win over', 'no. 15',
        'final score', 'halftime', 'second half', 'yards', 'rushing',
        'passing', 'interception', 'field goal', 'kickoff',
        
        // Business & Real Estate  
        'property', 'real estate', 'jeep wrangler', 'for sale', 'auction',
        'bringatrailer', 'no reserve', 'mountain edition',
        
        // Personal/Social
        'obituary', 'passed away', 'died', 'funeral', 'marriage', 'wedding',
        'dating', 'relationship', 'stages of marriage', 'legacy',
        
        // Random/Viral
        'pickle costume', 'police chasing', 'broken water pipe',
        'video shows', 'viral video',
        
        // Natural Disasters (unless military response)
        'floods', 'landslides', 'earthquake', 'hurricane',
        
        // Space (unless military satellite)
        'spacex', 'starship', 'rocket launch',
        
        // Politics (unless defense policy)
        'election',
        
        // Cyber/Tech (unless military cyber)
        'password'
      ];
      
      // Must have at least one military keyword to be considered relevant
      const militaryKeywords = [
        'military', 'defense', 'defence', 'armed forces', 'pentagon', 'nato',
        'army', 'navy', 'air force', 'marines', 'troops', 'soldiers',
        'weapons', 'missile', 'fighter jet', 'fighter', 'tank', 'warship', 'submarine',
        'combat', 'operation', 'deployment', 'battalion', 'regiment', 'brigade',
        'ammunition', 'munitions', 'artillery', 'drone strike', 'war', 'warfare',
        'conflict', 'military base', 'defense minister', 'defence minister', 'general',
        'colonel', 'sergeant', 'tactical', 'strategic', 'national security',
        'border', 'attack', 'strike', 'raid', 'invasion', 'forces',
        'retaliatory', 'explosives plant', 'blast', 'explosion',
        'defense ministry', 'defence ministry', 'armed', 'paramilitary'
      ];
      
      // Check if article has military content
      const hasMilitaryContent = militaryKeywords.some(keyword => 
        text.includes(keyword)
      );
      
      // Check if article contains excluded keywords
      const hasExcludedContent = excludeKeywords.some(keyword => 
        text.includes(keyword)
      );
      
      // Must have military content AND not have excluded content
      return hasMilitaryContent && !hasExcludedContent;
    }).slice(0, pageSize); // Take only requested amount after filtering

    // Normalize data structure
    return filtered.map(article => ({
      title: article.title,
      description: article.description,
      url: article.url,
      urlToImage: article.urlToImage,
      publishedAt: article.publishedAt,
      source: article.source,
      content: article.content,
    }));
  }

  throw new Error('NewsAPI returned error status');
};

/**
 * Fetch from TheNewsAPI.com
 */
const fetchFromTheNewsAPI = async (query, pageSize) => {
  console.log('🔵 Calling TheNewsAPI with query:', query);
  
  // Calculate date range: 1 month ago to today
  const toDate = new Date().toISOString().split('T')[0]; // Today
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago
  
  console.log(`📅 Date range: ${fromDate} to ${toDate}`);
  
  const response = await axios.get(`${THENEWSAPI_BASE_URL}/all`, {
    params: {
      api_token: THENEWSAPI_KEY,
      search: query,
      language: 'en',
      published_after: fromDate, // Start date (1 month ago)
      published_before: toDate,   // End date (today)
      limit: pageSize * 4, // Fetch 4x more to account for aggressive filtering
      sort: 'published_at',
    },
  });

  console.log(`🔵 TheNewsAPI returned ${response.data.data?.length || 0} raw articles`);

  if (response.data.data) {
    // Filter out irrelevant articles
    const filtered = response.data.data.filter(article => {
      const text = `${article.title} ${article.description || article.snippet || ''}`.toLowerCase();
      const url = article.url?.toLowerCase() || '';
      
      // Block sports domains
      const sportsDomains = ['yahoo.com/sports', 'espn.com', 'sportingnews.com', 
        'bleacherreport.com', 'cbssports.com', 'si.com', 'foxsports.com'];
      const isSportsSite = sportsDomains.some(domain => url.includes(domain));
      
      if (isSportsSite) return false;
      
      // Comprehensive exclusion list - NON-MILITARY CONTENT
      const excludeKeywords = [
        // Food & Lifestyle
        'mustard', 'lox', 'restaurant', 'recipe', 'food', 'thanksgiving', 'gratitude',
        'curry', 'bar', 'grill', 'chef', 'cooking', 'menu', 'dining',
        
        // Sports & Entertainment (MASSIVELY EXPANDED)
        'haaland', 'soccer', 'football', 'basketball', 'baseball', 'sports', 
        'game', 'match', 'celebs', 'celebrity', 'anime', 'compression shirt',
        'nfl', 'nba', 'mlb', 'fifa', 'premier league', 'champions league',
        'sec home win', 'aggies', 'gators', 'crimson tide', 'longhorns',
        'quarterback', 'touchdown', 'playoff', 'season', 'coach',
        'scoring', 'wins', 'loses', 'team wins', 'victory over',
        'defeats', 'improves to', 'college football', 'ncaa', 'bowl game',
        'espn', 'sporting news', '6-0', 'undefeated', 'rivals', 'rankings',
        'usc', 'michigan', 'trojans', 'wolverines', 'big ten', 'pac-12', 'sec',
        'ranked team', 'conference', 'shines in', 'win over', 'no. 15',
        'final score', 'halftime', 'second half', 'yards', 'rushing',
        'passing', 'interception', 'field goal', 'kickoff',
        
        // Business & Real Estate  
        'property', 'real estate', 'jeep wrangler', 'for sale', 'auction',
        'bringatrailer', 'no reserve', 'mountain edition',
        
        // Personal/Social
        'obituary', 'passed away', 'died', 'funeral', 'marriage', 'wedding',
        'dating', 'relationship', 'stages of marriage', 'legacy',
        
        // Random/Viral
        'pickle costume', 'police chasing', 'broken water pipe',
        'video shows', 'viral video',
        
        // Natural Disasters (unless military response)
        'floods', 'landslides', 'earthquake', 'hurricane',
        
        // Space (unless military satellite)
        'spacex', 'starship', 'rocket launch',
        
        // Politics (unless defense policy)
        'election',
        
        // Cyber/Tech (unless military cyber)
        'password'
      ];
      
      // Must have at least one military keyword to be considered relevant
      const militaryKeywords = [
        'military', 'defense', 'defence', 'armed forces', 'pentagon', 'nato',
        'army', 'navy', 'air force', 'marines', 'troops', 'soldiers',
        'weapons', 'missile', 'fighter jet', 'fighter', 'tank', 'warship', 'submarine',
        'combat', 'operation', 'deployment', 'battalion', 'regiment', 'brigade',
        'ammunition', 'munitions', 'artillery', 'drone strike', 'war', 'warfare',
        'conflict', 'military base', 'defense minister', 'defence minister', 'general',
        'colonel', 'sergeant', 'tactical', 'strategic', 'national security',
        'border', 'attack', 'strike', 'raid', 'invasion', 'forces',
        'retaliatory', 'explosives plant', 'blast', 'explosion',
        'defense ministry', 'defence ministry', 'armed', 'paramilitary'
      ];
      
      // Check if article has military content
      const hasMilitaryContent = militaryKeywords.some(keyword => 
        text.includes(keyword)
      );
      
      // Check if article contains excluded keywords
      const hasExcludedContent = excludeKeywords.some(keyword => 
        text.includes(keyword)
      );
      
      // Exclude biztoc domain
      const isBiztoc = article.url && article.url.includes('biztoc.com');
      
      // Must have military content AND not have excluded content AND not biztoc
      return hasMilitaryContent && !hasExcludedContent && !isBiztoc;
    }).slice(0, pageSize); // Take only requested amount after filtering

    // Normalize data structure to match NewsAPI format
    return filtered.map(article => ({
      title: article.title,
      description: article.description || article.snippet,
      url: article.url,
      urlToImage: article.image_url,
      publishedAt: article.published_at,
      source: {
        id: article.source,
        name: article.source,
      },
      content: article.description,
    }));
  }

  throw new Error('TheNewsAPI returned no data');
};

/**
 * Main fetch function - Load ALL 3 sources simultaneously
 * Combines results from NewsAPI, TheNewsAPI, and RSS Feeds
 * 
 * @param {string} query - Search term for news articles  
 * @param {number} pageSize - Number of articles to fetch (default: 20)
 * @returns {Promise} - Promise containing articles array
 */
export const fetchNews = async (query = 'defense', pageSize = 20) => {
  const cacheKey = `${query}_${pageSize}`;

  // Check cache first to avoid aggressive API calls
  const cachedArticles = CacheManager.get(cacheKey);
  if (cachedArticles && cachedArticles.length > 0) {
    console.log(`💾 Using cached data (${cachedArticles.length} articles)`);
    return {
      success: true,
      articles: cachedArticles,
      totalResults: cachedArticles.length,
      source: 'Cache',
      cached: true,
    };
  }

  try {
    console.log('🚀 Fetching from ALL 3 sources simultaneously...');
    
    // Fetch from all 3 sources at the same time
    const [newsApiResult, theNewsApiResult, rssResult] = await Promise.allSettled([
      fetchFromNewsAPI(query, pageSize).catch(err => {
        console.warn('NewsAPI failed:', err.message);
        return [];
      }),
      fetchFromTheNewsAPI(query, pageSize).catch(err => {
        console.warn('TheNewsAPI failed:', err.message);
        return [];
      }),
      fetchFromRSSFeeds(pageSize).then(result => result.articles || []).catch(err => {
        console.warn('RSS feeds failed:', err.message);
        return [];
      })
    ]);

    // Combine all successful results
    const allArticles = [
      ...(newsApiResult.status === 'fulfilled' ? newsApiResult.value : []),
      ...(theNewsApiResult.status === 'fulfilled' ? theNewsApiResult.value : []),
      ...(rssResult.status === 'fulfilled' ? rssResult.value : [])
    ];

    if (allArticles.length === 0) {
      // No articles from any source, try cache
      console.log('All 3 sources failed, checking cache...');
      const cachedArticles = CacheManager.get(cacheKey);
      
      if (cachedArticles && cachedArticles.length > 0) {
        return {
          success: true,
          articles: cachedArticles,
          totalResults: cachedArticles.length,
          source: 'Cache',
          cached: true,
        };
      }

      return {
        success: false,
        error: 'Tidak dapat mengambil berita dari semua sumber.',
        articles: [],
      };
    }

    // Remove duplicates based on title similarity
    const uniqueArticles = removeDuplicates(allArticles);

    // Sort by date (newest first)
    uniqueArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // Take top articles
    const articles = uniqueArticles.slice(0, pageSize);

    // Cache the results
    CacheManager.set(cacheKey, articles);

    // Determine source label
    const sources = [];
    if (newsApiResult.status === 'fulfilled' && newsApiResult.value.length > 0) sources.push('NewsAPI');
    if (theNewsApiResult.status === 'fulfilled' && theNewsApiResult.value.length > 0) sources.push('TheNewsAPI');
    if (rssResult.status === 'fulfilled' && rssResult.value.length > 0) sources.push('RSS');

    console.log(`✅ Got ${articles.length} articles from: ${sources.join(' + ')}`);

    return {
      success: true,
      articles: articles,
      totalResults: articles.length,
      source: sources.join(' + '),
    };
  } catch (error) {
    console.error('Fetch failed:', error);
    
    // Try cache as final fallback
    const cachedArticles = CacheManager.get(cacheKey);
    if (cachedArticles && cachedArticles.length > 0) {
      return {
        success: true,
        articles: cachedArticles,
        totalResults: cachedArticles.length,
        source: 'Cache',
        cached: true,
      };
    }

    return {
      success: false,
      error: 'Terjadi kesalahan saat mengambil berita.',
      articles: [],
    };
  }
};

/**
 * Remove duplicate articles based on title similarity
 */
const removeDuplicates = (articles) => {
  const seen = new Set();
  return articles.filter(article => {
    // Normalize title for comparison
    const normalizedTitle = article.title?.toLowerCase().trim();
    if (!normalizedTitle || seen.has(normalizedTitle)) {
      return false;
    }
    seen.add(normalizedTitle);
    return true;
  });
};

/**
 * Clear all cached data
 */
export const clearCache = () => {
  CacheManager.clear();
};

export default { fetchNews, clearCache };
