// @vitest-environment node
import { expect, it } from 'vitest';
import { parseFeed } from './parseFeed.js';
import { normalizeArticle, selectArticles } from '../src/services/articleUtils.js';

const feed = { id: 'test-feed', name: 'Test Feed', url: 'https://example.org/feed.xml' };
const formats = ['RSS', 'RSS1', 'Atom'];
function document(format, title, description) {
  if (format === 'Atom') return `<feed xmlns="http://www.w3.org/2005/Atom"><entry>
    <title type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">${title}</div></title>
    <link rel="self" href="/metadata"/><link rel="alternate" href="/story"/>
    <summary type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">${description}</div></summary>
    <updated>2026-11-17T01:00:00Z</updated>
  </entry></feed>`;
  const item = `<item><title>${title}</title><link>/story</link><description>${description}</description><pubDate>17 Nov 2026 01:00:00 GMT</pubDate></item>`;
  return format === 'RSS' ? `<rss><channel>${item}</channel></rss>` : `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/"><channel/><item-list/>${item}</rdf:RDF>`;
}

it.each(formats.flatMap(format => ['12:00:99', '12:00:60', '24:00:00', '12:60:00', '24:00', '12:60'].map(clock => [format, clock])))('%s keeps invalid RFC publication clock %s null through parsing and repeated selection', (format, clock) => {
  for (const zone of ['GMT', 'UTC', '+0530', '-0530']) {
    const xml = document(format, 'Army update', 'Public summary.').replace(
      format === 'Atom' ? '2026-11-17T01:00:00Z' : '17 Nov 2026 01:00:00 GMT', `Sat, 14 Nov 2026 ${clock} ${zone}`,
    );
    const articles = parseFeed(xml, feed);
    expect(articles).toHaveLength(1);
    expect.soft(articles[0].publishedAt).toBeNull();
    const normalized = articles.map(article => normalizeArticle(normalizeArticle(article)));
    expect.soft(normalized[0].publishedAt).toBeNull();
    const selected = selectArticles(selectArticles(normalized));
    expect.soft(selected).toHaveLength(1);
    expect.soft(selected[0]).toEqual(articles[0]);
    expect.soft(selected[0].publishedAt).toBeNull();
  }
});

it.each(formats)('%s preserves publication date boundaries through repeated normalization and selection', format => {
  for (const [publishedAt, expected] of [
    ['Sat, 14 Nov 2026 00:00:00 GMT', '2026-11-14T00:00:00.000Z'],
    ['Sat, 14 Nov 2026 23:59:59 UTC', '2026-11-14T23:59:59.000Z'],
    ['Sat, 14 Nov 2026 23:59:59 +0530', '2026-11-14T18:29:59.000Z'],
    ['Sat, 14 Nov 2026 23:59:59 -0530', '2026-11-15T05:29:59.000Z'],
    ['2026-11-14T23:59:59.999Z', '2026-11-14T23:59:59.999Z'],
    ['2026-11-14 23:59:59', '2026-11-14T23:59:59.000Z'],
    ['2026-11-14', '2026-11-14T00:00:00.000Z'],
    ['2026-11-14T24:00:00Z', null],
    ['2026-11-14 24:00', null],
    ['2026-11-14T12:60:00+05:30', null],
    ['2026-11-14T12:00:60-0530', null],
  ]) {
    const xml = document(format, 'Army update', 'Public summary.').replace(
      format === 'Atom' ? '2026-11-17T01:00:00Z' : '17 Nov 2026 01:00:00 GMT', publishedAt,
    );
    const articles = parseFeed(xml, feed);
    expect(articles).toHaveLength(1);
    expect(articles[0].publishedAt, publishedAt).toBe(expected);
    const normalized = normalizeArticle(normalizeArticle(articles[0]));
    expect(normalized).toEqual(articles[0]);
    expect(selectArticles(selectArticles([normalized]))).toEqual(articles);
  }
});

