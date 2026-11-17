import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import App from '../App';
import { fetchNews } from '../services/newsApi';
import { readBookmarks, removeBookmark, saveBookmarks } from '../services/storage';
import { FEEDS } from '../services/feeds';
import { readFileSync } from 'node:fs';
import { cwd } from 'node:process';
const stylesheet = readFileSync(`${cwd()}/src/index.css`, 'utf8');

vi.mock('../services/newsApi', () => ({ fetchNews: vi.fn(), getCustomKeys: () => ({}), saveCustomKeys: vi.fn(), clearCustomKeys: vi.fn(), clearCache: vi.fn() }));
vi.mock('../services/storage', async importOriginal => ({ ...(await importOriginal()), readBookmarks: vi.fn(), removeBookmark: vi.fn(), saveBookmarks: vi.fn() }));

const navy = { id: 'https://example.test/navy', title: 'Test fixture: navy procurement', description: 'Test fixture for article interactions.', url: 'https://example.test/navy', urlToImage: null, publishedAt: '2026-01-03T00:00:00.000Z', source: { id: 'test-a', name: 'Test publisher A' } };
const ground = { ...navy, id: 'https://example.test/ground', url: 'https://example.test/ground', title: 'Test fixture: army procurement', publishedAt: '2026-01-01T00:00:00Z', source: { id: 'test-b', name: 'Test publisher B' } };
const result = (articles, extra = {}) => ({ success: true, articles, source: 'rss', cached: false, stale: false, fetchedAt: null, feedHealth: [], ...extra });
const deferred = () => { let resolve; let reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { clear: vi.fn(), getItem: () => null } });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  readBookmarks.mockReset().mockReturnValue([]);
  saveBookmarks.mockReset().mockReturnValue({ success: true });
  removeBookmark.mockReset().mockImplementation(id => ({ success: true, articles: readBookmarks().filter(item => item.id !== id) }));
  fetchNews.mockResolvedValue(result([navy, ground]));
});

