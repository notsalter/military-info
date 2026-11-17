import feedHandler from './feeds.js';
import { createArticlePreviewHandler } from '../server/articlePreview.js';

export default createArticlePreviewHandler({ feedHandler });
