import axios from 'axios';

/**
 * RSS to JSON Service
 * Integrates a resilient dual-sourcing model:
 * 1. Primary: rss2json.com API
 * 2. Secondary/Fallback: Fetching feed via CORS-proxy and parsing raw XML client-side.
 */

const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json';
const RSS_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const RSS_CACHE_KEY = 'military_info_rss_cache';

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

const MILITARY_RSS_FEEDS = [
  { url: 'https://www.defensenews.com/arc/outboundfeeds/rss/', name: 'Defense News' },
  { url: 'https://www.militarytimes.com/arc/outboundfeeds/rss/', name: 'Military Times' },
  { url: 'https://breakingdefense.com/feed/', name: 'Breaking Defense' },
  { url: 'https://theaviationist.com/feed/', name: 'The Aviationist' },
  { url: 'https://www.navalnews.com/feed/', name: 'Naval News' },
  { url: 'https://www.defenseone.com/rss/all/', name: 'Defense One' },
  { url: 'https://www.thedefensepost.com/feed/', name: 'The Defense Post' },
  { url: 'https://www.nationaldefensemagazine.org/rss', name: 'National Defense' },
  { url: 'https://warontherocks.com/feed/', name: 'War on the Rocks' },
  { url: 'https://www.darpa.mil/news/rss', name: 'DARPA News' },
  { url: 'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx', name: 'US Dept of Defense' },
  { url: 'https://www.realcleardefense.com/rss.xml', name: 'RealClearDefense' },
  { url: 'https://www.c4isrnet.com/arc/outboundfeeds/rss/', name: 'C4ISRNET' },
  { url: 'https://www.dsca.mil/press-media/major-arms-sales/rss', name: 'DSCA Major Sales' },
  { url: 'https://www.army.mil/rss/feeds/combat.xml', name: 'US Army Combat' },
  { url: 'https://www.af.mil/DesktopModules/ArticleCS/RSS.ashx?PortalId=1&CategoryID=22572', name: 'US Air Force' },
  { url: 'https://www.navy.mil/DesktopModules/ArticleCS/RSS.ashx?PortalId=1&CategoryID=22737', name: 'US Navy News' },
  { url: 'https://www.army-technology.com/feed/', name: 'Army Technology' },
  { url: 'https://www.naval-technology.com/feed/', name: 'Naval Technology' },
  { url: 'https://www.aerospace-technology.com/feed/', name: 'Aerospace Technology' },
  { url: 'https://www.gov.uk/government/organisations/ministry-of-defence.atom', name: 'UK MoD News' }
];

/**
 * Parses raw XML RSS/Atom feed into unified article JSON structure
 */
const parseXMLRSS = (xmlText, feedUrl, defaultFeedName) => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check for XML parsing error
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('XML parsing failed');
    }

    const items = xmlDoc.querySelectorAll('item');
    const feedTitle = xmlDoc.querySelector('channel > title')?.textContent || defaultFeedName;
    
    if (items && items.length > 0) {
      return Array.from(items).map(item => {
        const title = item.querySelector('title')?.textContent || '';
        const description = item.querySelector('description')?.textContent || item.querySelector('encoded')?.textContent || '';
        const link = item.querySelector('link')?.textContent || item.querySelector('link')?.getAttribute('href') || '';
        const pubDate = item.querySelector('pubDate')?.textContent || item.querySelector('date')?.textContent || new Date().toISOString();
        
        // Find image
        let imageUrl = '';
        const mediaContent = item.getElementsByTagName('media:content')[0] || item.getElementsByTagName('content')[0];
        if (mediaContent) {
          imageUrl = mediaContent.getAttribute('url');
        }
        if (!imageUrl) {
          const enclosure = item.querySelector('enclosure');
          if (enclosure) {
            imageUrl = enclosure.getAttribute('url');
          }
        }
        if (!imageUrl) {
          const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
          if (imgMatch) {
            imageUrl = imgMatch[1];
          }
        }
        
        const cleanDesc = description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        
        return {
          title: title.trim(),
          description: cleanDesc.slice(0, 300) + (cleanDesc.length > 300 ? '...' : ''),
          url: link.trim(),
          urlToImage: imageUrl || null,
          publishedAt: new Date(pubDate).toISOString(),
          source: {
            id: feedTitle.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name: feedTitle
          },
          content: cleanDesc
        };
      });
    } else {
      // Try Atom Format
      const entries = xmlDoc.querySelectorAll('entry');
      if (entries && entries.length > 0) {
        return Array.from(entries).map(entry => {
          const title = entry.querySelector('title')?.textContent || '';
          const summary = entry.querySelector('summary')?.textContent || entry.querySelector('content')?.textContent || '';
          const link = entry.querySelector('link')?.getAttribute('href') || entry.querySelector('link')?.textContent || '';
          const published = entry.querySelector('published')?.textContent || entry.querySelector('updated')?.textContent || new Date().toISOString();
          
          let imageUrl = '';
          const mediaContent = entry.getElementsByTagName('media:content')[0];
          if (mediaContent) {
            imageUrl = mediaContent.getAttribute('url');
          }
          
          const cleanDesc = summary.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
          
          return {
            title: title.trim(),
            description: cleanDesc.slice(0, 300) + (cleanDesc.length > 300 ? '...' : ''),
            url: link.trim(),
            urlToImage: imageUrl || null,
            publishedAt: new Date(published).toISOString(),
            source: {
              id: feedTitle.toLowerCase().replace(/[^a-z0-9]/g, '-'),
              name: feedTitle
            },
            content: cleanDesc
          };
        });
      }
    }
    return [];
  } catch (error) {
    console.warn(`XML Parsing failed for ${feedUrl}:`, error.message);
    return [];
  }
};

