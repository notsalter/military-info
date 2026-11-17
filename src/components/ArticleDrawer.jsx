import ModalDialog from './ModalDialog';
import ArticleImage from './ArticleImage';
import ShareArticle from './ShareArticle';
import { classifyArticle } from '../services/articleUtils';
import { CURATION_DISCLAIMER } from '../services/curationDisclaimer';
import { categoryLabels, PublicationDate } from './ArticleMetadata';

export default function ArticleDrawer({ article, onClose, isBookmarked, onToggleBookmark, bookmarkNotice }) {
  return <ModalDialog isOpen={!!article} title={article?.title || 'Article'} closeLabel="Close article" onClose={onClose} className="article-dialog">
    {article && <div className="dialog-body">
      <div className="article-meta"><span>{article.source.name}</span><PublicationDate value={article.publishedAt} /></div>
      <p className="category-label">{categoryLabels[classifyArticle(article)]}</p>
      <ArticleImage key={article.id} url={article.urlToImage} title={article.title} priority />
      <p className="article-preview">{article.description?.slice(0, 250) || 'This publisher did not provide a preview. Read the article at its source.'}</p>
      <p className="preview-note">{CURATION_DISCLAIMER}</p>
      {bookmarkNotice && <p role={bookmarkNotice.success ? 'status' : 'alert'}>{bookmarkNotice.text}</p>}
      <ShareArticle key={`${article.id}:${article.source.id}:${article.url}`} article={article} />
      <div className="dialog-actions"><button type="button" aria-pressed={isBookmarked} onClick={() => onToggleBookmark(article)}>{isBookmarked ? 'Remove saved article' : 'Save article'}</button>
        <a className="primary-button" href={article.url} target="_blank" rel="noopener noreferrer">Read at {article.source.name} <span className="visually-hidden">(opens in new tab)</span></a></div>
    </div>}
  </ModalDialog>;
}
