import React from 'react';
import ArticleCard from './ArticleCard';

const ArticleGrid = ({ articles, onSelectArticle }) => {
  if (!articles || articles.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-white/10 rounded-xl bg-slate-900/10 max-w-2xl mx-auto my-8">
        <span className="text-4xl block mb-3 animate-pulse">📡</span>
        <h3 className="text-white font-mono text-sm font-bold uppercase tracking-wider mb-2">No Reports Found</h3>
        <p className="text-gray-500 text-xs px-6">
          The tactical database query returned 0 records. Try applying a broader search term or checking your system credentials.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
      {articles.map((article, index) => (
        <ArticleCard 
          key={index} 
          article={article} 
          onSelect={onSelectArticle} 
        />
      ))}
    </div>
  );
};

export default ArticleGrid;
