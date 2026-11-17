import { createFeedHandler } from '../server/feedHandler.js';
import { createPublicFeedFetcher } from '../server/publicFeedFetch.js';

export default createFeedHandler({ fetchFeed: createPublicFeedFetcher() });