it.each([
  { age: 'newer', addition: navy, recovered: false },
  { age: 'older', addition: ground, recovered: false },
  { age: 'newer', addition: navy, recovered: true },
  { age: 'older', addition: ground, recovered: true },
])('rejects a $age bookmark at capacity after recovered=$recovered without losing saved records, then permits removal and replacement', async ({ addition, recovered }) => {
  const actualStorage = await vi.importActual('../services/storage');
  const values = new Map();
  let blockedRead = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => { if (blockedRead) throw new Error('Test fixture: blocked read'); return values.get(key) ?? null; },
    setItem: vi.fn((key, value) => values.set(key, String(value))),
  } });
  const fixtures = Array.from({ length: 500 }, (_, index) => ({
    ...navy, id: `https://example.test/capacity-${index}`, url: `https://example.test/capacity-${index}`,
    title: `Test fixture: capacity navy report ${index}`, publishedAt: '2026-01-02T00:00:00.000Z',
  }));
  expect(actualStorage.saveBookmarks(fixtures)).toEqual({ success: true });
  readBookmarks.mockImplementation(actualStorage.readBookmarks);
  saveBookmarks.mockImplementation(actualStorage.saveBookmarks);
  removeBookmark.mockImplementation(actualStorage.removeBookmark);
  blockedRead = recovered;
  fetchNews.mockResolvedValue(result([addition, fixtures[0]]));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: addition.title });
  if (recovered) {
    const unreadBytes = values.get('military_bookmarks');
    localStorage.setItem.mockClear();
    await user.click(screen.getByRole('button', { name: addition.title }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save article' }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Retry saved articles');
    expect(saveBookmarks).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(values.get('military_bookmarks')).toBe(unreadBytes);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close article' }));
    blockedRead = false;
    await user.click(screen.getByRole('button', { name: 'Retry saved articles' }));
  }
  expect(screen.getByRole('button', { name: 'Saved articles (500)' })).toBeInTheDocument();
  const before = localStorage.getItem('military_bookmarks');
  localStorage.setItem.mockClear();
  await user.click(screen.getByRole('button', { name: addition.title }));
  const dialog = screen.getByRole('dialog', { name: addition.title });
  await user.click(within(dialog).getByRole('button', { name: 'Save article' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(/500.*Remove.*before saving/i);
  expect(within(dialog).getByRole('button', { name: 'Save article' })).toHaveAttribute('aria-pressed', 'false');
  expect(within(dialog).queryByText('Article saved in this browser.')).not.toBeInTheDocument();
  expect(localStorage.setItem).not.toHaveBeenCalled();
  expect(localStorage.getItem('military_bookmarks')).toBe(before);
  await user.click(within(dialog).getByRole('button', { name: 'Close article' }));
  await user.click(screen.getByRole('button', { name: 'Saved articles (500)' }));
  expect(screen.getByText('Showing 12 of 500 articles.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: fixtures[0].title }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove saved article' }));
  expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('Article removed from saved articles.');
  expect(JSON.parse(localStorage.getItem('military_bookmarks')).articles).toHaveLength(499);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close article' }));
  expect(screen.getByRole('button', { name: 'Saved articles (499)' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Latest news' }));
  await user.click(screen.getByRole('button', { name: addition.title }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save article' }));
  expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('Article saved in this browser.');
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove saved article' })).toHaveAttribute('aria-pressed', 'true');
  const persisted = actualStorage.readBookmarks();
  expect(persisted).toHaveLength(500);
  expect(new Set(persisted.map(item => item.id))).toEqual(new Set([...fixtures.slice(1).map(item => item.id), addition.id]));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close article' }));
  await user.click(screen.getByRole('button', { name: 'Saved articles (500)' }));
  expect(screen.getByText('Showing 12 of 500 articles.')).toBeInTheDocument();
});

it.each(['legacy array', 'versioned collection'])('recovers an oversized %s by removing one saved article at a time before permitting an addition', async format => {
  const actualStorage = await vi.importActual('../services/storage');
  const fixtures = Array.from({ length: 503 }, (_, index) => ({
    ...navy, id: `https://example.test/oversized-${index}`, url: `https://example.test/oversized-${index}`,
    title: `Test fixture: oversized navy report ${index}`, publishedAt: '2026-01-02T00:00:00.000Z',
  }));
  const duplicate = { ...fixtures[0], url: `${fixtures[0].url}#duplicate` };
  const raw = [...fixtures, duplicate];
  const bytes = JSON.stringify(format === 'legacy array' ? raw : { version: 1, articles: raw });
  const values = new Map([['military_bookmarks', bytes]]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: vi.fn((key, value) => values.set(key, String(value))),
  } });
  readBookmarks.mockImplementation(actualStorage.readBookmarks);
  saveBookmarks.mockImplementation(actualStorage.saveBookmarks);
  removeBookmark.mockImplementation(actualStorage.removeBookmark);
  fetchNews.mockResolvedValue(result([navy]));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: navy.title });
  expect(localStorage.setItem).not.toHaveBeenCalled();
  expect(values.get('military_bookmarks')).toBe(bytes);
  const remaining = new Set(fixtures.map(item => item.id));
  for (let count = 503; count >= 499; count--) {
    expect(screen.getByRole('button', { name: `Saved articles (${count})` })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Latest news' }));
    await user.click(screen.getByRole('button', { name: navy.title }));
    const dialog = screen.getByRole('dialog');
    const before = values.get('military_bookmarks');
    localStorage.setItem.mockClear();
    await user.click(within(dialog).getByRole('button', { name: 'Save article' }));
    if (count === 499) {
      expect(within(dialog).getByRole('status')).toHaveTextContent('Article saved in this browser.');
      expect(within(dialog).getByRole('button', { name: 'Remove saved article' })).toHaveAttribute('aria-pressed', 'true');
      remaining.add(navy.id);
    } else {
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/500.*Remove.*before saving/i);
      expect(within(dialog).getByRole('button', { name: 'Save article' })).toHaveAttribute('aria-pressed', 'false');
      expect(localStorage.setItem).not.toHaveBeenCalled();
      expect(values.get('military_bookmarks')).toBe(before);
    }
    await user.click(within(dialog).getByRole('button', { name: 'Close article' }));
    if (count === 499) break;
    await user.click(screen.getByRole('button', { name: `Saved articles (${count})` }));
    expect(screen.getByText(`Showing 12 of ${count} articles.`)).toBeInTheDocument();
    const headline = screen.getAllByRole('heading', { level: 3 })[0].querySelector('button');
    const removed = fixtures.find(item => item.title === headline.textContent);
    await user.click(headline);
    const removalDialog = screen.getByRole('dialog');
    await user.click(within(removalDialog).getByRole('button', { name: 'Remove saved article' }));
    expect(within(removalDialog).getByRole('status')).toHaveTextContent('Article removed from saved articles.');
    expect(within(removalDialog).getByRole('button', { name: 'Save article' })).toHaveAttribute('aria-pressed', 'false');
    remaining.delete(removed.id);
    const persisted = JSON.parse(values.get('military_bookmarks')).articles;
    expect(persisted).toHaveLength(count - 1);
    expect(new Set(persisted.map(item => item.id))).toEqual(remaining);
    await user.click(within(removalDialog).getByRole('button', { name: 'Close article' }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.queryByRole('button', { name: removed.title })).not.toBeInTheDocument();
  }
  const persisted = actualStorage.readBookmarks();
  expect(persisted).toHaveLength(500);
  expect(new Set(persisted.map(item => item.id))).toEqual(remaining);
  expect(screen.getByRole('button', { name: 'Saved articles (500)' })).toBeInTheDocument();
});

it.each([
  { format: 'legacy array', failure: 'read' },
  { format: 'legacy array', failure: 'write' },
  { format: 'versioned collection', failure: 'read' },
  { format: 'versioned collection', failure: 'write' },
])('preserves an oversized $format in storage and the UI when removal fails to $failure', async ({ format, failure }) => {
  const actualStorage = await vi.importActual('../services/storage');
  const fixtures = Array.from({ length: 502 }, (_, index) => ({
    ...navy, id: `https://example.test/failure-${index}`, url: `https://example.test/failure-${index}`,
    title: `Test fixture: failure navy report ${index}`,
  }));
  const before = JSON.stringify(format === 'legacy array' ? fixtures : { version: 1, articles: fixtures });
  const values = new Map([['military_bookmarks', before]]);
  let blocked = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => { if (blocked && failure === 'read') throw new Error('Test fixture: blocked read'); return values.get(key) ?? null; },
    setItem: vi.fn((key, value) => { if (blocked && failure === 'write') throw new Error('Test fixture: quota'); values.set(key, String(value)); }),
  } });
  readBookmarks.mockImplementation(actualStorage.readBookmarks);
  saveBookmarks.mockImplementation(actualStorage.saveBookmarks);
  removeBookmark.mockImplementation(actualStorage.removeBookmark);
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Saved articles (502)' }));
  await user.click(screen.getByRole('button', { name: fixtures[0].title }));
  blocked = true;
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Remove saved article' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(failure === 'read' ? 'Unable to read browser storage.' : 'Unable to save browser storage.');
  expect(within(dialog).queryByRole('status')).not.toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Remove saved article' })).toHaveAttribute('aria-pressed', 'true');
  expect(values.get('military_bookmarks')).toBe(before);
  if (failure === 'read') expect(localStorage.setItem).not.toHaveBeenCalled();
  else expect(localStorage.setItem).toHaveBeenCalledTimes(1);
  await user.click(within(dialog).getByRole('button', { name: 'Close article' }));
  expect(screen.getByRole('button', { name: 'Saved articles (502)' })).toBeInTheDocument();
  expect(screen.getByText('Showing 12 of 502 articles.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: fixtures[0].title })).toHaveFocus();
  blocked = false;
  expect(actualStorage.readBookmarks()).toHaveLength(502);
});

it('uses the current persisted removal result rather than overwriting records absent from the UI snapshot', async () => {
  const actualStorage = await vi.importActual('../services/storage');
  const fixtures = Array.from({ length: 502 }, (_, index) => ({
    ...navy, id: `https://example.test/snapshot-${index}`, url: `https://example.test/snapshot-${index}`,
    title: `Test fixture: snapshot navy report ${index}`,
  }));
  const values = new Map([['military_bookmarks', JSON.stringify({ version: 1, articles: fixtures })]]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: vi.fn((key, value) => values.set(key, String(value))),
  } });
  readBookmarks.mockImplementation(actualStorage.readBookmarks);
  saveBookmarks.mockImplementation(actualStorage.saveBookmarks);
  removeBookmark.mockImplementation(actualStorage.removeBookmark);
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Saved articles (502)' }));
  await user.click(screen.getByRole('button', { name: fixtures[0].title }));
  const current = [...actualStorage.readBookmarks(), ground];
  values.set('military_bookmarks', JSON.stringify({ version: 1, articles: current }));
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Remove saved article' }));
  expect(within(dialog).getByRole('status')).toHaveTextContent('Article removed from saved articles.');
  const persisted = JSON.parse(values.get('military_bookmarks')).articles;
  expect(persisted).toHaveLength(502);
  expect(new Set(persisted.map(item => item.id))).toEqual(new Set([...fixtures.slice(1).map(item => item.id), ground.id]));
  await user.click(within(dialog).getByRole('button', { name: 'Close article' }));
  expect(screen.getByRole('button', { name: 'Saved articles (502)' })).toBeInTheDocument();
  await user.type(screen.getByRole('searchbox', { name: 'Search headlines' }), 'army procurement');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(screen.getByRole('button', { name: ground.title })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: fixtures[0].title })).not.toBeInTheDocument();
});

