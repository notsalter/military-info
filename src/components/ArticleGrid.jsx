import ArticleCard from './ArticleCard';

export default function ArticleGrid({ articles, onSelectArticle }) {
  return <div className="article-grid">{articles.map((article, index) =>
    <ArticleCard key={article.id} article={article} onSelect={onSelectArticle} priority={index === 0} />,
  )}</div>;
}
