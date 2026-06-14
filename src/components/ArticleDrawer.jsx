import React, { useState, useEffect } from 'react';

// Simple helper to guess the tactical category based on text content
const getTacticalCategory = (title, desc) => {
  const text = `${title} ${desc}`.toLowerCase();
  if (text.includes('submarine') || text.includes('navy') || text.includes('warship') || text.includes('naval') || text.includes('carrier') || text.includes('fleet')) {
    return { name: 'Naval Operations', color: 'border-cyan-500/30 text-cyan-400 bg-cyan-950/20', icon: '⚓' };
  }
  if (text.includes('fighter jet') || text.includes('aviation') || text.includes('air force') || text.includes('uav') || text.includes('drone') || text.includes('helicopter') || text.includes('stealth')) {
    return { name: 'Aerospace Defense', color: 'border-sky-500/30 text-sky-400 bg-sky-950/20', icon: '✈️' };
  }
  if (text.includes('tank') || text.includes('soldier') || text.includes('army') || text.includes('marines') || text.includes('troops') || text.includes('artillery') || text.includes('infantry')) {
    return { name: 'Ground Systems', color: 'border-amber-500/30 text-amber-400 bg-amber-950/20', icon: '🎖️' };
  }
  if (text.includes('cyber') || text.includes('satellite') || text.includes('hack') || text.includes('darpa') || text.includes('network') || text.includes('phishing')) {
    return { name: 'Cyber & Intelligence', color: 'border-purple-500/30 text-purple-400 bg-purple-950/20', icon: '📡' };
  }
  return { name: 'Geopolitics & Policy', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20', icon: '🌐' };
};

const ArticleDrawer = ({ article, isOpen, onClose, onBookmarkChanged }) => {
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    if (article && isOpen) {
      const bookmarks = JSON.parse(localStorage.getItem('military_bookmarks') || '[]');
      const exists = bookmarks.some(b => b.url === article.url);
      setIsBookmarked(exists);
    }
  }, [article, isOpen]);

  if (!isOpen || !article) return null;

  const category = getTacticalCategory(article.title, article.description);
  
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const handleBookmarkToggle = () => {
    const bookmarks = JSON.parse(localStorage.getItem('military_bookmarks') || '[]');
    let updated;
    if (isBookmarked) {
      updated = bookmarks.filter(b => b.url !== article.url);
      setIsBookmarked(false);
    } else {
      updated = [...bookmarks, article];
      setIsBookmarked(true);
    }
    localStorage.setItem('military_bookmarks', JSON.stringify(updated));
    if (onBookmarkChanged) onBookmarkChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
      {/* Backdrop Click */}
      <div className="absolute inset-0 -z-10" onClick={onClose}></div>

      {/* Drawer Body */}
      <div className="w-full max-w-xl h-full border-l border-white/10 glass-panel shadow-2xl flex flex-col justify-between overflow-y-auto animate-slide-in">
        
        {/* Top Header */}
        <div>
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-slate-900/50">
            <span className="text-xs font-mono font-semibold text-cyan-400 tracking-widest uppercase">
              // SECURE INTEL REPORT
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-lg p-1"
            >
              ✕ Close
            </button>
          </div>

          {/* Banner Image / Fallback SVG */}
          <div className="relative h-64 bg-slate-950 overflow-hidden">
            {article.urlToImage ? (
              <img 
                src={article.urlToImage} 
                alt={article.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = 'none';
                  // Show the SVG background by toggling class
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}

            {/* Custom SVG tactical pattern placeholder (displays if image missing or fails) */}
            <div 
              style={{ display: article.urlToImage ? 'none' : 'flex' }}
              className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#0d1423] to-slate-950 relative"
            >
              {/* Tactical reticle grid overlays */}
              <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 border border-cyan-500/10 rounded-full flex items-center justify-center pointer-events-none">
                <div className="w-24 h-24 border border-dashed border-cyan-500/20 rounded-full animate-spin [animation-duration:20s]"></div>
              </div>
              <span className="text-5xl mb-2 z-10">{category.icon}</span>
              <span className="text-xs font-mono text-cyan-500/60 uppercase tracking-widest z-10">
                [ TACTICAL FEED ONLINE ]
              </span>
            </div>
            
            {/* Category Tag Overlay */}
            <span className={`absolute bottom-4 left-4 px-3 py-1 text-xs border rounded font-semibold flex items-center gap-1.5 ${category.color}`}>
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </span>
          </div>

          {/* Article Main Text Area */}
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-mono text-gray-500 block">
                PUBLISHED: {formatDate(article.publishedAt)}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                {article.title}
              </h1>
              <div className="text-sm font-semibold text-cyan-400 font-mono">
                SOURCE: <span className="hover:underline">{article.source.name}</span>
              </div>
            </div>

            <hr className="border-white/10" />

            <div className="space-y-4">
              <h3 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider">
                Intelligence Summary
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line bg-white/5 p-4 rounded-lg border border-white/5">
                {article.description || "No preview summary is available for this dispatch."}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Footer */}
        <div className="p-6 bg-slate-900/60 border-t border-white/10 space-y-4">
          
          {/* Fair Use Protection Clause */}
          <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded text-[11px] text-amber-200 leading-normal font-sans">
            <strong className="text-amber-500 block mb-1">⚖️ COPYRIGHT ATTRIBUTION & FAIR USE NOTICE:</strong>
            As a non-commercial educational intelligence aggregator, we present only a text snippet (under 250 characters) to identify the report topic. Full-text content is not stored in our databases. Click below to view the official publication.
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Bookmark button */}
            <button
              onClick={handleBookmarkToggle}
              className={`flex-1 px-4 py-3 font-mono text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-2 ${
                isBookmarked 
                  ? 'bg-amber-600/20 text-amber-300 border-amber-500/30 hover:bg-amber-600/30' 
                  : 'bg-slate-800 text-gray-300 border-white/10 hover:bg-slate-700'
              }`}
            >
              <span>{isBookmarked ? '★ Bookmarked' : '☆ Bookmark Report'}</span>
            </button>

            {/* Outbound Link to Source */}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-500 hover:shadow-cyan-500/20 text-white font-mono text-xs font-bold rounded-lg border border-cyan-400/30 text-center transition-all flex items-center justify-center gap-1.5 glow-border-cyan uppercase"
            >
              <span>Read Full Article</span>
              <span>↗</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ArticleDrawer;