it('reports unreadable saved storage without claiming an empty collection and retries the read', async () => {
  const unreadable = Object.defineProperty([], 'storageError', { value: 'Unable to read browser storage.' });
  readBookmarks.mockReturnValueOnce(unreadable).mockReturnValue([navy]);
  fetchNews.mockReturnValue(new Promise(() => {}));
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to read browser storage.');
  expect(screen.getByRole('alert')).toHaveTextContent('Allow browser storage for this site');
  expect(screen.queryByRole('button', { name: 'Saved articles (0)' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Saved articles (unavailable)' }));
  expect(screen.queryByText(/No saved articles yet/)).not.toBeInTheDocument();
  expect(screen.queryByText('No articles match these filters.')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Retry saved articles' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Saved articles (1)' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: navy.title })).toBeInTheDocument();
});

it.each([
  { collection: [], storageError: 'Unable to read browser storage.', article: navy, action: 'Save article' },
  { collection: [ground], storageError: 'Unable to save browser storage.', article: ground, action: 'Remove saved article' },
])('blocks $action while saved storage reports $storageError even if writes would succeed', async ({ collection, storageError, article, action }) => {
  const guarded = Object.defineProperty([...collection], 'storageError', { value: storageError });
  readBookmarks.mockReturnValue(guarded);
  saveBookmarks.mockReturnValue({ success: true });
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: article.title }));
  const dialog = screen.getByRole('dialog', { name: article.title });
  await user.click(within(dialog).getByRole('button', { name: action }));
  expect(saveBookmarks).not.toHaveBeenCalled();
  expect(removeBookmark).not.toHaveBeenCalled();
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Retry saved articles');
  expect(within(dialog).getByRole('button', { name: action })).toHaveAttribute('aria-pressed', String(collection.includes(article)));
  await user.click(within(dialog).getByRole('button', { name: 'Close article' }));
  expect(screen.getByRole('alert')).toHaveTextContent(storageError);
  expect(screen.getByRole('button', { name: 'Saved articles (unavailable)' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: navy.title })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Saved articles (unavailable)' }));
  expect(screen.queryByText(/No saved articles yet/)).not.toBeInTheDocument();
  if (collection.length) expect(screen.getByRole('button', { name: ground.title })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Retry saved articles' }));
  expect(screen.getByRole('alert')).toHaveTextContent(storageError);
  expect(saveBookmarks).not.toHaveBeenCalled();
});

