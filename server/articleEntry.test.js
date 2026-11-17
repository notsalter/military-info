// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { Readable } from 'node:stream';
import { getArticlePath } from '../src/services/articleLinks.js';
import { FEEDS } from '../src/services/feeds.js';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]) }));
vi.mock('node:https', () => ({ request: vi.fn((_url, _options, callback) => {
  const req = new EventEmitter();
  req.destroy = vi.fn();
  req.end = () => {
    const res = Readable.from(['<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><item><title>TEST FIXTURE Army article entry</title><link>https://www.defensenews.com/test-fixture/entry</link><media:thumbnail url="https://images.example.org/test-fixture/entry.jpg"/></item></channel></rss>']);
    res.statusCode = 200;
    res.headers = {};
    callback(res);
  };
  return req;
}) }));

function response() {
  return {
    headers: {}, setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; }, end() { return this; },
    json(body) { this.body = body; return this; },
  };
}

it('TEST FIXTURE default article entry shares the hardened feed cache and never transports article or image URLs', async () => {
  const { default: handler } = await import('../api/article.js');
  const { default: feedsHandler } = await import('../api/feeds.js');
  const { request } = await import('node:https');
  const { lookup } = await import('node:dns/promises');
  const article = { title: 'TEST FIXTURE Army article entry', source: FEEDS[0], url: 'https://www.defensenews.com/test-fixture/entry' };
  const path = getArticlePath(article);
  const legacy = `/article/${FEEDS[0].id}/${btoa(article.url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  const invalid = response();
  await handler({ method: 'GET', url: `${path}?url=https://193.32.204.199` }, invalid);
  expect(invalid.statusCode).toBe(400);
  expect(request).not.toHaveBeenCalled();
  expect(lookup).not.toHaveBeenCalled();
  const valid = response();
  await handler({ method: 'GET', url: path }, valid);
  expect(valid.statusCode).toBe(200);
  expect(valid.body).toContain('TEST FIXTURE Army article entry');
  expect(valid.body).toContain('https://images.example.org/test-fixture/entry.jpg');
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0].href).toBe(FEEDS[0].url);
  expect(request.mock.calls[0][1].lookup).toBeTypeOf('function');
  expect(request.mock.calls[0][1].rejectUnauthorized).toBe(true);
  const feedRes = response();
  await feedsHandler({ method: 'GET', url: `/api/feeds?id=${FEEDS[0].id}` }, feedRes);
  expect(request).toHaveBeenCalledTimes(1);
  expect(feedRes.statusCode).toBe(200);
  expect(valid.headers['Last-Modified']).toBe(new Date(feedRes.body.fetchedAt).toUTCString());
  // Node requests replay the original pathname + injected query, not a fabricated API rewrite.
  const server = http.createServer(async (req, res) => {
    res.status = code => { res.statusCode = code; return res; };
    res.send = body => res.end(body);
    await handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const localRequest = (url, method) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: url, method }, res => {
      let body = '';
      res.setEncoding('utf8'); res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });
  try {
    for (const route of [path, legacy]) {
      const echo = `${route}?feed=${FEEDS[0].id}&article=${route.split('/').at(-1)}`;
      const get = await localRequest(echo, 'GET');
      const head = await localRequest(echo, 'HEAD');
      expect(get.status).toBe(200);
      expect(get.body).toBe(valid.body);
      expect(head.status).toBe(200);
      expect(head.headers['cache-control']).toBe(get.headers['cache-control']);
      expect(head.headers['last-modified']).toBe(get.headers['last-modified']);
      expect(head.body).toBe('');
    }
    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
