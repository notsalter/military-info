import { useState } from 'react';

export default function ArticleImage({ url, title, priority = false }) {
  const [failedURL, setFailedURL] = useState(null);
  if (!url || failedURL === url) return null;
  return <img className="article-image" src={url} alt={`Publisher image for: ${title}`} width="640" height="360"
    loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'}
    onError={() => setFailedURL(url)} />;
}