it('merges a new saved article with the collection recovered by Retry saved articles', async () => {
  const unreadable = Object.defineProperty([], 'storageError', { value: 'Unable to read browser storage.' });
  readBookmarks.mockReturnValueOnce(unreadable).mockReturnValue([ground]);
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: navy.title }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save article' }));
  expect(saveBookmarks).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close article' }));
  await user.click(screen.getByRole('button', { name: 'Retry saved articles' }));
  expect(readBookmarks).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Saved articles (1)' })).toBeInTheDocument();
  expect(saveBookmarks).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: navy.title }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save article' }));
  expect(saveBookmarks).toHaveBeenCalledExactlyOnceWith([ground, navy]);
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove saved article' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close article' }));
  await user.click(screen.getByRole('button', { name: 'Saved articles (2)' }));
  expect(screen.getByRole('button', { name: ground.title })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: navy.title })).toBeInTheDocument();
});

it('announces accepted feed storage warnings while keeping fetched articles readable', async () => {
  const request = deferred();
  fetchNews.mockReturnValueOnce(request.promise);
  const user = userEvent.setup();
  render(<App />);
  const options = fetchNews.mock.calls[0][2];
  await act(async () => options.onProgress(result([navy], { storageWarnings: ['Unable to read browser storage.'] })));
  expect(screen.getByRole('button', { name: navy.title })).toBeInTheDocument();
  expect(screen.getByText('Unable to read browser storage.').closest('[role="status"]')).toHaveTextContent('Allow browser storage for this site');
  await act(async () => request.resolve(result([navy, ground], { storageWarnings: ['Unable to save browser storage.'] })));
  expect(screen.getByRole('button', { name: ground.title })).toBeInTheDocument();
  expect(screen.getByText('Unable to save browser storage.').closest('[role="status"]')).toHaveTextContent('Free space');
  await user.click(screen.getByRole('button', { name: 'Retry news storage' }));
  expect(fetchNews).toHaveBeenLastCalledWith('', 200, expect.objectContaining({ force: true }));
  expect(screen.queryByText('Unable to save browser storage.')).not.toBeInTheDocument();
});