/**
 * Fetch a single feed via local XML fallback (using a CORS proxy)
 */
const fetchFeedViaCORSProxy = async (feed) => {
  try {
    // Using Allorigins.win as a reliable CORS proxy
    const response = await axios.get(`https://api.allorigins.win/get`, {
      params: {
        url: feed.url
      },
      timeout: 8000
    });

    if (response.data && response.data.contents) {
      return parseXMLRSS(response.data.contents, feed.url, feed.name);
    }
    return [];
  } catch (error) {
    console.warn(`CORS Proxy failed for ${feed.name}:`, error.message);
    return [];
  }
};

/**
 * Fetch a single RSS feed via rss2json API
 */
const fetchSingleRSSFeed = async (feed) => {
  try {
    const response = await axios.get(RSS2JSON_API, {
      params: {
        rss_url: feed.url,
        count: 10
      },
      timeout: 8000
    });

    if (response.data.status === 'ok' && response.data.items) {
      return response.data.items.map(item => {
        const cleanDesc = (item.description || item.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        return {
          title: item.title || '',
          description: cleanDesc.slice(0, 300) + (cleanDesc.length > 300 ? '...' : ''),
          url: item.link || '',
          urlToImage: item.thumbnail || item.enclosure?.link || null,
          publishedAt: item.pubDate || new Date().toISOString(),
          source: {
            id: response.data.feed?.title?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'rss-feed',
            name: response.data.feed?.title || feed.name
          },
          content: cleanDesc
        };
      });
    }

    // Fallback if rss2json returned error
    return fetchFeedViaCORSProxy(feed);
  } catch (error) {
    console.warn(`rss2json failed for ${feed.name}, trying CORS proxy fallback...`);
    return fetchFeedViaCORSProxy(feed);
  }
};

/**
 * Fetch from all military RSS feeds
 * @param {number} limit - Maximum articles to return
 */
export const fetchFromRSSFeeds = async (limit = 30) => {
  const cachedData = RSSCache.get();
  if (cachedData && cachedData.articles && cachedData.articles.length > 0) {
    return cachedData;
  }

  try {
    console.log('📡 Fetching from RSS feeds (dual mechanism)...');

    // Fetch from all feeds concurrently
    const feedPromises = MILITARY_RSS_FEEDS.map(feed => fetchSingleRSSFeed(feed));
    const feedResults = await Promise.allSettled(feedPromises);

    // Flatten and combine all successfully fetched articles
    const allArticles = feedResults
      .filter(res => res.status === 'fulfilled')
      .map(res => res.value)
      .flat();

    if (allArticles.length === 0) {
      throw new Error('No articles fetched from RSS feeds');
    }

    // Sort by date (newest first)
    allArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // Remove duplicates
    const uniqueArticles = removeDuplicates(allArticles);

    // Take limit size
    const articles = uniqueArticles.slice(0, limit);

    console.log(`✅ Completed RSS fetch. Total loaded: ${articles.length} articles`);

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
    console.error('RSS fetch operation failed:', error);
    
    // Try to return expired cache as absolute fallback
    const cachedData = RSSCache.get();
    if (cachedData && cachedData.articles) {
      console.log('⚠️ Using expired RSS cache as fallback');
      return cachedData;
    }
    
    return {
      success: false,
      error: 'Failed to fetch RSS feeds: ' + error.message,
      articles: []
    };
  }
};

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
