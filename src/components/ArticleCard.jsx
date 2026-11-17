import { classifyArticle } from '../services/articleUtils';
import { getArticlePath } from '../services/articleLinks';
import { categoryLabels, PublicationDate } from './ArticleMetadata';
import ArticleImage from './ArticleImage';

export default function ArticleCard({ article, onSelect, priority = false }) {
  const path = getArticlePath(article);
  return <article className="article-card">
    <ArticleImage url={article.urlToImage} title={article.title} priority={priority} />
    <div className="article-copy">
      <div className="article-meta"><a href={article.url} target="_blank" rel="noopener noreferrer">{article.source.name}</a>
        <PublicationDate value={article.publishedAt} /></div>
      <h3>{path ? <a href={path} className="headline-button" onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onSelect(article);
      }}>{article.title}</a> : <button type="button" className="headline-button" onClick={() => onSelect(article)}>{article.title}</button>}</h3>
      {article.description && <p className="article-description">{article.description.slice(0, 250)}</p>}
      <p className="category-label">{categoryLabels[classifyArticle(article)]}</p>
    </div>
  </article>;
}