it('separates retained article provenance from health when a refreshed request rejects', async () => {
  const refresh = deferred();
  fetchNews.mockResolvedValueOnce(result([navy], { stale: true, feedHealth: [{ id: FEEDS[0].id, status: 'ok' }] })).mockReturnValueOnce(refresh.promise);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: navy.title });
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(screen.getByText(/Cached articles may be out of date/)).toBeInTheDocument();
  expect(screen.getByText(/Showing articles from a previous result/)).toHaveAttribute('role', 'status');
  await user.click(screen.getByRole('button', { name: 'Sources' }));
  const pendingDialog = screen.getByRole('dialog', { name: 'Sources' });
  expect(within(pendingDialog).queryByText('Response received')).not.toBeInTheDocument();
  expect(within(pendingDialog).getByText(/Current request is in progress/)).toBeInTheDocument();
  await user.click(within(pendingDialog).getByRole('button', { name: 'Close sources' }));
  await act(async () => refresh.reject(new Error('Test fixture: refresh failed')));
  expect(screen.getByRole('alert')).toHaveTextContent('News could not be loaded');
  expect(screen.getByRole('button', { name: navy.title })).toBeInTheDocument();
  expect(screen.getByText(/Showing articles from a previous result/)).toHaveTextContent('The current request failed');
  await user.click(screen.getByRole('button', { name: 'Sources' }));
  const failedDialog = screen.getByRole('dialog', { name: 'Sources' });
  expect(within(failedDialog).queryByText('Response received')).not.toBeInTheDocument();
  expect(within(failedDialog).getByText(/Current request failed/)).toBeInTheDocument();
});

it('labels cached feed statuses as previous reports rather than current checks', async () => {
  fetchNews.mockResolvedValue(result([navy], { cached: true, feedHealth: [{ id: FEEDS[0].id, status: 'ok' }] }));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: navy.title });
  await user.click(screen.getByRole('button', { name: 'Sources' }));
  const dialog = screen.getByRole('dialog', { name: 'Sources' });
  expect(within(dialog).queryByText('Response received')).not.toBeInTheDocument();
  expect(within(dialog).getByText('Response received (reported with cached result)')).toBeInTheDocument();
  expect(within(dialog).getByText(/Cached result statuses may be from a previous request/)).toBeInTheDocument();
});

it.each(['view switch', 'refresh'])('keeps an unavailable publisher selection explicit after a %s', async (change) => {
  readBookmarks.mockReturnValue([ground]);
  fetchNews.mockResolvedValueOnce(result([navy])).mockResolvedValue(result([ground]));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: navy.title });
  await user.selectOptions(screen.getByLabelText('Publisher'), 'test-a');
  if (change === 'view switch') await user.click(screen.getByRole('button', { name: 'Saved articles (1)' }));
  else await user.click(screen.getByRole('button', { name: 'Search' }));
  const missing = await screen.findByRole('option', { name: 'test-a (no articles available in this collection)' });
  expect(missing.selected).toBe(true);
  expect(screen.getByLabelText('Publisher')).toHaveValue('test-a');
  expect(screen.queryByRole('button', { name: ground.title })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByLabelText('Publisher')).toHaveValue('all');
  expect(await screen.findByRole('button', { name: ground.title })).toBeInTheDocument();
});

it.each([14, 15])('focuses the first appended headline after keyboard pagination ends with %i articles', async (count) => {
  const pool = Array.from({ length: count }, (_, index) => ({ ...navy, id: `https://example.test/page-${index}`, url: `https://example.test/page-${index}`, title: `Test fixture: pagination headline ${index}` }));
  fetchNews.mockResolvedValue(result(pool));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: pool[0].title });
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12);
  const more = screen.getByRole('button', { name: 'Show more articles' });
  for (let step = 0; step < 60 && document.activeElement !== more; step++) await user.tab();
  expect(more).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(count);
  expect(screen.queryByRole('button', { name: 'Show more articles' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 3 })[12].querySelector('button')).toHaveFocus();
});

it('keeps the mobile filter layout in its Topic, Publisher, Sort keyboard order', async () => {
  fetchNews.mockReturnValue(new Promise(() => {}));
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getAllByRole('combobox')).toEqual([screen.getByLabelText('Topic'), screen.getByLabelText('Publisher'), screen.getByLabelText('Sort articles')]);
  screen.getByLabelText('Topic').focus();
  await user.tab();
  expect(screen.getByLabelText('Publisher')).toHaveFocus();
  await user.tab();
  expect(screen.getByLabelText('Sort articles')).toHaveFocus();
  const mobileStyles = stylesheet.split('@media (min-width: 44rem)')[0];
  expect(mobileStyles).toContain('.filter-controls > div:nth-child(3) { grid-column: 1 / -1; grid-row: 2; }');
  expect(mobileStyles).not.toContain('.filter-controls > div:nth-child(2) { grid-column:');
});

