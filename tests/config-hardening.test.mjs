import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';

const root = resolve(import.meta.dirname, '..');
const lint = new ESLint({ cwd: root });

test('browser code cannot silently use Node globals', async () => {
  const [result] = await lint.lintText('process.exit(0);', { filePath: 'src/runtime-probe.js' });
  assert.ok(result.messages.some(message => message.ruleId === 'no-undef' && message.message.includes('process')));
});

test('server code cannot silently use browser globals', async () => {
  const [result] = await lint.lintText('window.alert("test");', { filePath: 'server/runtime-probe.js' });
  assert.ok(result.messages.some(message => message.ruleId === 'no-undef' && message.message.includes('window')));
});

test('intended globals remain available in their runtimes', async () => {
  for (const [filePath, code] of [['src/runtime-probe.js', 'window.alert("test");'], ['server/runtime-probe.js', 'process.exit(0);']]) {
    const [result] = await lint.lintText(code, { filePath });
    assert.equal(result.errorCount, 0);
  }
});

test('production CSP permits only supported news transport origins', () => {
  const config = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
  const policy = config.headers.flatMap(entry => entry.headers).find(header => header.key === 'Content-Security-Policy').value;
  const connect = policy.split(';').map(value => value.trim()).find(value => value.startsWith('connect-src ')).split(/\s+/).slice(1);
  assert.deepEqual(connect, ["'self'", 'https://api.rss2json.com', 'https://newsapi.org', 'https://api.thenewsapi.com']);
});

test('article share routes reach a bounded server function before the SPA', () => {
  const config = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
  assert.equal(config.functions['api/article.js']?.maxDuration, 10);
  const route = config.rewrites?.find(rule => rule.source.includes('[A-Za-z0-9_-]'));
  assert.ok(route, 'a first-party article route must reach server-rendered metadata');
  assert.equal(route.source, '/article/:feed([a-z0-9-]{1,100})/:article([A-Za-z0-9_-]{1,2800})');
  assert.equal(route.destination, '/api/article?feed=:feed&article=:article');
  const readable = config.rewrites?.find(rule => rule.source.includes('~'));
  assert.ok(readable, 'readable tokens must reach the metadata function');
  assert.equal(readable.source, '/article/:feed([a-z0-9-]{1,100})/:article([a-z0-9][a-z0-9-]{0,59}~[a-f0-9]{16})');
  assert.equal(readable.destination, '/api/article?feed=:feed&article=:article');
  const regex = new RegExp(`^/article/[a-z0-9-]{1,100}/([a-z0-9][a-z0-9-]{0,59}~[a-f0-9]{16})$`);
  assert.ok(regex.test('/article/indomiliter/eks-pesawat-vvip-turki~0123456789abcdef'));
  for (const bad of ['word~0123456789ABCDEF', `${'x'.repeat(61)}~0123456789abcdef`, 'word%7E0123456789abcdef', 'word~0123456789abcdef/']) assert.ok(!regex.test(`/article/indomiliter/${bad}`));
});
