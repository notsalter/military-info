import { it, expect, vi } from 'vitest';
import './testStorage';
import { runRequest } from './requestUtils';
it('never starts a transport cancelled before its scheduled request callback', async () => {
  const controller = new AbortController();
  const request = vi.fn(() => Promise.resolve('late'));
  const pending = runRequest(request, { signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await Promise.resolve();
  expect(request).not.toHaveBeenCalled();
});
