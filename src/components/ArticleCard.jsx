import React from 'react';

const getTacticalCategory = (title, desc) => {
  const text = `${title} ${desc}`.toLowerCase();
  if (text.includes('submarine') || text.includes('navy') || text.includes('warship') || text.includes('naval') || text.includes('carrier') || text.includes('fleet')) {
    return { name: 'Naval Operations', color: 'border-cyan-500/20 text-cyan-400 bg-cyan-950/20', icon: '⚓' };
  }
  if (text.includes('fighter jet') || text.includes('aviation') || text.includes('air force') || text.includes('uav') || text.includes('drone') || text.includes('helicopter') || text.includes('stealth')) {
    return { name: 'Aerospace Defense', color: 'border-sky-500/20 text-sky-400 bg-sky-950/20', icon: '✈️' };
  }
  if (text.includes('tank') || text.includes('soldier') || text.includes('army') || text.includes('marines') || text.includes('troops') || text.includes('artillery') || text.includes('infantry')) {
    return { name: 'Ground Systems', color: 'border-amber-500/20 text-amber-400 bg-amber-950/20', icon: '🎖️' };
  }
  if (text.includes('cyber') || text.includes('satellite') || text.includes('hack') || text.includes('darpa') || text.includes('network') || text.includes('phishing')) {
    return { name: 'Cyber & Intel', color: 'border-purple-500/20 text-purple-400 bg-purple-950/20', icon: '📡' };
  }
  return { name: 'Geopolitics', color: 'border-emerald-500/20 text-emerald-400 bg-emerald-950/20', icon: '🌐' };
};

const ArticleCard = ({ article, onSelect }) => {
  const { title, description, urlToImage, source, publishedAt } = article;
  const category = getTacticalCategory(title, description || '');

  // Format date to be clean
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    try {
      return new Date(dateString).toLocaleDateString('en-US', options);
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div 
      onClick={() => onSelect(article)}
      className="group flex flex-col justify-between overflow-hidden rounded-xl border border-white/5 bg-slate-900/40 glass-panel hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
    >
      {/* Image / Fallback block */}
      <div className="relative h-44 bg-slate-950 overflow-hidden border-b border-white/5">
        {urlToImage ? (
          <img 
            src={urlToImage} 
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              // Display the fallback div
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}

        {/* Dynamic Fallback SVG Visuals */}
        <div 
          style={{ display: urlToImage ? 'none' : 'flex' }}
          className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#0d1423] to-slate-950 relative"
        >
          <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none"></div>
          {/* Radar circle animations */}
          <div className="absolute w-28 h-28 border border-cyan-500/5 rounded-full flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 border border-dashed border-cyan-500/10 rounded-full animate-spin [animation-duration:25s]"></div>
          </div>
          <span className="text-4xl mb-1.5 z-10 filter drop-shadow">{category.icon}</span>
          <span className="text-[9px] font-mono text-cyan-500/40 uppercase tracking-widest z-10">[ SECURE RSS FEED ]</span>
        </div>

        {/* Source Badge overlay */}
        <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded text-[10px] font-mono bg-slate-950/80 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
          {source.name}
        </span>
      </div>
      
      {/* Card Details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          {/* Category tag */}
          <div className="flex items-center space-x-1.5">
            <span className={`px-2 py-0.5 text-[10px] border rounded-full font-medium ${category.color}`}>
              {category.icon} {category.name}
            </span>
          </div>

          <h3 className="text-sm sm:text-base font-bold text-white line-clamp-2 group-hover:text-cyan-400 transition-colors tracking-wide leading-snug">
            {title}
          </h3>
          
          {description && (
            <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        
        {/* Footer info */}
        <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 mt-4 pt-3 border-t border-white/5">
          <span>INTEL INDEXED</span>
          <span>{formatDate(publishedAt)}</span>
        </div>
      </div>
    </div>
  );
};

export default ArticleCard;
