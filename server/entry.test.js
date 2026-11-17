import { expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]) }));
vi.mock('node:https', () => ({ request: vi.fn((_url, _options, callback) => {
  const req = new EventEmitter();
  req.destroy = vi.fn();
  req.end = () => {
    const res = Readable.from(['<rss><channel><item><title>Army entry</title><link>https://www.defensenews.com/entry</link></item></channel></rss>']);
    res.statusCode = 200;
    res.headers = {};
    callback(res);
  };
  return req;
}) }));

it('the default Vercel entry rejects arbitrary input and serves fixed-feed snippets through the pinned transport', async () => {
  const { default: handler } = await import('../api/feeds.js');
  const { request } = await import('node:https');
  const { lookup } = await import('node:dns/promises');
  function response() {
    return { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
  }
  const invalid = response();
  await handler({ method: 'GET', url: '/api/feeds?id=defense-news&url=https://localhost' }, invalid);
  expect(invalid.statusCode).toBe(400);
  expect(request).not.toHaveBeenCalled();
  expect(lookup).not.toHaveBeenCalled();
  const valid = response();
  await handler({ method: 'GET', url: '/api/feeds?id=defense-news' }, valid);
  expect(valid.statusCode).toBe(200);
  expect(valid.body.articles[0].title).toBe('Army entry');
  expect(valid.body.source).toEqual({ id: 'defense-news', name: 'Defense News' });
  expect(request.mock.calls[0][0].href).toBe('https://www.defensenews.com/arc/outboundfeeds/rss/');
  expect(request.mock.calls[0][1].lookup).toBeTypeOf('function');
  expect(request.mock.calls[0][1].rejectUnauthorized).toBe(true);
  const warm = response();
  await handler({ method: 'GET', url: '/api/feeds?id=defense-news' }, warm);
  expect(request).toHaveBeenCalledTimes(1);
  expect(warm.body.fetchedAt).toBe(valid.body.fetchedAt);
});
