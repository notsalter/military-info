import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { FEEDS } from '../src/services/feeds.js';
import { createPublicFeedFetcher } from './publicFeedFetch.js';

const publicDNS = () => Promise.resolve([{ address: '93.184.216.34', family: 4 }]);
function transport(replies) {
  const requests = [];
  const request = vi.fn((url, options, callback) => {
    const req = new EventEmitter();
    req.end = () => {
      const reply = replies.shift();
      queueMicrotask(() => {
        const res = Readable.from(reply.chunks ?? [reply.body ?? '<rss><channel/></rss>']);
        res.statusCode = reply.status ?? 200;
        res.headers = reply.headers ?? {};
        callback(res);
      });
    };
    req.destroy = vi.fn(error => { if (error) queueMicrotask(() => req.emit('error', error)); });
    requests.push({ url: url.href, options, req });
    return req;
  });
  return { request, requests };
}

it.each([
  'https://localhost/feed', 'https://127.0.0.1/feed', 'https://[::1]/feed',
  'https://193.32.204.199/feed', 'https://attacker.invalid/feed',
  'http://www.defensenews.com/arc/outboundfeeds/rss/',
  'https://www.defensenews.com/arc/outboundfeeds/rss/?force=1',
  'https://user:pass@www.defensenews.com/arc/outboundfeeds/rss/',
])('rejects non-registry input %s before DNS or connect', async url => {
  const lookup = vi.fn(publicDNS);
  const wire = transport([{ body: 'not contacted' }]);
  await expect(createPublicFeedFetcher({ lookup, request: wire.request })(url)).rejects.toThrow();
  expect(lookup).not.toHaveBeenCalled();
  expect(wire.request).not.toHaveBeenCalled();
});

it.each([
  '0.1.2.3', '10.1.2.3', '100.64.0.1', '100.127.255.254', '127.0.0.1', '169.254.169.254',
  '172.16.0.1', '172.31.255.254', '192.0.0.9', '192.0.2.1', '192.88.99.1', '192.168.1.1',
  '198.18.0.1', '198.19.255.254', '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1', '255.255.255.255',
  '193.32.204.199', '::', '::1', '::ffff:127.0.0.1', '::ffff:c120:ccc7', '::ffff:93.184.216.34',
  'fc00::1', 'fe80::1', 'ff02::1', '64:ff9b::a00:1', '100::1', '2001:db8::1', '2001::1', '2002:7f00:1::', '3fff::1', 'not-an-ip',
])('blocks non-public or excluded DNS address %s before connect', async address => {
  const lookup = vi.fn().mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }]);
  const wire = transport([{ body: 'not contacted' }]);
  await expect(createPublicFeedFetcher({ lookup, request: wire.request })(FEEDS[0].url)).rejects.toThrow();
  expect(wire.request).not.toHaveBeenCalled();
});

it('rejects mixed public/private DNS answers rather than selecting the public answer', async () => {
  const lookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }]);
  const wire = transport([{ body: 'not contacted' }]);
  await expect(createPublicFeedFetcher({ lookup, request: wire.request })(FEEDS[0].url)).rejects.toThrow();
  expect(wire.request).not.toHaveBeenCalled();
});
it.each(['193.32.204.199', '::ffff:c120:ccc7'])('rejects excluded DNS answer %s after a public answer before connecting', async address => {
  const lookup = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address, family: address.includes(':') ? 6 : 4 }]);
  const wire = transport([{ body: 'not contacted' }]);
  await expect(createPublicFeedFetcher({ lookup, request: wire.request })(FEEDS[0].url)).rejects.toThrow('Invalid destination');
  expect(wire.request).not.toHaveBeenCalled();
});

