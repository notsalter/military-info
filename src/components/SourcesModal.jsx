import ModalDialog from './ModalDialog';
import { FEEDS } from '../services/feeds';

const statusLabels = { ok: 'Response received', empty: 'No articles returned', error: 'Request failed', timeout: 'Request timed out', 'rate-limited': 'Rate limited', cached: 'Cached response' };
export default function SourcesModal({ isOpen, onClose, feedHealth = [], requestStatus = 'complete', cachedHealth = false }) {
  const health = new Map(feedHealth.map((feed) => [feed.id, feed.status]));
  return <ModalDialog isOpen={isOpen} onClose={onClose} title="Sources">
    <div className="dialog-body"><p>Configured public feeds. Live result statuses reflect checks in the current request, not publisher uptime or the age of retained articles.</p>
      {cachedHealth && <p role="status">Cached result statuses may be from a previous request. They do not establish current request health.</p>}
      {requestStatus === 'pending' && <p role="status">Current request is in progress. Publishers without a response are not checked yet.</p>}
      {requestStatus === 'failed' && <p role="status">Current request failed. {cachedHealth ? 'Statuses reported with the cached result are not current checks.' : 'Any statuses below reflect only checks made during that request.'} Retained articles may be from a previous result.</p>}
      <ul className="source-register">{FEEDS.map((feed) => <li key={feed.id}>
        <a href={feed.url} target="_blank" rel="noopener noreferrer" aria-label={`${feed.name} (opens in new tab)`}>{feed.name}</a>
        <span>{feed.region}</span><span>{statusLabels[health.get(feed.id)] ? `${statusLabels[health.get(feed.id)]}${cachedHealth ? ' (reported with cached result)' : ''}` : 'Not checked in this request'}</span>
      </li>)}</ul>
    </div>
  </ModalDialog>;
}
