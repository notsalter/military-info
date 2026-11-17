import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ArticleGrid from './components/ArticleGrid';
import SearchBar from './components/SearchBar';
import ErrorMessage from './components/ErrorMessage';
import Loading from './components/Loading';
import ArticleDrawer from './components/ArticleDrawer';
import SettingsModal from './components/SettingsModal';
import SourcesModal from './components/SourcesModal';
import { categoryLabels } from './components/ArticleMetadata';
import { selectArticles } from './services/articleUtils';
import { decodeArticlePath, getArticlePath } from './services/articleLinks';
import { fetchNews } from './services/newsApi';
import { readBookmarks, removeBookmark, saveBookmarks } from './services/storage';
import { CURATION_DISCLAIMER } from './services/curationDisclaimer';
import './index.css';

export default function App() {
  const [articles, setArticles] = useState([]);
  const [bookmarks, setBookmarks] = useState(() => readBookmarks());
  const [articleRoute, setArticleRoute] = useState(() => decodeArticlePath(window.location.pathname)?.path || null);
  const [selectedArticle, setSelectedArticle] = useState(() => (articleRoute && bookmarks.find((article) => getArticlePath(article) === articleRoute)) || null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [bookmarkNotice, setBookmarkNotice] = useState(null);
  const [savedView, setSavedView] = useState(false);
  const [query, setQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState('newest');
  const [visibleCount, setVisibleCount] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedResult, setFeedResult] = useState(null);
  const [articleResult, setArticleResult] = useState(null);
  const [requestHealth, setRequestHealth] = useState([]);
  const [requestStatus, setRequestStatus] = useState('pending');
  const [requestGeneration, setRequestGeneration] = useState(0);
  const networkQueryRef = useRef('');
  const requestRef = useRef({ generation: 0, controller: null });
  const readingAreaRef = useRef(null);
  const paginationFocusRef = useRef(null);
  const knownArticlesRef = useRef(new Map());
  const articleRouteRef = useRef(articleRoute);
  const listingSnapshotsRef = useRef(new Map());
  const activeListingRef = useRef(null);
  const pendingListingRef = useRef(null);
  useEffect(() => {
    const restoreArticle = () => {
      setBookmarkNotice(null);
      const path = decodeArticlePath(window.location.pathname)?.path || null;
      const listingURL = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const previousListing = activeListingRef.current;
      pendingListingRef.current = !path && previousListing?.url === listingURL ? previousListing : null;
      activeListingRef.current = path ? listingSnapshotsRef.current.get(window.history.state?.militaryInfoArticle?.listingKey) || null : null;
      articleRouteRef.current = path;
      setArticleRoute(path);
      setSelectedArticle((path && (knownArticlesRef.current.get(path)
        || [...articles, ...bookmarks].find((article) => getArticlePath(article) === path))) || null);
    };
    window.addEventListener('popstate', restoreArticle);
    return () => window.removeEventListener('popstate', restoreArticle);
  }, [articles, bookmarks]);
  const openArticle = (article) => {
    const path = getArticlePath(article);
    if (path) knownArticlesRef.current.set(path, article);
    pendingListingRef.current = null;
    if (path && window.location.pathname !== path) {
      const listingURL = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const listingKey = window.crypto.randomUUID();
      const listing = { url: listingURL, x: window.scrollX, y: window.scrollY, trigger: document.activeElement };
      listingSnapshotsRef.current.set(listingKey, listing);
      activeListingRef.current = listing;
      window.history.pushState({ ...window.history.state, militaryInfoArticle: { path, listingURL, listingKey } }, '', path);
    }
    articleRouteRef.current = path;
    setArticleRoute(path);
    setBookmarkNotice(null);
    setSelectedArticle(article);
  };
  const activeArticle = selectedArticle || (articleRoute && [...articles, ...bookmarks].find((article) => getArticlePath(article) === articleRoute)) || null;
  useEffect(() => {
    const path = getArticlePath(activeArticle);
    if (path) knownArticlesRef.current.set(path, activeArticle);
  }, [activeArticle]);
  useEffect(() => {
    if (activeArticle || articleRoute || !pendingListingRef.current) return;
    const listing = pendingListingRef.current;
    // History fragment targeting runs after popstate; restore only after the drawer cleanup.
    const frame = window.requestAnimationFrame(() => {
      if (pendingListingRef.current !== listing || articleRouteRef.current
        || `${window.location.pathname}${window.location.search}${window.location.hash}` !== listing.url) return;
      pendingListingRef.current = null;
      if (readingAreaRef.current?.closest('[inert]')) return;
      const trigger = listing.trigger?.isConnected ? listing.trigger : readingAreaRef.current;
      trigger?.focus({ preventScroll: true });
      window.scrollTo({ left: listing.x, top: listing.y, behavior: 'instant' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeArticle, articleRoute]);
  const closeArticle = () => {
    if (getArticlePath(activeArticle) === window.location.pathname) {
      if (window.history.state?.militaryInfoArticle?.path === window.location.pathname) {
        window.history.back();
        return;
      }
      window.history.replaceState(window.history.state, '', '/');
    }
    articleRouteRef.current = null;
    setArticleRoute(null);
    setSelectedArticle(null);
  };
  useLayoutEffect(() => {
    if (paginationFocusRef.current === null) return;
    readingAreaRef.current?.querySelectorAll('.headline-button')[paginationFocusRef.current]?.focus();
    paginationFocusRef.current = null;
  }, [visibleCount]);
  const loadNews = useCallback(async (nextQuery, force = false, initial = false) => {
    networkQueryRef.current = nextQuery;
    requestRef.current.controller?.abort();
    const generation = ++requestRef.current.generation;
    const controller = new AbortController();
    requestRef.current.controller = controller;
    setFeedResult(null);
    setRequestHealth([]);
    setRequestStatus('pending');
    setRequestGeneration(generation);
    if (!initial) { setLoading(true); setError(null); }
    const accept = (result) => {
      if (generation !== requestRef.current.generation || controller.signal.aborted) return;
      setFeedResult(result);
      setRequestHealth(result.feedHealth || []);
      if (result.success) {
        const path = articleRouteRef.current;
        const matchedArticle = path && (result.articles || []).find((article) => getArticlePath(article) === path);
        if (matchedArticle) setSelectedArticle((current) => current || matchedArticle);
        setArticles(result.articles || []);
        setArticleResult({ generation, stale: result.stale });
      }
    };
    try {
      const response = await fetchNews(nextQuery, 200, { signal: controller.signal, onProgress: accept, force });
      if (generation !== requestRef.current.generation || controller.signal.aborted) return;
      accept(response);
      setRequestStatus(response.success ? 'complete' : 'failed');
      if (!response.success) setError('News could not be loaded. Try again or read your saved articles.');
    } catch {
      if (generation !== requestRef.current.generation || controller.signal.aborted) return;
      setRequestStatus('failed');
      setError('News could not be loaded. Try again or read your saved articles.');
    } finally {
      if (generation === requestRef.current.generation && !controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const request = requestRef.current;
    // Initial state already represents loading; this only starts the external request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNews('', false, true);
    return () => { request.generation++; request.controller?.abort(); };
  }, [loadNews]);
  const handleSearch = (nextQuery) => { setVisibleCount(12); setQuery(nextQuery); if (!savedView) loadNews(nextQuery); };
  const toggleBookmark = (article) => {
    if (bookmarks.storageError) {
      setBookmarkNotice({ success: false, text: 'Saved articles must be recovered before making changes. Close this article and choose Retry saved articles to recover your collection.' });
      return;
    }
    const exists = bookmarks.some((bookmark) => bookmark.id === article.id);
    const updated = exists ? bookmarks.filter((bookmark) => bookmark.id !== article.id) : [...bookmarks, article];
    try {
      const saved = exists ? removeBookmark(article.id) : saveBookmarks(updated);
      if (!saved?.success) {
        setBookmarkNotice({ success: false, text: `Could not save this change. ${saved?.error || 'Browser storage may be blocked or full.'}` });
        return;
      }
      setBookmarks(exists ? saved.articles : selectArticles(updated));
      setBookmarkNotice({ success: true, text: exists ? 'Article removed from saved articles.' : 'Article saved in this browser.' });
    } catch {
      setBookmarkNotice({ success: false, text: 'Could not save this change. Browser storage may be blocked or full.' });
    }
  };
  const resetFilters = () => { setCategory('all'); setSource('all'); setSort('newest'); setSearchDraft(''); handleSearch(''); };
  const collection = savedView ? bookmarks : articles;
  const publishers = [...new Map(collection.map((article) => [article.source.id, article.source])).values()].sort((left, right) => left.name.localeCompare(right.name));
  const displayedArticles = selectArticles(collection, { query, category, source, sort });
  return <div className="app-shell">
    <a className="skip-link" href="#news">Skip to news</a>
    <header className="masthead"><div><h1>Military Info</h1><p>Defense news, at the source.</p></div>
      <nav aria-label="Reading views"><button aria-pressed={!savedView} onClick={() => { setSavedView(false); setVisibleCount(12); if (networkQueryRef.current !== query) loadNews(query); }}>Latest news</button>
        <button aria-pressed={savedView} onClick={() => { setSavedView(true); setVisibleCount(12); }}>Saved articles ({bookmarks.storageError ? 'unavailable' : bookmarks.length})</button>
        <button onClick={() => setSourcesOpen(true)}>Sources</button><button onClick={() => setSettingsOpen(true)}>Settings</button></nav></header>
    <main id="news" tabIndex={-1} ref={readingAreaRef}><div className="reader-controls"><SearchBar onSearch={handleSearch} value={searchDraft} onChange={setSearchDraft} />
      <div className="filter-controls"><div><label htmlFor="topic-filter">Topic</label><select id="topic-filter" value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(12); }}>{Object.entries(categoryLabels).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
        <div><label htmlFor="publisher-filter">Publisher</label><select id="publisher-filter" value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All publishers</option>{source !== 'all' && !publishers.some((publisher) => publisher.id === source) && <option value={source}>{source} (no articles available in this collection)</option>}{publishers.map((publisher) => <option key={publisher.id} value={publisher.id}>{publisher.name}</option>)}</select></div>
        <div><label htmlFor="sort-filter">Sort articles</label><select id="sort-filter" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Headline A to Z</option></select></div></div>
      </div><h2>{savedView ? 'Saved articles' : 'Latest news'}</h2>
      {bookmarks.storageError && <div className="error-state"><p role="alert">Saved articles could not be read reliably. {bookmarks.storageError} Allow browser storage for this site, then retry.</p>
        <button onClick={() => {
          const recovered = readBookmarks();
          const path = articleRouteRef.current;
          const matchedArticle = path && recovered.find((article) => getArticlePath(article) === path);
          if (matchedArticle) setSelectedArticle((current) => current || matchedArticle);
          setBookmarks(recovered);
        }}>Retry saved articles</button></div>}
      {displayedArticles.length > 0 && <p className="result-count" role="status">Showing {Math.min(visibleCount, displayedArticles.length)} of {displayedArticles.length} articles.</p>}
      {!savedView && articles.length > 0 && articleResult && (articleResult.generation !== requestGeneration || requestStatus === 'failed') && <p role="status" className="feed-note">Showing articles from a previous result. {requestStatus === 'failed' ? 'The current request failed.' : 'The current request has not replaced them yet.'}</p>}
      {!savedView && articleResult?.stale && <p role="status" className="feed-note">Cached articles may be out of date. These articles came from a cached result.</p>}
      {!savedView && feedResult?.storageWarnings?.length > 0 && <div className="feed-note"><div role="status"><p>News storage needs attention.{articles.length > 0 && ' Fetched articles remain readable.'}</p>
        <ul>{[...new Set(feedResult.storageWarnings)].map((warning) => <li key={warning}>{warning}</li>)}</ul><p>Allow browser storage for this site. Free space if storage is full, then retry.</p></div>
        <button onClick={() => loadNews(query, true)}>Retry news storage</button></div>}
      {!savedView && error && <ErrorMessage message={error} onRetry={() => loadNews(query, true)} />}
      {!savedView && loading && <Loading />}
      {displayedArticles.length ?
        <ArticleGrid articles={displayedArticles.slice(0, visibleCount)} onSelectArticle={openArticle} /> : (!loading || savedView) && (savedView || !error) && !(savedView && bookmarks.storageError) &&
        <div className="empty-state"><p role="status">{savedView && !bookmarks.length ? 'No saved articles yet. Open a headline and save it to read later.' : 'No articles match these filters.'}</p>
          <button onClick={resetFilters}>Reset filters</button></div>}
      {visibleCount < displayedArticles.length && <div className="load-more"><button onClick={() => {
        if (visibleCount + 12 >= displayedArticles.length) paginationFocusRef.current = visibleCount;
        setVisibleCount((count) => count + 12);
      }}>Show more articles</button></div>}
    </main>
    <footer><p>{CURATION_DISCLAIMER}</p><p>Saved articles stay in this browser.</p></footer>
    <SourcesModal isOpen={sourcesOpen} onClose={() => setSourcesOpen(false)} feedHealth={requestHealth} requestStatus={requestStatus} cachedHealth={Boolean(feedResult?.cached)} />
    <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onConfigSaved={() => loadNews(query, true)} />
    <ArticleDrawer article={activeArticle} onClose={closeArticle}
      isBookmarked={bookmarks.some((bookmark) => bookmark.id === activeArticle?.id)}
      onToggleBookmark={toggleBookmark} bookmarkNotice={bookmarkNotice} />
  </div>;
}
