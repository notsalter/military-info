import React from 'react';

const ArticleCard = ({ article }) => {
  const { title, description, urlToImage, source, publishedAt, url } = article;

  // Format date to be more readable
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
  };

  // Handle click to open article in new tab
  const handleClick = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      onClick={handleClick}
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer group"
    >
      <div className="relative h-48 bg-gray-200 overflow-hidden">
        {urlToImage ? (
          <img 
            src={urlToImage} 
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://via.placeholder.com/400x300?text=Military+Info';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
            <span className="text-white text-4xl">🎖️</span>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {title}
        </h3>
        
        {description && (
          <p className="text-gray-600 text-sm mb-3 line-clamp-3">
            {description}
          </p>
        )}
        
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span className="font-semibold text-blue-600">{source.name}</span>
          <span>{formatDate(publishedAt)}</span>
        </div>
      </div>
    </div>
  );
};

export default ArticleCard;
