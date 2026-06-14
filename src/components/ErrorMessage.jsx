import React from 'react';

const ErrorMessage = ({ message, onRetry }) => {
  return (
    <div className="max-w-xl mx-auto my-8 overflow-hidden rounded-xl border border-rose-500/30 bg-rose-950/10 backdrop-blur-md p-6 text-center shadow-lg shadow-rose-950/5 animate-fade-in">
      <div className="text-3xl mb-3 animate-bounce">⚠️</div>
      <h3 className="text-rose-400 font-mono text-sm font-bold uppercase tracking-wider mb-2">
        Critical Gateway Connection Error
      </h3>
      <p className="text-gray-400 text-xs leading-relaxed mb-6">
        {message || 'The system was unable to establish a secure link to the active news distribution channels.'}
      </p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2.5 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 font-mono text-xs font-bold rounded-lg border border-rose-500/30 transition-all uppercase tracking-wider hover:shadow-lg hover:shadow-rose-500/10"
        >
          Retry Connection
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
