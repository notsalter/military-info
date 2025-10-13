# 📚 Technical Documentation - Military Info

Complete technical reference for developers working with the Military Info application.

---

## Table of Contents

1. [API Integration](#api-integration)
2. [Caching System](#caching-system)
3. [Content Filtering](#content-filtering)
4. [RSS Integration](#rss-integration)
5. [Architecture](#architecture)

---

## 1. API Integration

### Dual API System

Military Info uses **three data sources** simultaneously for maximum reliability and content diversity:

#### **Source 1: NewsAPI.org**
- **Endpoint**: `https://newsapi.org/v2/everything`
- **Rate Limit**: 100 requests/day (free tier)
- **Coverage**: 80,000+ news sources worldwide
- **Date Range**: 30 days back from current date

**Parameters:**
```javascript
{
  q: 'defense',           // Search query
  language: 'en',         // English articles only
  from: '2025-09-13',     // 30 days ago
  to: '2025-10-13',       // Today
  pageSize: 80,           // Fetch 4x more (for filtering)
  sortBy: 'publishedAt'   // Newest first
}
```

#### **Source 2: TheNewsAPI.com**
- **Endpoint**: `https://api.thenewsapi.com/v1/news/all`
- **Rate Limit**: 150 requests/day (free tier)
- **Coverage**: 30,000+ sources
- **Date Range**: 30 days back from current date

**Parameters:**
```javascript
{
  api_token: 'xxx',
  search: 'defense',
  language: 'en',
  published_after: '2025-09-13',
  published_before: '2025-10-13',
  limit: 80,
  sort: 'published_at'
}
```

#### **Source 3: RSS Feeds (via RSS2JSON)**
- **Endpoint**: `https://api.rss2json.com/v1/api.json`
- **Rate Limit**: 10,000 requests/day (free tier)
- **Coverage**: 6 curated military news sources
- **Real-time**: Latest articles from RSS feeds

**RSS Sources:**
1. Defense News - `defensenews.com`
2. Military Times - `militarytimes.com`
3. Breaking Defense - `breakingdefense.com`
4. The Aviationist - `theaviationist.com`
5. Naval News - `navalnews.com`
6. Defense One - `defenseone.com`

### Parallel Fetching Strategy

All three sources are fetched **simultaneously** using `Promise.allSettled()`:

```javascript
const [newsApiResult, theNewsApiResult, rssResult] = await Promise.allSettled([
  fetchFromNewsAPI(query, pageSize),
  fetchFromTheNewsAPI(query, pageSize),
  fetchFromRSSFeeds(pageSize)
]);
```

**Benefits:**
- ⚡ **Faster**: No sequential waiting
- 🛡️ **Resilient**: One failure doesn't affect others
- 📊 **Diverse**: Combines results from all sources

### Error Handling

Each API has individual error handling with graceful degradation:

```javascript
.catch(err => {
  console.warn('NewsAPI failed:', err.message);
  return []; // Return empty array, don't crash
})
```

**Fallback Chain:**
1. Try all 3 APIs simultaneously
2. If all fail → Check cache
3. If cache available → Return cached data
4. If no cache → Show error message

---

## 2. Caching System

### Overview

Two-layer caching system using `localStorage` with 15-minute TTL.

### Layer 1: Main Article Cache

**Location**: `src/services/newsApi.js` → `CacheManager`

**Key Format**: `military_info_cache_{query}_{pageSize}`

**Example**: `military_info_cache_defense_20`

**Flow:**
```
User Request
  ↓
Check Cache (< 15 min old?)
  ↓ YES          ↓ NO
Return Cache   Fetch APIs
               Store Cache
               Return Fresh
```

**Implementation:**
```javascript
const CacheManager = {
  set(key, data) {
    const cacheData = {
      data: data,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(cacheData));
  },

  get(key) {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    if (age < CACHE_DURATION) { // 15 minutes
      return data;
    }
    return null; // Expired
  }
};
```

### Layer 2: RSS Cache

**Location**: `src/services/rssService.js` → `RSSCache`

**Key**: `military_info_rss_cache` (single key)

**Purpose**: Reduce RSS2JSON API calls (10k/day limit)

**Flow:**
```
RSS Request
  ↓
Check RSS Cache (< 15 min?)
  ↓ YES              ↓ NO
Return RSS Cache   Fetch 6 Feeds
                   Combine & Sort
                   Store Cache
                   Return Fresh
```

### Cache Benefits

**Performance:**
- First load: ~2-3 seconds (API calls)
- Cached load: <100ms (instant)
- **20-30x faster** with cache

**API Usage Reduction:**
- Without cache: 10 refreshes = 30 API calls
- With cache: 10 refreshes = 3 API calls
- **80% reduction** in API usage

### Manual Cache Control

**Clear all caches:**
```javascript
// In browser console
Object.keys(localStorage)
  .filter(k => k.startsWith('military_info'))
  .forEach(k => localStorage.removeItem(k));
```

**View cache:**
```javascript
// Main cache
localStorage.getItem('military_info_cache_defense_20')

// RSS cache
localStorage.getItem('military_info_rss_cache')
```

---

## 3. Content Filtering

### Two-Layer Filtering System

#### **Layer 1: Positive Keywords (Military Content)**

Articles **must contain** at least one of these keywords:

```javascript
const militaryKeywords = [
  'military', 'defense', 'army', 'navy', 'air force', 'marines',
  'warship', 'fighter jet', 'submarine', 'aircraft carrier',
  'missile', 'tank', 'drone', 'uav', 'weapon', 'combat',
  'pentagon', 'nato', 'strategic', 'tactical', 'forces',
  'battalion', 'regiment', 'squadron', 'fleet', 'brigade',
  // ... 40+ total keywords
];
```

#### **Layer 2: Negative Keywords (Exclusions)**

Articles **must NOT contain** these keywords:

```javascript
const excludeKeywords = [
  // Sports (Primary Source of False Positives)
  'nfl', 'nba', 'nhl', 'mlb', 'premier league', 'bundesliga',
  'champions league', 'touchdown', 'quarterback', 'basketball',
  'football', 'soccer', 'baseball', 'hockey', 'cricket',
  
  // Food & Lifestyle
  'recipe', 'restaurant', 'cooking', 'menu', 'chef',
  
  // Entertainment
  'movie', 'film', 'actor', 'actress', 'hollywood',
  
  // Gaming
  'video game', 'esports', 'gaming', 'playstation',
  
  // ... 60+ total exclusions
];
```

### Filtering Logic

```javascript
// Step 1: Must have military keywords
const hasMilitaryContent = militaryKeywords.some(keyword => 
  text.includes(keyword)
);

// Step 2: Must NOT have excluded keywords
const hasExcludedContent = excludeKeywords.some(keyword => 
  text.includes(keyword)
);

// Step 3: Block sports domains
const sportsDomains = ['yahoo.com/sports', 'espn.com', ...];
const isSportsSite = sportsDomains.some(domain => 
  url.includes(domain)
);

// Final decision
return hasMilitaryContent && !hasExcludedContent && !isSportsSite;
```

### Why Aggressive Filtering?

**Problem**: Generic military terms appear in sports
- "Defense" → NFL/NBA defensive strategies
- "Forces" → Team forces turnover
- "Attack" → Offensive attack in soccer
- "Strike" → Baseball strikes

**Solution**: 
- Fetch 4x more articles (pageSize × 4 = 80 articles)
- Apply strict filtering
- Return top 20 relevant articles

**Result**:
- 80 raw articles → ~20 filtered articles (75% removal rate)
- High quality military-specific content

---

## 4. RSS Integration

### Why RSS?

**Advantages:**
- ✅ No API key required for feeds themselves
- ✅ Real-time updates from official sources
- ✅ Bypasses generic news API limitations
- ✅ Direct from military news publishers

**Challenge:**
- ❌ RSS parsing requires Node.js libraries (`rss-parser`)
- ❌ Node.js doesn't work in browser

**Solution:**
- ✅ Use RSS2JSON API (converts RSS → JSON in cloud)
- ✅ Browser makes simple HTTP request
- ✅ No Node.js dependencies needed

### RSS2JSON Implementation

```javascript
const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json';

const response = await axios.get(RSS2JSON_API, {
  params: {
    rss_url: 'https://www.defensenews.com/arc/outboundfeeds/rss/',
    count: 10 // Items per feed
  }
});

// Response format:
{
  status: 'ok',
  items: [
    {
      title: 'Article Title',
      link: 'https://...',
      pubDate: '2025-10-13 12:00:00',
      description: 'Article excerpt...',
      thumbnail: 'https://...'
    }
  ]
}
```

### RSS Feed Selection

**Criteria:**
1. Military/defense-focused publishers
2. Reliable RSS feed availability
3. High-quality content
4. Active updates (daily/weekly)

**Current Feeds (6 active):**
- ✅ Defense News - Leading defense industry news
- ✅ Military Times - US military news & benefits
- ✅ Breaking Defense - Defense acquisition & policy
- ✅ The Aviationist - Military aviation news
- ✅ Naval News - Naval & maritime defense
- ✅ Defense One - Defense policy & tech
- ❌ Military.com - Disabled (500 errors)

### RSS Caching

RSS feeds have **separate cache** with 15-min TTL:

```javascript
const RSSCache = {
  set(data) {
    localStorage.setItem('military_info_rss_cache', JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  },
  
  get() {
    const cached = localStorage.getItem('military_info_rss_cache');
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    return age < 900000 ? data : null; // 15 min = 900,000 ms
  }
};
```

**Benefit**: 6 RSS feeds × multiple refreshes = potential 60+ API calls  
**With cache**: Only 1 fetch per 15 minutes

---

## 5. Architecture

### Technology Stack

```
Frontend:
├── React 19.1.1         (UI framework)
├── Vite 7.1.7           (Build tool, dev server)
├── Tailwind CSS 3.4.1   (Styling)
└── Axios 1.12.2         (HTTP client)

APIs:
├── NewsAPI.org          (News aggregation)
├── TheNewsAPI.com       (News aggregation)
└── RSS2JSON API         (RSS conversion)

Storage:
└── localStorage         (Client-side caching)
```

### Component Structure

```
src/
├── App.jsx                    (Main app logic)
├── main.jsx                   (React entry point)
├── index.css                  (Tailwind imports)
├── components/
│   ├── ArticleCard.jsx       (Individual article display)
│   ├── ArticleGrid.jsx       (Grid layout)
│   ├── SearchBar.jsx         (Search input)
│   ├── Loading.jsx           (Loading spinner)
│   └── ErrorMessage.jsx      (Error display)
└── services/
    ├── newsApi.js            (API integration + caching)
    └── rssService.js         (RSS fetching + caching)
```

### Data Flow

```
User Action (Search/Load)
    ↓
App.jsx → fetchNews()
    ↓
newsApi.js → Check Cache
    ↓ (Cache Miss)
Promise.allSettled([
  NewsAPI,
  TheNewsAPI,
  RSS Feeds ← rssService.js
])
    ↓
Combine Results
    ↓
Apply Filters
    ↓
Remove Duplicates
    ↓
Sort by Date
    ↓
Cache Results
    ↓
Return to App.jsx
    ↓
ArticleGrid → ArticleCard
    ↓
Render UI
```

### File Sizes

```
newsApi.js:     456 lines  (API logic + filtering + caching)
rssService.js:  178 lines  (RSS integration + caching)
App.jsx:        156 lines  (Main app component)
ArticleCard:     67 lines  (Card UI)
ArticleGrid:     25 lines  (Grid layout)
SearchBar:       45 lines  (Search UI)
Loading:         18 lines  (Spinner)
ErrorMessage:    20 lines  (Error UI)
```

### State Management

**Simple React useState (No Redux needed):**

```javascript
const [articles, setArticles] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [currentQuery, setCurrentQuery] = useState('defense');
const [dataSource, setDataSource] = useState('');
```

### Environment Variables

```bash
VITE_NEWS_API_KEY=ad7c3747fc484b9c93e67a57aed0555d
VITE_THENEWSAPI_KEY=ZsXwrqPYBSgY59nK1YrLVhRhOGHTRqSd2f87MQ7M
```

**Note**: `VITE_` prefix required for Vite to expose to client

### Build Configuration

**Development:**
```bash
npm run dev
# → Vite dev server on http://localhost:5173
# → Hot module replacement (HMR)
# → Fast refresh
```

**Production:**
```bash
npm run build
# → Static files in dist/
# → Minified JS/CSS
# → Optimized assets
```

### Performance Metrics

**Initial Load (No Cache):**
- HTML: ~2 KB
- JS Bundle: ~145 KB (minified)
- CSS: ~8 KB (Tailwind purged)
- API Calls: 3 (parallel)
- Time: ~2-3 seconds

**Cached Load:**
- No API calls
- Time: <100ms
- Data: From localStorage

---

## Troubleshooting

### Issue: "No articles showing"

**Possible causes:**
1. API keys not configured
2. Rate limit exceeded
3. Filtering too aggressive
4. Network error

**Debug steps:**
```javascript
// Check console for:
console.log('🚀 Fetching from ALL 3 sources simultaneously...');
console.log('✅ Got X articles from: ...');

// If seeing errors, check:
- .env file has keys
- Keys are valid (not expired)
- Internet connection working
```

### Issue: "Cached data not updating"

**Cause**: 15-minute cache TTL

**Solutions:**
1. Wait 15 minutes for auto-refresh
2. Clear cache manually (see section 2)
3. Change search query (different cache key)

### Issue: "Sports articles appearing"

**Cause**: Filter needs updating

**Solution**: Add keyword to exclusion list in `newsApi.js`:
```javascript
const excludeKeywords = [
  // ... existing keywords
  'your_new_keyword_here'
];
```

---

## API Rate Limits

| API | Free Tier Limit | Usage per Load | Safe Daily Loads |
|-----|----------------|----------------|------------------|
| NewsAPI | 100 req/day | 1 | 100 (no cache) / 400+ (with cache) |
| TheNewsAPI | 150 req/day | 1 | 150 (no cache) / 600+ (with cache) |
| RSS2JSON | 10,000 req/day | 6 | 1,666 (no cache) / 6,664+ (with cache) |

**With caching**: One request per 15 minutes = **96 requests/day max**

---

## Future Enhancements

### Potential Improvements:
1. **Backend Caching** - Redis/Vercel KV for shared cache
2. **PWA Support** - Service workers for offline
3. **Infinite Scroll** - Load more articles on scroll
4. **Category Filters** - Filter by air/naval/ground
5. **Bookmarks** - Save favorite articles
6. **Dark Mode** - Theme toggle
7. **Share Buttons** - Social media integration
8. **Mobile App** - React Native version

---

## References

- [NewsAPI Documentation](https://newsapi.org/docs)
- [TheNewsAPI Documentation](https://www.thenewsapi.com/documentation)
- [RSS2JSON Documentation](https://rss2json.com/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com)

---

**Last Updated**: October 13, 2025  
**Version**: 1.0.0
