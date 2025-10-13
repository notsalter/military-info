import { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import ArticleGrid from './components/ArticleGrid';
import Loading from './components/Loading';
import ErrorMessage from './components/ErrorMessage';
import { fetchNews } from './services/newsApi';
import './index.css';

/**
 * Main App Component - Military Info News Aggregator
 * AI ASSISTANCE: Component structure, state management, and useEffect logic
 * were developed with AI assistance to ensure proper data flow and error handling
 */
function App() {
  // State management for articles, loading, errors, and search
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentQuery, setCurrentQuery] = useState('militer');
  const [dataSource, setDataSource] = useState(null);

  /**
   * Fetch news articles from API
   * AI ASSISTANCE: Async function pattern and error handling created with AI help
   */
  const loadNews = async (query) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('📰 Loading news with query:', query);
      const result = await fetchNews(query, 20);
      console.log('📊 Result:', result);
      
      if (result.success) {
        console.log(`✅ Got ${result.articles.length} articles from ${result.source}`);
        setArticles(result.articles);
        setCurrentQuery(query);
        setDataSource(result.source); // Track which API provided the data
        
        // Show info if using cached data
        if (result.cached) {
          console.log('⚠️ Using cached data - APIs may be blocked in production');
        }
      } else {
        console.error('❌ Failed to load news:', result.error);
        setError(result.error);
        setArticles([]);
        setDataSource(null);
      }
    } catch (err) {
      console.error('💥 Exception caught:', err);
      setError('Terjadi kesalahan yang tidak terduga. Silakan coba lagi.');
      setArticles([]);
      setDataSource(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load initial news on component mount
   * AI ASSISTANCE: useEffect dependencies and cleanup patterns suggested by AI
   */
  useEffect(() => {
    // Broader query for diverse military/defense content
    // This returns varied topics: naval ops, air force, army, weapons tech, geopolitics
    loadNews('defense');
  }, []);

  /**
   * Handle search submission
   */
  const handleSearch = (searchTerm) => {
    loadNews(searchTerm);
  };

  /**
   * Handle retry on error
   */
  const handleRetry = () => {
    loadNews(currentQuery);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center space-y-4">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              <span className="text-5xl">🎖️</span>
              <h1 className="text-4xl font-bold">Military Info</h1>
            </div>
            <p className="text-blue-100 text-center">
              Portal Berita Militer, Pertahanan, dan Geopolitik Terkini
            </p>
            
            {/* Search Bar */}
            <div className="w-full flex justify-center pt-2">
              <SearchBar onSearch={handleSearch} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Article Count Display */}
        {!loading && !error && articles.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-800">
                  Berita Militer & Pertahanan Terkini
                </p>
                <p className="text-sm text-gray-500">
                  {articles.length} artikel ditemukan
                  {dataSource && (
                    <span className="ml-2">
                      • <span className="text-blue-600">Sumber: {dataSource}</span>
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && <Loading />}

        {/* Error State */}
        {!loading && error && (
          <ErrorMessage message={error} onRetry={handleRetry} />
        )}

        {/* Articles Grid */}
        {!loading && !error && (
          <ArticleGrid articles={articles} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12 py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-gray-400">
            © 2025 Military Info - Agregator Berita Militer dan Pertahanan
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Dikembangkan dengan bantuan AI (IBM Granite) • Powered by NewsAPI.org
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
