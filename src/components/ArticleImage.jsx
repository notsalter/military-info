import { useState } from 'react';
import { safePublisherImage } from '../services/articleLinks';

export default function ArticleImage({ url, title, priority = false }) {
  const [failedURL, setFailedURL] = useState(null);
  const imageURL = safePublisherImage(url);
  if (!imageURL || failedURL === imageURL) return null;
  return <img className="article-image" src={imageURL} alt={`Publisher image for: ${title}`} width="640" height="360"
    loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} referrerPolicy="no-referrer"
    onError={() => setFailedURL(imageURL)} />;
}