it('rejects a www-to-apex redirect before a second DNS lookup or connection', async () => {
  const lookup = vi.fn(publicDNS);
  const wire = transport([{ status: 302, headers: { location: 'https://defensenews.com/redirected.xml' } }, { body: 'not contacted' }]);
  await expect(createPublicFeedFetcher({ lookup, request: wire.request })(FEEDS[0].url)).rejects.toThrow('Invalid destination');
  expect(lookup).toHaveBeenCalledExactlyOnceWith('www.defensenews.com', { all: true, verbatim: true });
  expect(wire.request).toHaveBeenCalledTimes(1);
});
it('rejects an apex-to-www redirect before a second DNS lookup or connection', async () => {
  const input = FEEDS.find(feed => feed.id === 'breaking-defense').url;
  const lookup = vi.fn(publicDNS);
  const wire = transport([{ status: 302, headers: { location: 'https://www.breakingdefense.com/feed/' } }, { body: 'not contacted' }]);
  await expect(createPublicFeedFetcher({ lookup, request: wire.request })(input)).rejects.toThrow('Invalid destination');
  expect(lookup).toHaveBeenCalledExactlyOnceWith('breakingdefense.com', { all: true, verbatim: true });
  expect(wire.request).toHaveBeenCalledTimes(1);
});
it.each(['/redirected.xml', 'https://www.defensenews.com/redirected.xml', 'https://WWW.DefenseNews.COM/redirected.xml'])('follows normalized same-host redirect %s after rechecking DNS', async location => {
  const lookup = vi.fn(publicDNS);
  const wire = transport([{ status: 302, headers: { location } }, { body: '<rss><channel/></rss>' }]);
  expect(await createPublicFeedFetcher({ lookup, request: wire.request })(FEEDS[0].url)).toBe('<rss><channel/></rss>');
  expect(wire.requests.map(req => req.url)).toEqual([FEEDS[0].url, 'https://www.defensenews.com/redirected.xml']);
  expect(lookup.mock.calls).toEqual(Array.from({ length: 2 }, () => ['www.defensenews.com', { all: true, verbatim: true }]));
  for (const { options } of wire.requests) {
    expect(options).toMatchObject({ agent: false, servername: 'www.defensenews.com', rejectUnauthorized: true });
  }
});
it('rejects a changed host after multiple same-host redirect hops before its DNS lookup or connection', async () => {
  const lookup = vi.fn(publicDNS);
  const wire = transport([
    { status: 302, headers: { location: '/hop1' } },
    { status: 307, headers: { location: 'https://WWW.DefenseNews.COM/hop2' } },
    { status: 308, headers: { location: 'https://defensenews.com/forbidden' } },
    { body: 'not contacted' },
  ]);
  await expect(createPublicFeedFetcher({ lookup, request: wire.request })(FEEDS[0].url)).rejects.toThrow('Invalid destination');
  expect(lookup.mock.calls).toEqual(Array.from({ length: 3 }, () => ['www.defensenews.com', { all: true, verbatim: true }]));
  expect(wire.request).toHaveBeenCalledTimes(3);
});
it.each([
  'https://127.0.0.1/feed', 'https://[::ffff:127.0.0.1]/feed', 'https://193.32.204.199/feed',
  'https://localhost/feed', 'https://metadata.google.internal/feed', 'https://attacker.invalid/feed',
  'https://www.defensenews.com.attacker.invalid/feed', 'http://www.defensenews.com/feed',
  'https://feeds.www.defensenews.com/feed', 'https://feeds.defensenews.com/feed',
  'https://user:pass@www.defensenews.com/feed', 'https://www.defensenews.com:8443/feed',
  'https://www.defensenews.com/feed#fragment',
])('blocks redirect %s before DNS or a second connect', async location => {
  const lookup = vi.fn(publicDNS);
  const wire = transport([{ status: 302, headers: { location } }, { body: 'not contacted' }]);
  await expect(createPublicFeedFetcher({ lookup, request: wire.request })(FEEDS[0].url)).rejects.toThrow();
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(wire.request).toHaveBeenCalledTimes(1);
});
it('rejects DNS rebinding on a relative same-host redirect', async () => {
  const lookup = vi.fn().mockImplementationOnce(publicDNS).mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
  const wire = transport([{ status: 302, headers: { location: '/rebind' } }, { body: 'not contacted' }]);
  await expect(createPublicFeedFetcher({ lookup, request: wire.request })(FEEDS[0].url)).rejects.toThrow();
  expect(lookup).toHaveBeenCalledTimes(2);
  expect(wire.request).toHaveBeenCalledTimes(1);
});
it('limits the chain to four redirects and closes each redirect response without reading its body', async () => {
  const wire = transport(Array.from({ length: 6 }, (_, n) => ({ status: 302, headers: { location: `/hop${n}` }, body: 'ignored'.repeat(100) })));
  await expect(createPublicFeedFetcher({ lookup: publicDNS, request: wire.request })(FEEDS[0].url)).rejects.toThrow();
  expect(wire.request).toHaveBeenCalledTimes(5);
});
it('accepts a successful response after exactly four same-host redirects', async () => {
  const lookup = vi.fn(publicDNS);
  const wire = transport([
    ...Array.from({ length: 4 }, (_, n) => ({ status: 302, headers: { location: `/hop${n}` } })),
    { body: '<rss><channel/></rss>' },
  ]);
  expect(await createPublicFeedFetcher({ lookup, request: wire.request })(FEEDS[0].url)).toBe('<rss><channel/></rss>');
  expect(lookup).toHaveBeenCalledTimes(5);
  expect(wire.request).toHaveBeenCalledTimes(5);
});
it.each([301, 302, 303, 307, 308])('supports HTTP redirect status %s', async status => {
  const wire = transport([{ status, headers: { location: '/redirect.xml' } }, {}]);
  expect(await createPublicFeedFetcher({ lookup: publicDNS, request: wire.request })(FEEDS[0].url)).toBe('<rss><channel/></rss>');
  expect(wire.request).toHaveBeenCalledTimes(2);
});
it.each([204, 304, 403, 429, 500])('rejects upstream status %s', async status => {
  const wire = transport([{ status, body: 'upstream rejection' }]);
  await expect(createPublicFeedFetcher({ lookup: publicDNS, request: wire.request })(FEEDS[0].url)).rejects.toThrow();
});

