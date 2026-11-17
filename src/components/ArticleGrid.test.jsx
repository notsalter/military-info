import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import ArticleGrid from './ArticleGrid';

const fixture = { id: 'https://example.test/navy', title: 'Test fixture: navy report', description: 'Clearly labeled UI test fixture.', url: 'https://example.test/navy', urlToImage: 'https://example.test/photo.jpg', publishedAt: null, source: { id: 'test', name: 'Test publisher' } };
beforeEach(() => Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { clear: vi.fn() } }));

it('opens a headline with the keyboard and reports an unknown publication date honestly', async () => {
  const onSelectArticle = vi.fn();
  const user = userEvent.setup();
  render(<ArticleGrid articles={[fixture]} onSelectArticle={onSelectArticle} />);
  const headline = screen.getByRole('button', { name: fixture.title });
  headline.focus();
  await user.keyboard('{Enter}');
  expect(onSelectArticle).toHaveBeenCalledWith(fixture);
  expect(screen.getByText('Date unavailable')).toBeInTheDocument();
  expect(screen.getByText('Naval')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Test publisher' })).toHaveAttribute('href', fixture.url);
});

it('keeps image failure attached to stable article ids when sorting and retries a changed image URL', () => {
  const other = { ...fixture, id: 'https://example.test/other', url: 'https://example.test/other', title: 'Test fixture: other', urlToImage: 'https://example.test/other.jpg' };
  const { rerender } = render(<ArticleGrid articles={[fixture, other]} onSelectArticle={vi.fn()} />);
  const images = screen.getAllByRole('img');
  expect(images[0]).toHaveAttribute('width', '640');
  expect(images[0]).toHaveAttribute('height', '360');
  expect(images[0]).not.toHaveAttribute('loading', 'lazy');
  fireEvent.error(images[0]);
  expect(screen.getAllByRole('img')).toHaveLength(1);
  rerender(<ArticleGrid articles={[other, fixture]} onSelectArticle={vi.fn()} />);
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.getByRole('img')).toHaveAttribute('src', other.urlToImage);
  rerender(<ArticleGrid articles={[other, { ...fixture, urlToImage: 'https://example.test/replacement.jpg' }]} onSelectArticle={vi.fn()} />);
  expect(screen.getAllByRole('img')).toHaveLength(2);
});
