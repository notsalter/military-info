import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { clear: vi.fn() } });
});
import SearchBar from './SearchBar';

it('submits a labeled search and clears to the unfiltered query', async () => {
  const onSearch = vi.fn();
  const user = userEvent.setup();
  render(<SearchBar onSearch={onSearch} />);
  const input = screen.getByRole('searchbox', { name: 'Search headlines' });
  await user.type(input, '  navy  ');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(onSearch).toHaveBeenLastCalledWith('navy');
  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(input).toHaveValue('');
  expect(onSearch).toHaveBeenLastCalledWith('');
});