it.each(['rejection', 'failure result'])('ignores a superseded %s without clearing current loading or notices', async (completion) => {
  const oldRequest = deferred();
  const currentRequest = deferred();
  fetchNews.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(currentRequest.promise);
  const user = userEvent.setup();
  render(<App />);
  const oldOptions = fetchNews.mock.calls[0][2];
  await user.click(screen.getByRole('button', { name: 'Search' }));
  const currentOptions = fetchNews.mock.calls[1][2];
  await act(async () => currentOptions.onProgress(result([ground], { storageWarnings: ['Test fixture: current storage warning'], feedHealth: [{ id: FEEDS[0].id, status: 'ok' }] })));
  await act(async () => {
    oldOptions.onProgress(result([navy], { storageWarnings: ['Test fixture: old storage warning'], feedHealth: [{ id: FEEDS[0].id, status: 'error' }] }));
    if (completion === 'rejection') oldRequest.reject(new Error('Test fixture: superseded failure'));
    else oldRequest.resolve(result([], { success: false, feedHealth: [{ id: FEEDS[0].id, status: 'error' }] }));
  });
  expect(oldOptions.signal.aborted).toBe(true);
  expect(screen.getByText('Loading news from publishers…')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: ground.title })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: navy.title })).not.toBeInTheDocument();
  expect(screen.getByText('Test fixture: current storage warning')).toBeInTheDocument();
  expect(screen.queryByText('Test fixture: old storage warning')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Sources' }));
  const dialog = screen.getByRole('dialog', { name: 'Sources' });
  expect(within(dialog).getByText('Response received')).toBeInTheDocument();
  expect(within(dialog).queryByText('Request failed')).not.toBeInTheDocument();
  expect(within(dialog).getByText(/Current request is in progress/)).toBeInTheDocument();
  await act(async () => currentRequest.resolve(result([ground])));
});

it('does not claim readable fetched articles when a failed result only contains storage warnings', async () => {
  fetchNews.mockResolvedValue(result([], { success: false, storageWarnings: ['Unable to clear browser storage.'] }));
  render(<App />);
  await screen.findByRole('alert');
  expect(screen.getByText('Unable to clear browser storage.').closest('[role="status"]')).toBeInTheDocument();
  expect(screen.queryByText('Fetched articles remain readable.', { exact: false })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry news storage' })).toBeInTheDocument();
});

it('does not relabel cached progress health as current checks when the request throws', async () => {
  const request = deferred();
  fetchNews.mockReturnValueOnce(request.promise);
  const user = userEvent.setup();
  render(<App />);
  await act(async () => fetchNews.mock.calls[0][2].onProgress(result([navy], { cached: true, stale: true, feedHealth: [{ id: FEEDS[0].id, status: 'ok' }] })));
  await act(async () => request.reject(new Error('Test fixture: request failed after cache')));
  await user.click(screen.getByRole('button', { name: 'Sources' }));
  const dialog = screen.getByRole('dialog', { name: 'Sources' });
  expect(within(dialog).getByText(/Current request failed/)).toHaveTextContent('Statuses reported with the cached result are not current checks.');
  expect(within(dialog).queryByText(/reflect only checks made during that request/)).not.toBeInTheDocument();
  expect(within(dialog).getByText('Response received (reported with cached result)')).toBeInTheDocument();
});

it('shows local saved articles while the news request is still pending', async () => {
  fetchNews.mockReturnValue(new Promise(() => {}));
  readBookmarks.mockReturnValue([navy]);
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Saved articles (1)' }));
  expect(screen.getByRole('button', { name: navy.title })).toBeInTheDocument();
  expect(screen.queryByText('Loading news from publishers…')).not.toBeInTheDocument();
  expect(fetchNews).toHaveBeenCalledTimes(1);
});

it('applies search to the local saved collection without starting another request', async () => {
  readBookmarks.mockReturnValue([navy, ground]);
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Saved articles (2)' }));
  await user.type(screen.getByRole('searchbox', { name: 'Search headlines' }), 'navy');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(screen.getByRole('button', { name: navy.title })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: ground.title })).not.toBeInTheDocument();
  expect(fetchNews).toHaveBeenCalledTimes(1);
});

