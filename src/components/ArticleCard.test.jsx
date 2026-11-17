import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import ArticleCard from './ArticleCard';
import { FEEDS } from '../services/feeds';

const article = { id: 'https://example.test/share-fixture', url: 'https://example.test/share-fixture', title: 'Test fixture: registered navy headline', description: 'Synthetic component fixture.', source: { id: FEEDS[0].id, name: FEEDS[0].name, url: FEEDS[0].url }, publishedAt: null };
const path = `/article/${FEEDS[0].id}/${Buffer.from(article.url).toString('base64url')}`;

it.each([{ ...article, source: { id: 'test-unregistered', name: 'Test fixture publisher' } }, { ...article, url: 'javascript:alert(1)' }])('keeps unsupported articles as drawer buttons rather than first-party links %j', async (fixture) => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(<ArticleCard article={fixture} onSelect={onSelect} />);
  expect(screen.queryByRole('link', { name: fixture.title })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: fixture.title }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(fixture);
});

it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])('preserves native headline navigation for modified clicks %j', (options) => {
  const onSelect = vi.fn();
  render(<ArticleCard article={article} onSelect={onSelect} />);
  const headline = screen.getByRole('link', { name: article.title });
  let allowed;
  const preventTestNavigation = (event) => { allowed = !event.defaultPrevented; event.preventDefault(); };
  document.addEventListener('click', preventTestNavigation, { once: true });
  fireEvent.click(headline, options);
  expect(onSelect).not.toHaveBeenCalled();
  expect(allowed).toBe(true);
});

it('provides a native first-party headline link with keyboard drawer activation', async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(<ArticleCard article={article} onSelect={onSelect} />);
  const headline = screen.getByRole('link', { name: article.title });
  expect(headline).toHaveAttribute('href', path);
  expect(headline).toHaveClass('headline-button');
  await user.tab();
  await user.tab();
  expect(headline).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(article);
});
