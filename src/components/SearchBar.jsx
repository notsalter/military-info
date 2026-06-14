import React, { useState } from 'react';

const SearchBar = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm.trim());
    }
  };

  const handleClear = () => {
    setSearchTerm('');
    onSearch('defense'); // Reset to default broad tactical search term
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl animate-fade-in">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Query tactical database... (e.g., submarine, drone, NATO, airspace)"
            className="w-full px-4 py-3 pr-10 border border-white/10 bg-slate-950/60 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/80 transition-all font-mono text-sm tracking-wide"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 hover:shadow-cyan-500/20 text-white font-mono text-xs font-bold rounded-lg border border-cyan-400/30 transition-all flex items-center gap-2 glow-border-cyan uppercase"
        >
          <span>🔍</span>
          <span>Query</span>
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
