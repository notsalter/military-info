import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { FEEDS } from '../src/services/feeds.js';
import { isPublicAddress } from './publicAddress.js';

const registryURLs = new Set(FEEDS.map(feed => feed.url));
const MAX_BYTES = 2_000_000;

export function createPublicFeedFetcher({ lookup = dnsLookup, request = httpsRequest } = {}) {
  return async input => {
    if (!registryURLs.has(input)) throw new Error('Invalid destination');
    const initial = new URL(input);
    let expired = false;
    let activeRequest;
    let activeResponse;
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        const error = new Error('Fetch deadline');
        activeResponse?.destroy();
        activeRequest?.destroy(error);
        reject(error);
      }, 6000);
    });
    const visit = async (url, redirects) => {
      if (expired) throw new Error('Fetch deadline');
      if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || isIP(url.hostname.replace(/^\[|\]$/g, '')) || url.hostname !== initial.hostname) throw new Error('Invalid destination');
      const addresses = await lookup(url.hostname, { all: true, verbatim: true });
      if (expired) throw new Error('Fetch deadline');
      if (!addresses.length || addresses.some(record => !isPublicAddress(record.address))) throw new Error('Invalid destination');
      const address = addresses[0];
      return new Promise((resolve, reject) => {
        const req = request(url, {
          method: 'GET', agent: false, servername: url.hostname, rejectUnauthorized: true,
          // Modern Node may request an address array for family auto-selection.
          lookup: (_host, options, callback) => options.all ? callback(null, [address]) : callback(null, address.address, address.family),
          headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'Accept-Encoding': 'identity', 'User-Agent': 'MilitaryInfo-RSS/1.0' },
        }, async res => {
          activeResponse = res;
          try {
            if (expired) throw new Error('Fetch deadline');
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
              res.destroy();
              if (redirects >= 4 || typeof res.headers.location !== 'string') throw new Error('Invalid redirect');
              resolve(visit(new URL(res.headers.location, url), redirects + 1));
              return;
            }
            if (res.statusCode !== 200) throw new Error('Upstream unavailable');
            if (Number(res.headers['content-length']) > MAX_BYTES || (res.headers['content-encoding'] && res.headers['content-encoding'].toLowerCase() !== 'identity')) throw new Error('Invalid body');
            const chunks = [];
            let bytes = 0;
            for await (const chunk of res) {
              const buffer = Buffer.from(chunk);
              bytes += buffer.length;
              if (bytes > MAX_BYTES || expired) throw new Error('Invalid body');
              chunks.push(buffer);
            }
            resolve(Buffer.concat(chunks, bytes).toString('utf8'));
          } catch (error) {
            res.destroy();
            reject(error);
          }
        });
        activeRequest = req;
        req.on('error', reject);
        req.end();
      });
    };
    try {
      return await Promise.race([visit(initial, 0), deadline]);
    } finally {
      clearTimeout(timer);
    }
  };
}