it('preserves the reported XHTML summary sentence in document order', () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry>
    <title>Army update</title><link href="/story"/>
    <summary type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml">Army <strong>denies</strong> retreat reports.</div></summary>
  </entry></feed>`;

  expect(parseFeed(xml, feed)[0].description).toBe('Army denies retreat reports.');
});

it.each(formats)('%s preserves the exact mixed-markup title sentence', format => {
  const xml = document(format, 'Army <strong>denies</strong> retreat reports.', 'Public summary.');
  expect(parseFeed(xml, feed)[0].title).toBe('Army denies retreat reports.');
});

it.each(formats)('%s preserves nested and repeated inline markup in titles and snippets', format => {
  const title = 'Army <strong>denies <em>retreat</em></strong> reports.';
  const description = 'First <em>one</em>, then <strong>two</strong>, finally <em>three</em>.';
  expect(parseFeed(document(format, title, description), feed)).toEqual([{
    id: 'https://example.org/story', title: 'Army denies retreat reports.',
    description: 'First one, then two, finally three.', url: 'https://example.org/story',
    urlToImage: null, publishedAt: '2026-11-17T01:00:00.000Z', source: { id: feed.id, name: feed.name },
  }]);
});

it.each(formats)('%s separates block elements without losing inline punctuation or entities', format => {
  const title = 'Army &amp; <strong>Navy</strong>: &#x41;&#32;report.';
  const description = '<p>Army <strong>denies</strong> reports.</p><p>Navy &amp; allies<br/>respond&#32;today.</p><ul><li>First</li><li>Second</li></ul>';
  const article = parseFeed(document(format, title, description), feed)[0];
  expect(article.title).toBe('Army & Navy: A report.');
  expect(article.description).toBe('Army denies reports. Navy & allies respond today. First Second');
});

it.each(formats)('%s excludes actual script/style subtrees from titles and snippets', format => {
  const title = 'Army <span><script>fake title</script><style>fake title style</style></span>update';
  const description = 'Army update <span><script><strong>fake report</strong></script><style>fake style</style></span>Real report';
  const article = parseFeed(document(format, title, description), feed)[0];

  expect.soft(article.title).toBe('Army update');
  expect.soft(article.description).toBe('Army update Real report');
});

it.each(formats)('%s preserves decoded numeric comparisons through normalization and selection', format => {
  const sentence = 'Army <10 troops >5 vehicles report.';
  const xml = document(format, 'Army &lt;10 troops &gt;5 vehicles <strong>report</strong>.', 'Army &lt;10 troops &gt;5 vehicles <strong>report</strong>.');
  const article = parseFeed(xml, feed)[0];
  for (const candidate of [article, normalizeArticle(article), ...selectArticles([article]), ...selectArticles([normalizeArticle(article)])]) {
    expect.soft(candidate.title).toBe(sentence);
    expect.soft(candidate.description).toBe(sentence);
  }
});

it.each(formats.flatMap(format => ['script', 'style'].map(tag => [format, tag])))('%s suppresses CDATA %s bodies with closing-tag whitespace before choosing fallback', (format, tag) => {
  const title = `<![CDATA[Army <${tag}>secret</${tag} > update]]>`;
  const summary = `<![CDATA[<${tag}>secret</${tag} >]]>`;
  const xml = document(format, title, summary).replace(
    format === 'Atom' ? '</entry>' : '</item>',
    format === 'Atom' ? '<content>Public fallback</content></entry>' : '<content>Public fallback</content></item>',
  );
  const article = parseFeed(xml, feed)[0];
  expect.soft(article.title).toBe('Army update');
  expect.soft(article.description).toBe('Public fallback');
  expect.soft(normalizeArticle(article)).toEqual(article);
  expect.soft(selectArticles([article])).toEqual([article]);
});

it.each(formats)('%s retains CDATA HTML and entity decoding', format => {
  const title = '<![CDATA[Army &amp; <strong>Navy</strong> update]]>';
  const description = '<![CDATA[<p>First &amp; next.</p><p>Then &#x41;&nbsp;last.</p>]]>';
  const article = parseFeed(document(format, title, description), feed)[0];
  expect(article.title).toBe('Army & Navy update');
  expect(article.description).toBe('First & next. Then A last.');
});

it.each([
  ['RSS content:encoded', '<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><title>Army update</title><link>/story</link><content:encoded><p>Army <strong>denies</strong> retreat reports.</p><p>Next update.</p></content:encoded></item></channel></rss>'],
  ['RSS1 content:encoded', '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:content="http://purl.org/rss/1.0/modules/content/"><item><title>Army update</title><link>/story</link><content:encoded><p>Army <strong>denies</strong> retreat reports.</p><p>Next update.</p></content:encoded></item></rdf:RDF>'],
  ['Atom content', '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Army update</title><link href="/story"/><content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Army <strong>denies</strong> retreat reports.</p><p>Next update.</p></div></content></entry></feed>'],
])('%s fallback is an ordered plain-text snippet, not a content field', (_format, xml) => {
  const article = parseFeed(xml, feed)[0];
  expect(article.description).toBe('Army denies retreat reports. Next update.');
  expect(Object.keys(article).sort()).toEqual(['description', 'id', 'publishedAt', 'source', 'title', 'url', 'urlToImage']);
});

it.each([
  ['Atom empty summary', '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Army update</title><link href="/story"/><summary/><content>Army denies reports.</content></entry></feed>'],
  ['Atom whitespace summary', '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Army update</title><link href="/story"/><summary> \n\t </summary><content>Army denies reports.</content></entry></feed>'],
  ['Atom empty XHTML summary', '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Army update</title><link href="/story"/><summary type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p> </p></div></summary><content>Army denies reports.</content></entry></feed>'],
  ['Atom script/style-only summary', '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Army update</title><link href="/story"/><summary type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><script>fake</script><style>fake</style></div></summary><content>Army denies reports.</content></entry></feed>'],
  ['Atom normalized-empty HTML summary', '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Army update</title><link href="/story"/><summary type="html"><![CDATA[<p>&nbsp;</p><script>fake</script>]]></summary><content>Army denies reports.</content></entry></feed>'],
  ['RSS empty description', '<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><title>Army update</title><link>/story</link><description/><content:encoded>Army denies reports.</content:encoded></item></channel></rss>'],
  ['RSS whitespace description', '<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><title>Army update</title><link>/story</link><description> \n\t </description><content:encoded>Army denies reports.</content:encoded></item></channel></rss>'],
  ['RSS1 empty description', '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:content="http://purl.org/rss/1.0/modules/content/"><item><title>Army update</title><link>/story</link><description/><content:encoded>Army denies reports.</content:encoded></item></rdf:RDF>'],
])('%s falls back to nonempty content', (_format, xml) => {
  expect(parseFeed(xml, feed)[0].description).toBe('Army denies reports.');
});

it.each([
  ['description', '<description>Chosen description.</description><summary>Other summary.</summary><content:encoded>Other encoded.</content:encoded><content>Other content.</content>', 'Chosen description.'],
  ['summary after empty description', '<description/><summary>Chosen summary.</summary><content:encoded>Other encoded.</content:encoded><content>Other content.</content>', 'Chosen summary.'],
  ['encoded after empty summary', '<description/><summary> </summary><content:encoded>Chosen encoded.</content:encoded><content>Other content.</content>', 'Chosen encoded.'],
  ['content after empty encoded', '<description/><summary> </summary><content:encoded/><content>Chosen content.</content>', 'Chosen content.'],
  ['all empty', '<description/><summary> </summary><content:encoded/><content/>', ''],
])('preserves first nonempty snippet priority: %s', (_case, fields, expected) => {
  const xml = `<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item>
    <title>Army update</title><link>/story</link>${fields}
  </item></channel></rss>`;

  expect(parseFeed(xml, feed)[0].description).toBe(expected);
});

it('normalizes selected fallback text only once', () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry>
    <title>Army update</title><link href="/story"/><summary/>
    <content><![CDATA[Army &amp;amp; Navy update]]></content>
  </entry></feed>`;

  expect(parseFeed(xml, feed)[0].description).toBe('Army &amp; Navy update');
});

