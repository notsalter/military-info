import React from 'react';

const Loading = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
      {/* Tactical radar/reticle loading animation */}
      <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
        <div className="absolute inset-0 border border-cyan-500/10 rounded-full"></div>
        <div className="absolute inset-2 border border-dashed border-cyan-500/20 rounded-full animate-spin [animation-duration:8s]"></div>
        <div className="absolute inset-4 border border-cyan-500/30 rounded-full"></div>
        <div className="absolute inset-0 border-t-2 border-r-2 border-cyan-400 rounded-full animate-spin [animation-duration:1.5s]"></div>
        <span className="text-cyan-400 text-xs font-mono font-bold tracking-tighter">SYS</span>
      </div>
      <div className="space-y-1 text-center font-mono">
        <p className="text-sm font-bold text-white tracking-widest uppercase text-glow-cyan">
          Querying Database Gateways
        </p>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
          Decrypting RSS feed streams & caching layers...
        </p>
      </div>
    </div>
  );
};

export default Loading;
