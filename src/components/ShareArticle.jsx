import { useEffect, useId, useRef, useState } from 'react';
import { getArticleShareURL } from '../services/articleLinks';

export default function ShareArticle({ article }) {
  const [notice, setNotice] = useState(null);
  const [fallback, setFallback] = useState(false);
  const inputId = useId();
  const actionRef = useRef(0);
  useEffect(() => () => { actionRef.current++; }, []);
  const url = getArticleShareURL(article, window.location.origin);
  if (!url) return <p className="preview-note">This source does not support a Military Info share link.</p>;
  const copyLink = async () => {
    const action = ++actionRef.current;
    setNotice(null);
    setFallback(false);
    try {
      if (typeof navigator.clipboard?.writeText !== 'function') throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      if (action !== actionRef.current) return;
      setNotice('Share link copied.');
    } catch {
      if (action !== actionRef.current) return;
      setNotice('Copy is unavailable. Select and copy the link below.');
      setFallback(true);
    }
  };
  const shareArticle = async () => {
    const action = ++actionRef.current;
    setNotice(null);
    setFallback(false);
    try {
      await navigator.share({ title: article.title, url });
    } catch (error) {
      if (action !== actionRef.current || error?.name === 'AbortError') return;
      setNotice('Sharing is unavailable. Select and copy the link below.');
      setFallback(true);
    }
  };
  return <section className="share-article" aria-label="Share article">
    <p className="preview-note">Share links resolve while the article remains in its publisher feed.</p>
    <div className="dialog-actions"><button type="button" onClick={copyLink}>Copy link</button>
      {typeof navigator.share === 'function' && <button type="button" onClick={shareArticle}>Share article</button>}</div>
    {notice && <p role="status">{notice}</p>}
    {fallback && <div className="share-link"><label htmlFor={inputId}>Military Info share link</label>
      <input id={inputId} type="text" value={url} readOnly onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} /></div>}
  </section>;
}