afterEach(() => vi.useRealTimers());

it('a single six-second deadline includes DNS and cannot connect after late resolution', async () => {
  vi.useFakeTimers();
  let completeDNS;
  const lookup = vi.fn(() => new Promise(resolve => { completeDNS = resolve; }));
  const wire = transport([{}]);
  const promise = createPublicFeedFetcher({ lookup, request: wire.request })(FEEDS[0].url);
  const rejected = expect(promise).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(6001);
  await rejected;
  completeDNS([{ address: '93.184.216.34', family: 4 }]);
  await Promise.resolve();
  expect(wire.request).not.toHaveBeenCalled();
});
it('shares one six-second deadline across multiple same-host redirect hops', async () => {
  vi.useFakeTimers();
  const lookup = vi.fn(() => new Promise(resolve => { setTimeout(() => resolve([{ address: '93.184.216.34', family: 4 }]), 1800); }));
  const wire = transport([
    ...Array.from({ length: 3 }, (_, n) => ({ status: 302, headers: { location: `/hop${n}` } })),
    { body: 'not contacted' },
  ]);
  const promise = createPublicFeedFetcher({ lookup, request: wire.request })(FEEDS[0].url);
  const settled = vi.fn();
  promise.then(settled, settled);
  const rejected = expect(promise).rejects.toThrow('Fetch deadline');
  await vi.advanceTimersByTimeAsync(5999);
  expect(settled).not.toHaveBeenCalled();
  expect(lookup).toHaveBeenCalledTimes(4);
  expect(wire.request).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(1);
  await rejected;
  expect(wire.requests[2].req.destroy).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'Fetch deadline' }));
  await vi.advanceTimersByTimeAsync(1200);
  expect(wire.request).toHaveBeenCalledTimes(3);
  expect(lookup).toHaveBeenCalledTimes(4);
});
it('deadline destroys a stalled HTTPS request instead of waiting for socket inactivity', async () => {
  vi.useFakeTimers();
  const req = new EventEmitter();
  req.end = vi.fn();
  req.destroy = vi.fn(error => req.emit('error', error));
  const promise = createPublicFeedFetcher({ lookup: publicDNS, request: () => req })(FEEDS[0].url);
  const rejected = expect(promise).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(6001);
  await rejected;
  expect(req.destroy).toHaveBeenCalledTimes(1);
});
it('deadline includes a stalled response body and destroys that response', async () => {
  vi.useFakeTimers();
  const res = new Readable({ read() {} });
  res.statusCode = 200;
  res.headers = {};
  const destroy = vi.spyOn(res, 'destroy');
  const req = new EventEmitter();
  req.end = () => callback(res);
  req.destroy = vi.fn(error => req.emit('error', error));
  let callback;
  const promise = createPublicFeedFetcher({ lookup: publicDNS, request: (_url, _options, cb) => { callback = cb; return req; } })(FEEDS[0].url);
  const rejected = expect(promise).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(6001);
  await rejected;
  expect(destroy).toHaveBeenCalled();
});
it.each([
  { headers: { 'content-length': '2000001' }, body: 'tiny' },
  { chunks: [Buffer.alloc(1_000_000), Buffer.alloc(1_000_001)] },
  { headers: { 'content-encoding': 'gzip' }, body: 'compressed bytes' },
])('rejects excessive or compressed response bodies before parsing', async reply => {
  const wire = transport([reply]);
  await expect(createPublicFeedFetcher({ lookup: publicDNS, request: wire.request })(FEEDS[0].url)).rejects.toThrow();
});
it('accepts exactly two million UTF-8 bytes, not two million characters', async () => {
  const wire = transport([{ chunks: [Buffer.alloc(2_000_000, 'x')] }]);
  expect((await createPublicFeedFetcher({ lookup: publicDNS, request: wire.request })(FEEDS[0].url)).length).toBe(2_000_000);
});

