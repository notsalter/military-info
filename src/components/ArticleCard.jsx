import { classifyArticle } from '../services/articleUtils';
import { categoryLabels, PublicationDate } from './ArticleMetadata';
import ArticleImage from './ArticleImage';

export default function ArticleCard({ article, onSelect, priority = false }) {
  return <article className="article-card">
    <ArticleImage url={article.urlToImage} title={article.title} priority={priority} />
    <div className="article-copy">
      <div className="article-meta"><a href={article.url} target="_blank" rel="noopener noreferrer">{article.source.name}</a>
        <PublicationDate value={article.publishedAt} /></div>
      <h3><button type="button" className="headline-button" onClick={() => onSelect(article)}>{article.title}</button></h3>
      {article.description && <p className="article-description">{article.description.slice(0, 250)}</p>}
      <p className="category-label">{categoryLabels[classifyArticle(article)]}</p>
    </div>
  </article>;
}