it('ignores superseded responses and progress after a newer headline search', async () => {
  const oldRequest = deferred();
  const newRequest = deferred();
  fetchNews.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
  const user = userEvent.setup();
  render(<App />);
  const firstOptions = fetchNews.mock.calls[0][2];
  await user.type(screen.getByRole('searchbox', { name: 'Search headlines' }), 'army');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(firstOptions.signal.aborted).toBe(true);
  expect(fetchNews).toHaveBeenLastCalledWith('army', 200, expect.objectContaining({ signal: expect.any(AbortSignal), onProgress: expect.any(Function) }));
  await act(async () => { newRequest.resolve(result([ground])); });
  await act(async () => { firstOptions.onProgress(result([navy])); oldRequest.resolve(result([navy])); });
  expect(screen.getByRole('button', { name: ground.title })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: navy.title })).not.toBeInTheDocument();
});

it('announces a genuine empty search without presenting a network failure', async () => {
  fetchNews.mockResolvedValue(result([]));
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByText('No articles match these filters.')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(fetchNews).toHaveBeenLastCalledWith('', 200, expect.any(Object));
});

it('offers a forced retry after a rejected request and leaves saved articles readable', async () => {
  fetchNews.mockRejectedValueOnce(new Error('Test fixture: network failed'));
  readBookmarks.mockReturnValue([navy]);
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('News could not be loaded');
  await user.click(screen.getByRole('button', { name: 'Saved articles (1)' }));
  expect(screen.getByRole('button', { name: navy.title })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Latest news' }));
  await user.click(screen.getByRole('button', { name: 'Retry news' }));
  expect(fetchNews).toHaveBeenLastCalledWith('', 200, expect.objectContaining({ force: true }));
  expect(await screen.findByRole('button', { name: ground.title })).toBeInTheDocument();
});

it('does not mark an article saved when storage fails and persists only after success', async () => {
  const user = userEvent.setup();
  saveBookmarks.mockReturnValueOnce({ success: false, error: 'Test fixture: quota' });
  render(<App />);
  const headline = await screen.findByRole('button', { name: navy.title });
  await user.click(headline);
  const dialog = screen.getByRole('dialog', { name: navy.title });
  expect(within(dialog).getByRole('link', { name: 'Read at Test publisher A (opens in new tab)' })).toHaveAttribute('href', navy.url);
  await user.click(within(dialog).getByRole('button', { name: 'Save article' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Could not save');
  expect(within(dialog).getByRole('button', { name: 'Save article' })).toHaveAttribute('aria-pressed', 'false');
  await user.click(within(dialog).getByRole('button', { name: 'Save article' }));
  expect(within(dialog).getByRole('button', { name: 'Remove saved article' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(within(dialog).getByRole('button', { name: 'Close article' }));
  expect(headline).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Saved articles (1)' }));
  expect(screen.getByRole('button', { name: navy.title })).toBeInTheDocument();
  expect(saveBookmarks).toHaveBeenLastCalledWith([navy]);
});

it('filters by shared topic and publisher and orders articles by publication date', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: navy.title });
  await user.selectOptions(screen.getByLabelText('Sort articles'), 'oldest');
  expect(screen.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent(ground.title);
  await user.selectOptions(screen.getByLabelText('Topic'), 'naval');
  expect(screen.queryByRole('button', { name: ground.title })).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Publisher'), 'test-b');
  expect(screen.getByText('No articles match these filters.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(await screen.findByRole('button', { name: ground.title })).toBeInTheDocument();
});

it('renders progressive cached articles with honest stale status before the request finishes', async () => {
  fetchNews.mockReturnValue(new Promise(() => {}));
  render(<App />);
  const options = fetchNews.mock.calls[0][2];
  await act(async () => options.onProgress(result([navy], { cached: true, stale: true, fetchedAt: '2026-01-03T12:00:00.000Z' })));
  expect(screen.getByRole('button', { name: navy.title })).toBeInTheDocument();
  expect(screen.getByText(/Cached articles may be out of date/)).toBeInTheDocument();
  expect(screen.getByText('Loading news from publishers…')).toBeInTheDocument();
});

it('opens settings and a registry-based publisher dialog with measured request status only', async () => {
  const user = userEvent.setup();
  fetchNews.mockResolvedValue(result([navy], { feedHealth: [{ id: FEEDS[0].id, status: 'error' }] }));
  render(<App />);
  await screen.findByRole('button', { name: navy.title });
  await user.click(screen.getByRole('button', { name: 'Sources' }));
  const dialog = screen.getByRole('dialog', { name: 'Sources' });
  expect(within(dialog).getByRole('link', { name: `${FEEDS[0].name} (opens in new tab)` })).toHaveAttribute('href', FEEDS[0].url);
  expect(within(dialog).getByText('Request failed')).toBeInTheDocument();
  expect(within(dialog).getAllByText('Not checked in this request').length).toBeGreaterThan(0);
  await user.click(within(dialog).getByRole('button', { name: 'Close sources' }));
  await user.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
});

it('exposes reading landmarks and announces a bounded list with load-more pagination', async () => {
  const pool = Array.from({ length: 14 }, (_, index) => ({ ...navy, id: `https://example.test/fixture-${index}`, url: `https://example.test/fixture-${index}`, title: `Test fixture: navy article ${index}` }));
  fetchNews.mockResolvedValue(result(pool));
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByRole('link', { name: 'Skip to news' })).toHaveAttribute('href', '#news');
  expect(screen.getByRole('contentinfo')).toHaveTextContent('Headlines and short previews');
  expect(screen.getByRole('button', { name: 'Latest news' })).toHaveAttribute('aria-pressed', 'true');
  await screen.findByRole('button', { name: pool[0].title });
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12);
  await user.click(screen.getByRole('button', { name: 'Show more articles' }));
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(14);
  expect(screen.queryByRole('button', { name: 'Show more articles' })).not.toBeInTheDocument();
});

it('clears the visible search field when resetting filters', async () => {
  const user = userEvent.setup();
  readBookmarks.mockReturnValue([navy]);
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Saved articles (1)' }));
  const input = screen.getByRole('searchbox', { name: 'Search headlines' });
  await user.type(input, 'unmatched-test-fixture');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  await user.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(input).toHaveValue('');
  expect(screen.getByRole('button', { name: navy.title })).toBeInTheDocument();
});

it('announces the article count when the loaded collection changes', async () => {
  render(<App />);
  expect(await screen.findByText('Showing 2 of 2 articles.')).toHaveAttribute('role', 'status');
});

it('shows failed request health in sources instead of an unchecked label', async () => {
  const user = userEvent.setup();
  fetchNews.mockResolvedValue(result([], { success: false, feedHealth: [{ id: FEEDS[0].id, status: 'error' }] }));
  render(<App />);
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Sources' }));
  expect(within(screen.getByRole('dialog')).getByText('Request failed')).toBeInTheDocument();
});

it('aborts unmounted requests without accepting late results', async () => {
  const request = deferred();
  fetchNews.mockReturnValue(request.promise);
  const { unmount } = render(<App />);
  const options = fetchNews.mock.calls[0][2];
  unmount();
  expect(options.signal.aborted).toBe(true);
  await act(async () => { options.onProgress(result([navy])); request.resolve(result([navy])); });
  expect(screen.queryByRole('button', { name: navy.title })).not.toBeInTheDocument();
});

it('keeps a saved article when its removal throws', async () => {
  readBookmarks.mockReturnValue([navy]);
  removeBookmark.mockImplementation(() => { throw new Error('Test fixture: blocked storage'); });
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Saved articles (1)' }));
  await user.click(screen.getByRole('button', { name: navy.title }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove saved article' }));
  expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Could not save');
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove saved article' })).toHaveAttribute('aria-pressed', 'true');
});

it('resets pagination when a topic filter changes', async () => {
  const pool = Array.from({ length: 20 }, (_, index) => ({ ...navy, id: `https://example.test/fixture-${index}`, url: `https://example.test/fixture-${index}`, title: `Test fixture: navy article ${index}` }));
  fetchNews.mockResolvedValue(result(pool));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: pool[0].title });
  await user.click(screen.getByRole('button', { name: 'Show more articles' }));
  await user.selectOptions(screen.getByLabelText('Topic'), 'naval');
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12);
});

it('returns focus to the reading area when removing a saved article removes its trigger', async () => {
  readBookmarks.mockReturnValue([navy]);
  saveBookmarks.mockReturnValue({ success: true });
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Saved articles (1)' }));
  await user.click(screen.getByRole('button', { name: navy.title }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove saved article' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close article' }));
  expect(screen.getByRole('main')).toHaveFocus();
});

it('refreshes the latest collection after a search performed in saved articles', async () => {
  readBookmarks.mockReturnValue([navy, ground]);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: navy.title });
  await user.click(screen.getByRole('button', { name: 'Saved articles (2)' }));
  await user.type(screen.getByRole('searchbox', { name: 'Search headlines' }), 'army');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  await user.click(screen.getByRole('button', { name: 'Latest news' }));
  expect(fetchNews).toHaveBeenLastCalledWith('army', 200, expect.any(Object));
});