it('fetches the registry HTTPS URL using the resolved address and original TLS hostname', async () => {
  const lookup = vi.fn(publicDNS);
  const wire = transport([{ body: '<rss><channel/></rss>' }]);
  const fetchFeed = createPublicFeedFetcher({ lookup, request: wire.request });
  expect(await fetchFeed(FEEDS[0].url)).toBe('<rss><channel/></rss>');
  expect(lookup).toHaveBeenCalledExactlyOnceWith('www.defensenews.com', { all: true, verbatim: true });
  expect(wire.requests[0].url).toBe(FEEDS[0].url);
  expect(wire.requests[0].options).toMatchObject({ method: 'GET', agent: false, servername: 'www.defensenews.com', rejectUnauthorized: true });
  const callback = vi.fn();
  wire.requests[0].options.lookup('www.defensenews.com', {}, callback);
  expect(callback).toHaveBeenCalledExactlyOnceWith(null, '93.184.216.34', 4);
  const allCallback = vi.fn();
  wire.requests[0].options.lookup('www.defensenews.com', { all: true }, allCallback);
  expect(allCallback).toHaveBeenCalledExactlyOnceWith(null, [{ address: '93.184.216.34', family: 4 }]);
});
it('pins a public IPv6 DNS answer while retaining the registry TLS hostname', async () => {
  const address = { address: '2606:4700:4700::1111', family: 6 };
  const lookup = vi.fn().mockResolvedValue([address, { address: '93.184.216.34', family: 4 }]);
  const wire = transport([{ body: '<rss><channel/></rss>' }]);
  expect(await createPublicFeedFetcher({ lookup, request: wire.request })(FEEDS[0].url)).toBe('<rss><channel/></rss>');
  expect(lookup).toHaveBeenCalledExactlyOnceWith('www.defensenews.com', { all: true, verbatim: true });
  expect(wire.requests[0].options).toMatchObject({ agent: false, servername: 'www.defensenews.com', rejectUnauthorized: true });
  const callback = vi.fn();
  wire.requests[0].options.lookup('www.defensenews.com', {}, callback);
  expect(callback).toHaveBeenCalledExactlyOnceWith(null, address.address, address.family);
  const allCallback = vi.fn();
  wire.requests[0].options.lookup('www.defensenews.com', { all: true }, allCallback);
  expect(allCallback).toHaveBeenCalledExactlyOnceWith(null, [address]);
});
