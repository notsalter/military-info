import React, { useState, useEffect } from 'react';
import { getCustomKeys, saveCustomKeys, clearCustomKeys, clearCache } from '../services/newsApi';

const SettingsModal = ({ isOpen, onClose, onConfigSaved }) => {
  const [newsKey, setNewsKey] = useState('');
  const [theNewsKey, setTheNewsKey] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    if (isOpen) {
      const { newsApiKey, theNewsApiKey } = getCustomKeys();
      setNewsKey(newsApiKey);
      setTheNewsKey(theNewsApiKey);
      setSaveStatus('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    saveCustomKeys(newsKey, theNewsKey);
    setSaveStatus('success');
    clearCache(); // Force cache reset on new credentials
    
    setTimeout(() => {
      onConfigSaved();
      onClose();
    }, 800);
  };

  const handleClear = () => {
    clearCustomKeys();
    setNewsKey('');
    setTheNewsKey('');
    setSaveStatus('cleared');
    clearCache();
    
    setTimeout(() => {
      onConfigSaved();
      onClose();
    }, 800);
  };

  const handleResetCache = () => {
    clearCache();
    setSaveStatus('cache_cleared');
    setTimeout(() => {
      setSaveStatus('');
      onConfigSaved();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-cyan-500/30 glass-panel shadow-2xl animate-fade-in">
        {/* Glow corner decorations */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 blur-xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-500/10 blur-xl pointer-events-none"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⚙️</span>
            <h2 className="text-lg font-bold text-white tracking-wide font-mono uppercase text-glow-cyan">
              System Settings & Key Manager
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Information Shielding Note */}
          <div className="p-4 rounded-lg bg-cyan-950/40 border border-cyan-500/20 text-xs text-cyan-200 leading-relaxed">
            <strong className="text-cyan-400 font-mono block mb-1">🛡️ CREDENTIAL SHIELDING ACTIVE</strong>
            By storing API keys locally in your browser, they are never compiled into the public source bundle or exposed on host servers (like Vercel/Netlify). If keys are empty, the application runs automatically in <strong>Keyless Mode</strong> querying public RSS feeds.
          </div>

          <div className="space-y-4">
            {/* NewsAPI Key Field */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 font-mono uppercase mb-2">
                NewsAPI.org Key (Free tier)
              </label>
              <input
                type="password"
                value={newsKey}
                onChange={(e) => setNewsKey(e.target.value)}
                placeholder="Enter NewsAPI Key..."
                className="w-full px-4 py-2 bg-slate-900/80 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-sm"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                Acquire from <a href="https://newsapi.org" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">newsapi.org</a>.
              </span>
            </div>

            {/* TheNewsAPI Key Field */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 font-mono uppercase mb-2">
                TheNewsAPI.com Key (Alternative)
              </label>
              <input
                type="password"
                value={theNewsKey}
                onChange={(e) => setTheNewsKey(e.target.value)}
                placeholder="Enter TheNewsAPI Key..."
                className="w-full px-4 py-2 bg-slate-900/80 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-sm"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                Acquire from <a href="https://thenewsapi.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">thenewsapi.com</a>.
              </span>
            </div>
          </div>

          {/* Action Status Messages */}
          {saveStatus === 'success' && (
            <div className="text-center text-sm font-mono text-emerald-400 animate-pulse">
              [SYSTEM] KEYS UPDATED SUCCESSFULLY. REBOOTING FEEDS...
            </div>
          )}
          {saveStatus === 'cleared' && (
            <div className="text-center text-sm font-mono text-amber-400 animate-pulse">
              [SYSTEM] CUSTOM KEYS ERASED. DEGRADED TO PUBLIC KEYLESS RSS FEEDS.
            </div>
          )}
          {saveStatus === 'cache_cleared' && (
            <div className="text-center text-sm font-mono text-cyan-400 animate-pulse">
              [SYSTEM] DATA CACHE FLUSHED. REFETCHING LIVE DATA...
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-3 pt-4 border-t border-white/10">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleResetCache}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 font-mono text-xs font-semibold rounded-lg border border-white/10 transition-colors uppercase"
              >
                Clear Cache
              </button>
              
              {(newsKey || theNewsKey) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-4 py-2 bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 font-mono text-xs font-semibold rounded-lg border border-rose-500/20 transition-colors uppercase"
                >
                  Clear Keys
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 hover:shadow-cyan-500/20 text-white font-mono text-xs font-bold rounded-lg border border-cyan-400/30 transition-all uppercase glow-border-cyan"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;
