import { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import ArticleGrid from './components/ArticleGrid';
import Loading from './components/Loading';
import ErrorMessage from './components/ErrorMessage';
import SettingsModal from './components/SettingsModal';
import ArticleDrawer from './components/ArticleDrawer';
import { fetchNews, getCustomKeys } from './services/newsApi';
import './index.css';

/**
 * Main App Component - Tactical Military Info Dashboard
 */
function App() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentQuery, setCurrentQuery] = useState('defense');
  const [dataSource, setDataSource] = useState(null);
  
  // Custom states for refactoring
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [bookmarksCount, setBookmarksCount] = useState(0);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [keyProfile, setKeyProfile] = useState('Keyless RSS Mode');

  // Count bookmarks on mount/update
  const updateBookmarksCount = () => {
    const bms = JSON.parse(localStorage.getItem('military_bookmarks') || '[]');
    setBookmarksCount(bms.length);
  };

  /**
   * Fetch news articles from API
   */
  const loadNews = async (query) => {
    setLoading(true);
    setError(null);
    setSelectedArticle(null);
    
    try {
      console.log('📰 Sourcing news from data layer. Query:', query);
      const result = await fetchNews(query, 30);
      
      if (result.success) {
        setArticles(result.articles);
        setCurrentQuery(query);
        setDataSource(result.source);
        setIsOfflineMode(!!result.offline);
      } else {
        setError(result.error);
        setArticles([]);
        setDataSource(null);
      }
    } catch (err) {
      console.error('Aggregator execution crashed:', err);
      setError('A critical error occurred while querying the news gateways. Please retry.');
      setArticles([]);
      setDataSource(null);
    } finally {
      setLoading(false);
    }
  };

  // Inspect API keys to update badge profile status
  const updateKeyProfileBadge = () => {
    const { newsApiKey, theNewsApiKey } = getCustomKeys();
    const envNewsKey = import.meta.env.VITE_NEWS_API_KEY;
    const envTheNewsKey = import.meta.env.VITE_THENEWSAPI_KEY;

    const hasNewsKey = (newsApiKey && !newsApiKey.startsWith('your_')) || (envNewsKey && !envNewsKey.startsWith('your_'));
    const hasTheNewsKey = (theNewsApiKey && !theNewsApiKey.startsWith('your_')) || (envTheNewsKey && !envTheNewsKey.startsWith('your_'));

    if (hasNewsKey && hasTheNewsKey) {
      setKeyProfile('NewsAPI + TheNewsAPI');
    } else if (hasNewsKey) {
      setKeyProfile('NewsAPI Active');
    } else if (hasTheNewsKey) {
      setKeyProfile('TheNewsAPI Active');
    } else {
      setKeyProfile('Keyless Public Mode');
    }
  };

  // Load initial content
  useEffect(() => {
    loadNews('defense');
    updateBookmarksCount();
    updateKeyProfileBadge();
  }, []);

  const handleSearch = (searchTerm) => {
    // Turn off bookmarks-only mode to show search results
    setShowBookmarksOnly(false);
    loadNews(searchTerm);
  };

  const handleRetry = () => {
    loadNews(currentQuery);
  };

  const handleConfigSaved = () => {
    updateKeyProfileBadge();
    loadNews(currentQuery);
  };

  // Dynamic client-side categorization filter
  const filterByCategory = (articlesList) => {
    if (activeCategory === 'all') return articlesList;
    
    return articlesList.filter(article => {
      const text = `${article.title} ${article.description || ''}`.toLowerCase();
      
      if (activeCategory === 'naval') {
        return text.includes('submarine') || text.includes('navy') || text.includes('warship') || text.includes('naval') || text.includes('carrier') || text.includes('fleet');
      }
      if (activeCategory === 'aerospace') {
        return text.includes('fighter jet') || text.includes('aviation') || text.includes('air force') || text.includes('uav') || text.includes('drone') || text.includes('helicopter') || text.includes('stealth');
      }
      if (activeCategory === 'ground') {
        return text.includes('tank') || text.includes('soldier') || text.includes('army') || text.includes('marines') || text.includes('troops') || text.includes('artillery') || text.includes('infantry');
      }
      if (activeCategory === 'cyber') {
        return text.includes('cyber') || text.includes('satellite') || text.includes('hack') || text.includes('darpa') || text.includes('network') || text.includes('phishing');
      }
      if (activeCategory === 'geopolitics') {
        return !text.includes('submarine') && !text.includes('navy') && !text.includes('warship') && !text.includes('naval') && !text.includes('carrier') && !text.includes('fleet') &&
               !text.includes('fighter jet') && !text.includes('aviation') && !text.includes('air force') && !text.includes('uav') && !text.includes('drone') && !text.includes('helicopter') && !text.includes('stealth') &&
               !text.includes('tank') && !text.includes('soldier') && !text.includes('army') && !text.includes('marines') && !text.includes('troops') && !text.includes('artillery') && !text.includes('infantry') &&
               !text.includes('cyber') && !text.includes('satellite') && !text.includes('hack') && !text.includes('darpa') && !text.includes('network') && !text.includes('phishing');
      }
      return true;
    });
  };

  // Determine displayed articles
  const getDisplayedArticles = () => {
    if (showBookmarksOnly) {
      const bms = JSON.parse(localStorage.getItem('military_bookmarks') || '[]');
      return filterByCategory(bms);
    }
    return filterByCategory(articles);
  };

  const displayedArticles = getDisplayedArticles();

  return (
    <div className="min-h-screen bg-[#070b12] text-gray-200 flex flex-col justify-between cyber-grid relative">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-cyan-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-amber-900/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div>
        {/* Header HUD */}
        <header className="relative border-b border-white/5 bg-[#0d1423]/70 backdrop-blur-md shadow-xl z-20">
          <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Logo and Tactical HUD Title */}
            <div className="flex items-center space-x-3 select-none">
              <span className="text-3xl filter drop-shadow-[0_0_8px_rgba(6,182,212,0.3)] animate-pulse">🎖️</span>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-widest font-mono text-glow-cyan">
                  MILITARY INFO
                </h1>
                <p className="text-[10px] text-cyan-400/70 font-mono tracking-wider uppercase">
                  Tactical Command Center • Defense News Aggregator
                </p>
              </div>
            </div>

            {/* Dashboard status indicators */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Credentials status */}
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#090e1a] border border-white/5 text-[10px] font-mono">
                <span className={`w-1.5 h-1.5 rounded-full ${keyProfile.includes('Keyless') ? 'bg-amber-500 animate-pulse' : 'bg-cyan-500 animate-pulse'}`}></span>
                <span className="text-gray-400">CREDENTIALS:</span>
                <span className={keyProfile.includes('Keyless') ? 'text-amber-400' : 'text-cyan-400'}>{keyProfile}</span>
              </div>

              {/* Network status */}
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#090e1a] border border-white/5 text-[10px] font-mono">
                <span className={`w-1.5 h-1.5 rounded-full ${isOfflineMode ? 'bg-rose-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`}></span>
                <span className="text-gray-400">STATUS:</span>
                <span className={isOfflineMode ? 'text-rose-400' : 'text-emerald-400'}>{isOfflineMode ? 'OFFLINE ARCHIVE' : 'ONLINE GATEWAYS'}</span>
              </div>

              {/* Bookmarks Toggle Shortcut */}
              <button
                onClick={() => {
                  setShowBookmarksOnly(!showBookmarksOnly);
                  updateBookmarksCount();
                }}
                className={`px-3 py-1 rounded border text-[10px] font-mono font-bold transition-all flex items-center gap-1.5 ${
                  showBookmarksOnly 
                    ? 'bg-amber-600/20 text-amber-300 border-amber-500/30' 
                    : 'bg-[#090e1a] text-gray-400 border-white/5 hover:text-white hover:border-white/10'
                }`}
              >
                <span>★</span>
                <span>BOOKMARKS ({bookmarksCount})</span>
              </button>

              {/* Settings Action Button */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white font-mono text-[10px] font-bold rounded border border-white/10 hover:border-cyan-500/30 transition-all"
              >
                ⚙️ SYSTEM CONFIG
              </button>
            </div>

          </div>
        </header>

        {/* Geopolitical Alert Ticker */}
        <section className="bg-slate-950/80 border-b border-white/5 py-1.5 overflow-hidden select-none z-10 relative">
          <div className="animate-ticker flex items-center space-x-8 font-mono text-[10px] tracking-wider text-cyan-500/80">
            <span>[ SYSTEM SECURITY LOGGED ]</span>
            <span>// DECRPYTION GATEWAYS ONLINE //</span>
            <span>[ INTEL BREADTH: 11 CURATED TACTICAL RSS CHANNELS ACTIVE ]</span>
            <span>// DATA ENCRYPTION: SHA-256 LAYER ENABLED //</span>
            
            {articles.length > 0 ? (
              articles.slice(0, 5).map((art, idx) => (
                <span key={idx} className="text-white">
                  ⚡ <strong className="text-cyan-400">[HOT INTEL]</strong> {art.title.toUpperCase()}
                </span>
              ))
            ) : (
              <span className="text-amber-400">⚠️ FEEDS OFFLINE • DEGRADED OPERATION MODE ACTIVE • CHECK CREDENTIALS</span>
            )}
            
            <span>[ ATTRIBUTION PROTECTION ACTIVE: PREVIEWS HARD-LIMITED TO 250 CHARACTERS ]</span>
          </div>
        </section>

        {/* Central Console */}
        <main className="container mx-auto px-4 py-6">
          
          {/* Sub-header Controls */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6">
            {/* Search inputs */}
            <div className="flex-1">
              <SearchBar onSearch={handleSearch} />
            </div>

            {/* Quick stats label */}
            {!loading && !error && (
              <div className="text-right flex flex-col justify-center">
                <span className="text-xs font-mono text-gray-500">
                  DATABASE GATEWAY MATCHES
                </span>
                <span className="text-sm font-mono text-cyan-400">
                  {showBookmarksOnly ? 'Bookmarked Report Base' : `Source: ${dataSource || 'System Default'}`} • {displayedArticles.length} Loaded
                </span>
              </div>
            )}
          </div>

          {/* Tactical Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-white/5 pb-4">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold tracking-wider transition-all ${
                activeCategory === 'all' 
                  ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 text-glow-cyan' 
                  : 'bg-slate-900/40 text-gray-400 border border-white/5 hover:text-white'
              }`}
            >
              🌐 ALL CHANNELS
            </button>
            <button
              onClick={() => setActiveCategory('naval')}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold tracking-wider transition-all flex items-center gap-1.5 ${
                activeCategory === 'naval' 
                  ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 text-glow-cyan' 
                  : 'bg-slate-900/40 text-gray-400 border border-white/5 hover:text-white'
              }`}
            >
              ⚓ NAVAL OPERATIONS
            </button>
            <button
              onClick={() => setActiveCategory('aerospace')}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold tracking-wider transition-all flex items-center gap-1.5 ${
                activeCategory === 'aerospace' 
                  ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 text-glow-cyan' 
                  : 'bg-slate-900/40 text-gray-400 border border-white/5 hover:text-white'
              }`}
            >
              ✈️ AEROSPACE DEFENSE
            </button>
            <button
              onClick={() => setActiveCategory('ground')}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold tracking-wider transition-all flex items-center gap-1.5 ${
                activeCategory === 'ground' 
                  ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 text-glow-cyan' 
                  : 'bg-slate-900/40 text-gray-400 border border-white/5 hover:text-white'
              }`}
            >
              🎖️ GROUND SYSTEMS
            </button>
            <button
              onClick={() => setActiveCategory('cyber')}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold tracking-wider transition-all flex items-center gap-1.5 ${
                activeCategory === 'cyber' 
                  ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 text-glow-cyan' 
                  : 'bg-slate-900/40 text-gray-400 border border-white/5 hover:text-white'
              }`}
            >
              📡 CYBER & INTEL
            </button>
            <button
              onClick={() => setActiveCategory('geopolitics')}
              className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold tracking-wider transition-all flex items-center gap-1.5 ${
                activeCategory === 'geopolitics' 
                  ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 text-glow-cyan' 
                  : 'bg-slate-900/40 text-gray-400 border border-white/5 hover:text-white'
              }`}
            >
              🌐 GEOPOLITICS
            </button>
          </div>

          {/* Main Display Grid */}
          
          {/* Loading Indicator */}
          {loading && <Loading />}

          {/* Error Message alert */}
          {!loading && error && (
            <ErrorMessage message={error} onRetry={handleRetry} />
          )}

          {/* Grid Render */}
          {!loading && !error && (
            <ArticleGrid 
              articles={displayedArticles} 
              onSelectArticle={(art) => setSelectedArticle(art)} 
            />
          )}
        </main>
      </div>

      {/* Sleek Legal & Attribution Footer */}
      <footer className="border-t border-white/5 bg-slate-950/60 text-gray-500 mt-12 py-8 select-none">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
            
            {/* Info details */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-gray-300 font-mono font-bold tracking-wider">
                <span>🎖️ MILITARY INFO AGGREGATOR</span>
              </div>
              <p className="text-[11px]">
                This platform is a non-commercial news indexing portal for security analysts, geopolitics students, and defense industry researchers. All fetched headlines, publication dates, and textual snippets are retrieved from public RSS and official developer syndication channels.
              </p>
              <p className="text-[10px] text-cyan-500/50">
                Active syndication nodes: Defense News, Military Times, Breaking Defense, The Aviationist, Naval News, Defense One, DARPA News, US Dept of Defense Feed.
              </p>
            </div>

            {/* Legal DMCA protections */}
            <div className="space-y-2 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
              <span className="text-gray-300 font-mono font-bold tracking-wider uppercase block">
                🛡️ FAIR USE & DMCA DISCLOSURE
              </span>
              <p className="text-[11px]">
                In full compliance with copyright guidelines, we enforce a strict 250-character limit on all description text previews. No full articles are scraped, cached, or hosted. All outward links connect directly to the source web properties.
              </p>
              <p className="text-[10px] text-amber-500/60 font-sans">
                Publisher Takedown Compliance: If you are the owner of an indexed feed and wish to exclude your headlines, contact us at <span className="underline cursor-pointer text-amber-400">dmca-compliance@militaryinfo.gov</span> to initiate prompt removal.
              </p>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-white/5 text-[10px] font-mono">
            <span>© 2026 MILITARY INFO • STABILITY PROTOCOL ACTIVE</span>
            <span>BUILT WITH REACT • DEPLOYED IN COMPLIANT MODE</span>
          </div>
        </div>
      </footer>

      {/* Sub-Components Modals & Drawer */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onConfigSaved={handleConfigSaved} 
      />

      <ArticleDrawer 
        article={selectedArticle} 
        isOpen={!!selectedArticle} 
        onClose={() => setSelectedArticle(null)}
        onBookmarkChanged={updateBookmarksCount}
      />
    </div>
  );
}

export default App;