it('resolves Atom relative links against the root xml:base', () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://example.org/articles/"><entry>
    <title>Army update</title><link href="story"/>
  </entry></feed>`;

  expect(parseFeed(xml, { ...feed, url: 'https://example.org/feed/index.xml' })[0].url).toBe('https://example.org/articles/story');
});

it.each([
  ['updates/', 'https://example.org/articles/updates/story'],
  ['https://news.example.org/reports/', 'https://news.example.org/reports/story'],
])('resolves Atom entry xml:base %s against its inherited base', (base, expected) => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://example.org/articles/"><entry xml:base="${base}">
    <title>Army update</title><link href="story"/>
  </entry></feed>`;

  expect(parseFeed(xml, feed)[0].url).toBe(expected);
});

it.each([
  ['../links/', 'https://example.org/articles/links/story'],
  ['https://news.example.org/links/', 'https://news.example.org/links/story'],
])('resolves Atom link xml:base %s against its inherited base', (base, expected) => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://example.org/articles/"><entry xml:base="updates/">
    <title>Army update</title><link rel="self" xml:base="https://metadata.example.org/" href="self"/>
    <link rel="alternate" xml:base="${base}" href="story"/>
  </entry></feed>`;

  expect(parseFeed(xml, feed)[0].url).toBe(expected);
});

it.each(['root', 'entry', 'link'])('inherits the parent base when Atom %s xml:base is empty', level => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom" xml:base="${level === 'root' ? '' : 'https://example.org/articles/'}">
    <entry${level === 'entry' ? ' xml:base=""' : ''}>
      <title>Army update</title><link${level === 'link' ? ' xml:base=""' : ''} href="story"/>
    </entry>
  </feed>`;

  expect(parseFeed(xml, feed).map(article => article.url)).toEqual([
    level === 'root' ? 'https://example.org/story' : 'https://example.org/articles/story',
  ]);
});

