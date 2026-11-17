import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import ArticleImage from './ArticleImage';

it('renders a public HTTPS publisher image without sending the referring article URL', () => {
  render(<ArticleImage url="https://images.example.com/test-fixture.jpg" title="Test fixture: image boundary" priority />);
  const image = screen.getByRole('img');
  expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
  expect(image).toHaveAttribute('width', '640');
  expect(image).toHaveAttribute('height', '360');
  expect(image).toHaveAttribute('fetchpriority', 'high');
  fireEvent.error(image);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it.each(['http://images.example.com/test.jpg', 'https://127.0.0.1/test.jpg', 'https://user:secret@images.example.com/test.jpg', 'data:image/png;base64,AA=='])('omits unsafe optional publisher image %s without an empty slot', (url) => {
  const { container } = render(<ArticleImage url={url} title="Test fixture: image boundary" />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(container).toBeEmptyDOMElement();
});
