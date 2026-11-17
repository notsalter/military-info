import { useState } from 'react';
import ModalDialog from './ModalDialog';
import { getCustomKeys, saveCustomKeys, clearCustomKeys, clearCache } from '../services/newsApi';

function KeySettings({ onConfigSaved }) {
  const [keys] = useState(() => getCustomKeys() || {});
  const [newsKey, setNewsKey] = useState(keys.newsApiKey || '');
  const [theNewsKey, setTheNewsKey] = useState(keys.theNewsApiKey || '');
  const [notice, setNotice] = useState(null);
  const handleSave = (event) => {
    event.preventDefault();
    try {
      const result = saveCustomKeys(newsKey.trim(), theNewsKey.trim());
      if (!(result === true || result?.success === true)) throw new Error('Storage unavailable');
      setNotice({ success: true, text: 'Keys saved in this browser.' });
      onConfigSaved?.();
    } catch {
      setNotice({ success: false, text: 'Could not save keys. Browser storage may be blocked or full.' });
    }
  };
  const handleClear = (kind) => {
    try {
      const result = kind === 'keys' ? clearCustomKeys() : clearCache();
      if (!(result === true || result?.success === true)) throw new Error('Storage unavailable');
      if (kind === 'keys') { setNewsKey(''); setTheNewsKey(''); }
      setNotice({ success: true, text: kind === 'keys' ? 'Keys removed. Public feeds will be used.' : 'News cache cleared. Saved articles are unchanged.' });
      onConfigSaved?.();
    } catch {
      setNotice({ success: false, text: kind === 'keys' ? 'Could not remove keys. Browser storage may be blocked.' : 'Could not clear the news cache. Browser storage may be blocked.' });
    }
  };
  return <form className="dialog-body settings-form" onSubmit={handleSave}>
    <p>Public feeds do not require API keys. Optional keys are sent to the provider you choose.</p>
    <p id="key-storage-warning" className="storage-warning">Keys are stored in plain text in this browser, not encrypted. Other scripts and anyone with access to this browser may read them. Avoid using keys on a shared device.</p>
    <label htmlFor="newsapi-key">NewsAPI key (optional)</label>
    <input id="newsapi-key" type="password" autoComplete="off" spellCheck="false" aria-describedby="key-storage-warning" value={newsKey} onChange={(event) => setNewsKey(event.target.value)} />
    <label htmlFor="thenewsapi-key">TheNewsAPI key (optional)</label>
    <input id="thenewsapi-key" type="password" autoComplete="off" spellCheck="false" aria-describedby="key-storage-warning" value={theNewsKey} onChange={(event) => setTheNewsKey(event.target.value)} />
    {notice && <p role={notice.success ? 'status' : 'alert'}>{notice.text}</p>}
    <div className="dialog-actions"><button type="button" onClick={() => handleClear('cache')}>Clear news cache</button>
      <button type="button" onClick={() => handleClear('keys')}>Remove keys</button>
      <button type="submit" className="primary-button">Save keys</button></div>
  </form>;
}

export default function SettingsModal({ isOpen, onClose, onConfigSaved }) {
  return <ModalDialog isOpen={isOpen} onClose={onClose} title="Settings">
    {isOpen && <KeySettings onConfigSaved={onConfigSaved} />}
  </ModalDialog>;
}