it.each(['root', 'entry', 'link'].flatMap(level => [
  'ftp://example.org/articles/', 'javascript:fake', 'https://user:secret@example.org/articles/', 'http://[invalid',
].map(base => [level, base])))('does not rebase relative Atom links onto the feed after unsafe %s xml:base %s', (level, base) => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom" xml:base="${level === 'root' ? base : 'https://example.org/articles/'}">
    <entry${level === 'entry' ? ` xml:base="${base}"` : ''}>
      <title>Army update</title><link${level === 'link' ? ` xml:base="${base}"` : ''} href="story"/>
    </entry>
  </feed>`;

  expect(parseFeed(xml, feed)).toEqual([]);
});

it.each(['ftp://example.org/story', 'javascript:fake', 'https://user:secret@example.org/story'])('rejects unsafe final Atom href %s despite a safe xml:base', href => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://example.org/articles/"><entry>
    <title>Army update</title><link href="${href}"/>
  </entry></feed>`;

  expect(parseFeed(xml, feed)).toEqual([]);
});

it('accepts a safe absolute Atom link independently of an unsafe inherited base', () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom" xml:base="ftp://example.org/articles/"><entry>
    <title>Army update</title><link href="https://news.example.org/story#section"/>
  </entry></feed>`;

  expect(parseFeed(xml, feed).map(article => article.url)).toEqual(['https://news.example.org/story']);
});

it('keeps the article and snippet caps, safe links, deduplication, and summary precedence', () => {
  const item = index => `<item><title>Army <strong>update</strong> ${index}</title><link>/story/${index}#section</link><description><p>Army <strong>denies</strong> retreat reports.</p><p>${'x'.repeat(300)}</p></description><content:encoded>Full article is not a summary.</content:encoded></item>`;
  const xml = `<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
    <item><title>Unsupported link</title><link>ftp://example.org/story</link></item>
    ${item(0)}${Array.from({ length: 15 }, (_, index) => item(index)).join('')}
  </channel></rss>`;
  const articles = parseFeed(xml, feed);
  expect(articles).toHaveLength(10);
  expect(articles.map(article => article.url)).toEqual(Array.from({ length: 10 }, (_, index) => `https://example.org/story/${index}`));
  for (const [index, article] of articles.entries()) {
    expect(article.title).toBe(`Army update ${index}`);
    expect(article.description).toBe(`Army denies retreat reports. ${'x'.repeat(218)}...`);
    expect(article.description).toHaveLength(250);
    expect(Object.keys(article).sort()).toEqual(['description', 'id', 'publishedAt', 'source', 'title', 'url', 'urlToImage']);
  }
});
