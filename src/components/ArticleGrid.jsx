import React from 'react';
import ArticleCard from './ArticleCard';

const ArticleGrid = ({ articles }) => {
  if (!articles || articles.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Tidak ada artikel yang ditemukan.</p>
        <p className="text-gray-400 text-sm mt-2">Coba gunakan kata kunci yang berbeda.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {articles.map((article, index) => (
        <ArticleCard key={index} article={article} />
      ))}
    </div>
  );
};

export default ArticleGrid;
