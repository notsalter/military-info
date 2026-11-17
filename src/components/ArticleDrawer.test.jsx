import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import ArticleDrawer from './ArticleDrawer';
import { FEEDS } from '../services/feeds';

const article = { id: 'https://example.test/share-fixture', url: 'https://example.test/share-fixture', title: 'Test fixture: registered navy headline', description: 'Synthetic drawer fixture.', source: { id: FEEDS[0].id, name: FEEDS[0].name, url: FEEDS[0].url }, publishedAt: null };
const shareURL = `${window.location.origin}/article/${FEEDS[0].id}/${Buffer.from(article.url).toString('base64url')}`;
const drawer = (value = article) => <ArticleDrawer article={value} onClose={vi.fn()} onToggleBookmark={vi.fn()} isBookmarked={false} />;

it('does not offer copying or sharing for an unregistered source', () => {
  render(drawer({ ...article, source: { id: 'test-unregistered', name: 'Test fixture publisher' } }));
  expect(screen.getByText('This source does not support a Military Info share link.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Share article' })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
});

it.each(['missing', 'rejected'])('shows a selectable labeled URL when the clipboard is %s without claiming copied', async (mode) => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockRejectedValue(new Error('Test fixture: clipboard denied'));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: mode === 'missing' ? undefined : { writeText } });
  render(drawer());
  await user.click(screen.getByRole('button', { name: 'Copy link' }));
  const input = await screen.findByRole('textbox', { name: 'Military Info share link' });
  expect(input).toHaveValue(shareURL);
  expect(input).toHaveAttribute('readonly');
  expect(screen.getByRole('status')).toHaveTextContent('Copy is unavailable. Select and copy the link below.');
  expect(screen.queryByText('Share link copied.')).not.toBeInTheDocument();
  await user.click(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(shareURL.length);
});

it('invokes native sharing synchronously from its own click with the first-party URL', () => {
  const share = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  render(drawer());
  fireEvent.click(screen.getByRole('button', { name: 'Share article' }));
  expect(share).toHaveBeenCalledExactlyOnceWith({ title: article.title, url: shareURL });
  expect(screen.queryByText('Share link copied.')).not.toBeInTheDocument();
});

it.each(['AbortError', 'NotAllowedError', 'sync failure'])('handles native share %s without claiming copied', async (name) => {
  const user = userEvent.setup();
  const error = Object.assign(new Error('Test fixture: share declined'), { name });
  const share = name === 'sync failure' ? vi.fn(() => { throw error; }) : vi.fn().mockRejectedValue(error);
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  render(drawer());
  await user.click(screen.getByRole('button', { name: 'Share article' }));
  if (name === 'AbortError') {
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  } else {
    expect(await screen.findByRole('textbox', { name: 'Military Info share link' })).toHaveValue(shareURL);
    expect(screen.getByRole('status')).toHaveTextContent('Sharing is unavailable. Select and copy the link below.');
  }
  expect(screen.queryByText('Share link copied.')).not.toBeInTheDocument();
});

it.each(['success', 'failure'])('does not leak a pending clipboard %s into a different article', async (completion) => {
  const user = userEvent.setup();
  let resolve; let reject;
  const pending = new Promise((done, fail) => { resolve = done; reject = fail; });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockReturnValue(pending) } });
  const { rerender } = render(drawer());
  await user.click(screen.getByRole('button', { name: 'Copy link' }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  const next = { ...article, id: 'https://example.test/next', url: 'https://example.test/next', title: 'Test fixture: next article' };
  rerender(drawer(next));
  await act(async () => completion === 'success' ? resolve() : reject(new Error('Test fixture: late clipboard failure')));
  expect(screen.getByRole('dialog', { name: next.title })).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('ignores an older clipboard completion after a newer share cancellation', async () => {
  const user = userEvent.setup();
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockReturnValue(pending) } });
  Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn().mockRejectedValue(Object.assign(new Error('Test fixture: canceled'), { name: 'AbortError' })) });
  render(drawer());
  await user.click(screen.getByRole('button', { name: 'Copy link' }));
  await user.click(screen.getByRole('button', { name: 'Share article' }));
  await act(async () => resolve());
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('copies a first-party URL only after clipboard success and explains feed availability', async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(drawer());
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Copy link' }));
  expect(writeText).toHaveBeenCalledExactlyOnceWith(shareURL);
  expect(within(dialog).getByRole('status')).toHaveTextContent('Share link copied.');
  expect(within(dialog).getByText('Share links resolve while the article remains in its publisher feed.')).toBeInTheDocument();
});

it('keeps the publisher action as the final Tab stop with the selectable fallback inside the focus trap', async () => {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  render(drawer());
  const close = screen.getByRole('button', { name: 'Close article' });
  await user.tab();
  expect(screen.getByRole('button', { name: 'Copy link' })).toHaveFocus();
  await user.keyboard('{Enter}');
  const input = await screen.findByRole('textbox', { name: 'Military Info share link' });
  await user.tab();
  expect(input).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Save article' })).toHaveFocus();
  await user.tab();
  const publisher = screen.getByRole('link', { name: `Read at ${article.source.name} (opens in new tab)` });
  expect(publisher).toHaveFocus();
  await user.tab();
  expect(close).toHaveFocus();
  await user.tab({ shift: true });
  expect(publisher).toHaveFocus();
});

it('drops stale native-share failures after the drawer unmounts and another article opens', async () => {
  const user = userEvent.setup();
  let reject;
  const pending = new Promise((_, fail) => { reject = fail; });
  Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn().mockReturnValue(pending) });
  const { rerender } = render(drawer());
  await user.click(screen.getByRole('button', { name: 'Share article' }));
  rerender(drawer(null));
  rerender(drawer({ ...article, id: 'https://example.test/next', url: 'https://example.test/next', title: 'Test fixture: next article' }));
  await act(async () => reject(new Error('Test fixture: late native share error')));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
