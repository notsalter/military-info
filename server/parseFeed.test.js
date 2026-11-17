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

it('TEST FIXTURE restores the reported qualified Atom href', () => {
  const xml = '<a:feed xmlns:a="http://www.w3.org/2005/Atom"><a:entry><a:title>TEST FIXTURE Army</a:title><a:link a:href="https://www.defensenews.com/test-fixture/correct"/></a:entry></a:feed>';
  expect(parseFeed(xml, feed).map(article => article.url)).toEqual(['https://www.defensenews.com/test-fixture/correct']);
});

it('TEST FIXTURE skips the reported qualified Atom self relation', () => {
  const xml = '<a:feed xmlns:a="http://www.w3.org/2005/Atom"><a:entry><a:title>TEST FIXTURE Army</a:title><a:link a:rel="self" href="https://www.defensenews.com/test-fixture/metadata"/><a:link rel="alternate" href="https://www.defensenews.com/test-fixture/correct"/></a:entry></a:feed>';
  expect(parseFeed(xml, feed).map(article => article.url)).toEqual(['https://www.defensenews.com/test-fixture/correct']);
});

it.each(['base', 'a:base'])('TEST FIXTURE restores Atom root %s compatibility without rebasing images', attribute => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" xmlns:m="http://search.yahoo.com/mrss/" ${attribute}="https://www.defensenews.com/test-fixture/"><a:entry>
    <a:title>TEST FIXTURE Army</a:title><a:link href="correct"/><m:thumbnail url="photo.jpg"/>
  </a:entry></a:feed>`;
  expect(parseFeed(xml, feed)).toMatchObject([{
    url: 'https://www.defensenews.com/test-fixture/correct', urlToImage: 'https://example.org/photo.jpg',
  }]);
});

it.each(['base', 'a:base'])('TEST FIXTURE restores Atom entry %s compatibility against its inherited XML base', attribute => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" xmlns:m="http://search.yahoo.com/mrss/" xml:base="https://www.defensenews.com/test-fixture/"><a:entry ${attribute}="articles/">
    <a:title>TEST FIXTURE Army</a:title><a:link a:href="correct"/><m:thumbnail url="photo.jpg"/>
  </a:entry></a:feed>`;
  expect(parseFeed(xml, feed)).toMatchObject([{
    url: 'https://www.defensenews.com/test-fixture/articles/correct', urlToImage: 'https://www.defensenews.com/test-fixture/photo.jpg',
  }]);
});

it.each(['base', 'a:base'])('TEST FIXTURE restores Atom link %s compatibility against its inherited XML base', attribute => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" xmlns:m="http://search.yahoo.com/mrss/" xml:base="https://www.defensenews.com/test-fixture/"><a:entry xml:base="articles/">
    <a:title>TEST FIXTURE Army</a:title><a:link a:rel="self" ${attribute}="https://metadata.example.org/" href="metadata"/>
    <a:link a:rel="alternate" ${attribute}="../" a:href="correct"/><m:thumbnail url="photo.jpg"/>
  </a:entry></a:feed>`;
  expect(parseFeed(xml, feed)).toMatchObject([{
    url: 'https://www.defensenews.com/test-fixture/correct', urlToImage: 'https://www.defensenews.com/test-fixture/articles/photo.jpg',
  }]);
});

it.each([
  ['href before qualified href', 'href="/metadata" a:href="/correct"', '/correct'],
  ['qualified href before href', 'a:href="/metadata" href="/correct"', '/correct'],
  ['different qualified hrefs', 'a:href="/metadata" other:href="/correct"', '/correct'],
])('TEST FIXTURE retains baseline last-attribute priority for %s', (_case, attributes, path) => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" xmlns:other="https://other.example.org/"><a:entry>
    <a:title>TEST FIXTURE Army</a:title><a:link ${attributes}/>
  </a:entry></a:feed>`;
  expect(parseFeed(xml, feed).map(article => article.url)).toEqual([`https://example.org${path}`]);
});

it.each([
  ['qualified alternate', 'a:rel="alternate"', 'correct'],
  ['empty qualified relation', 'a:rel=""', 'correct'],
  ['foreign-qualified alternate', 'other:rel="alternate"', 'correct'],
  ['plain self then qualified alternate', 'rel="self" a:rel="alternate"', 'correct'],
  ['qualified self then plain alternate', 'a:rel="self" rel="alternate"', 'correct'],
  ['plain alternate then qualified self', 'rel="alternate" a:rel="self"', 'fallback'],
  ['qualified alternate then plain self', 'a:rel="alternate" rel="self"', 'fallback'],
  ['whitespace-qualified alternate', 'a:rel=" alternate "', 'fallback'],
])('TEST FIXTURE retains baseline link selection for %s', (_case, attributes, path) => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" xmlns:other="https://other.example.org/"><a:entry>
    <a:title>TEST FIXTURE Army</a:title><a:link ${attributes} a:href="/${path === 'fallback' ? 'metadata' : 'correct'}"/>
    <a:link a:href="/fallback"/>
  </a:entry></a:feed>`;
  expect(parseFeed(xml, feed).map(article => article.url)).toEqual([`https://example.org/${path}`]);
});

it.each(['root', 'entry', 'link'].flatMap(level => [
  ['xml:base="/xml/" a:base="/article/"', 'article'],
  ['a:base="/article/" xml:base="/xml/"', 'xml'],
].map(([attributes, path]) => [level, attributes, path])))('TEST FIXTURE retains baseline last-base priority at Atom %s: %s', (level, attributes, path) => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" xmlns:m="http://search.yahoo.com/mrss/" ${level === 'root' ? attributes : ''}>
    <a:entry ${level === 'entry' ? attributes : ''}><a:title>TEST FIXTURE Army</a:title>
      <a:link ${level === 'link' ? attributes : ''} a:href="correct"/><m:thumbnail url="photo.jpg"/>
    </a:entry>
  </a:feed>`;
  expect(parseFeed(xml, feed)).toMatchObject([{
    url: `https://example.org/${path}/correct`, urlToImage: level === 'link' ? 'https://example.org/photo.jpg' : 'https://example.org/xml/photo.jpg',
  }]);
});

it.each(['root', 'entry', 'link'].flatMap(level => [
  'ftp://example.org/articles/', 'javascript:fake', 'https://user:secret@example.org/articles/', 'http://[invalid',
].map(base => [level, base])))('TEST FIXTURE rejects relative links after unsafe qualified Atom %s base %s', (level, base) => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" ${level === 'root' ? `a:base="${base}"` : 'xml:base="https://example.org/articles/"'}>
    <a:entry ${level === 'entry' ? `a:base="${base}"` : ''}><a:title>TEST FIXTURE Army</a:title>
      <a:link ${level === 'link' ? `a:base="${base}"` : ''} a:href="correct"/>
    </a:entry>
  </a:feed>`;
  expect(parseFeed(xml, feed)).toEqual([]);
});

it.each(['root', 'entry', 'link'])('TEST FIXTURE inherits the parent when qualified Atom %s base is empty', level => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" ${level === 'root' ? 'a:base=""' : 'xml:base="https://example.org/articles/"'}>
    <a:entry ${level === 'entry' ? 'a:base=""' : ''}><a:title>TEST FIXTURE Army</a:title>
      <a:link ${level === 'link' ? 'a:base=""' : ''} a:href="correct"/>
    </a:entry>
  </a:feed>`;
  expect(parseFeed(xml, feed).map(article => article.url)).toEqual([
    level === 'root' ? 'https://example.org/correct' : 'https://example.org/articles/correct',
  ]);
});

it.each(['ftp://example.org/story', 'javascript:fake', 'https://user:secret@example.org/story'])('TEST FIXTURE rejects unsafe qualified Atom href %s', href => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" xml:base="https://example.org/articles/"><a:entry>
    <a:title>TEST FIXTURE Army</a:title><a:link a:href="${href}"/>
  </a:entry></a:feed>`;
  expect(parseFeed(xml, feed)).toEqual([]);
});

it('TEST FIXTURE accepts a safe qualified absolute href independently of an unsafe inherited base', () => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" a:base="ftp://example.org/articles/"><a:entry>
    <a:title>TEST FIXTURE Army</a:title><a:link a:href="https://www.defensenews.com/test-fixture/correct#section"/>
  </a:entry></a:feed>`;
  expect(parseFeed(xml, feed).map(article => article.url)).toEqual(['https://www.defensenews.com/test-fixture/correct']);
});

it('TEST FIXTURE does not read namespace declarations as Atom href attributes', () => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom"><a:entry>
    <a:title>TEST FIXTURE Army</a:title><a:link xmlns:href="https://www.defensenews.com/test-fixture/metadata"/>
  </a:entry></a:feed>`;
  expect(parseFeed(xml, feed)).toEqual([]);
});

it('TEST FIXTURE ignores namespace declarations after real Atom rel and href attributes', () => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom"><a:entry>
    <a:title>TEST FIXTURE Army</a:title><a:link a:rel="alternate" xmlns:rel="https://namespace.example.org/" a:href="/correct" xmlns:href="https://metadata.example.org/"/>
  </a:entry></a:feed>`;
  expect(parseFeed(xml, feed).map(article => article.url)).toEqual(['https://example.org/correct']);
});

it.each(['root', 'entry', 'link'])('TEST FIXTURE ignores xmlns:base after real Atom %s base attributes', level => {
  const attributes = 'a:base="/articles/" xmlns:base="https://metadata.example.org/"';
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" ${level === 'root' ? attributes : ''}>
    <a:entry ${level === 'entry' ? attributes : ''}><a:title>TEST FIXTURE Army</a:title>
      <a:link ${level === 'link' ? attributes : ''} a:href="correct"/>
    </a:entry>
  </a:feed>`;
  expect(parseFeed(xml, feed).map(article => article.url)).toEqual(['https://example.org/articles/correct']);
});

it.each([
  '<m:thumbnail a:url="https://images.example.org/qualified.jpg"/>',
  '<r:enclosure a:type="image/jpeg" url="https://images.example.org/qualified.jpg"/>',
  '<m:thumbnail xmlns:m="https://not-media.example.org/" url="https://images.example.org/foreign.jpg"/>',
  '<enclosure xmlns="https://not-rss.example.org/" type="image/jpeg" url="https://images.example.org/foreign.jpg"/>',
])('TEST FIXTURE keeps image namespace/attribute validation separate from compatible article attributes: %s', image => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" xmlns:m="http://search.yahoo.com/mrss/" xmlns:r="http://purl.org/rss/1.0/"><a:entry>
    <a:title>TEST FIXTURE Army</a:title><a:link a:href="https://www.defensenews.com/test-fixture/correct"/>${image}
  </a:entry></a:feed>`;
  expect(parseFeed(xml, feed)).toMatchObject([{ url: 'https://www.defensenews.com/test-fixture/correct', urlToImage: null }]);
});

it('TEST FIXTURE preserves qualified-link article text, dates, order and exact image identity through repeated normalization', () => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" xmlns:m="http://search.yahoo.com/mrss/" xmlns:h="http://www.w3.org/1999/xhtml" xml:base="https://www.defensenews.com/test-fixture/">
    <item><m:thumbnail url="https://images.example.org/unrelated.jpg"/></item>
    <a:entry a:base="articles/"><a:title>TEST FIXTURE Army <h:strong>denies</h:strong> retreat.</a:title>
      <a:link a:rel="self" a:href="metadata"/><a:link a:rel="alternate" a:base="../" a:href="first"/>
      <a:summary><h:div>Army <h:strong>denies</h:strong> reports.<h:script>Not public</h:script></h:div></a:summary>
      <a:published>2026-11-14T23:59:59-05:30</a:published><m:thumbnail xml:base="https://images.example.org/assets/" url="first.jpg"/>
    </a:entry>
    <a:entry><a:title>TEST FIXTURE second Army</a:title><a:link a:href="second"/><a:updated>2026-11-14T24:00:00Z</a:updated>
      <m:thumbnail xmlns:m="https://not-media.example.org/" url="https://images.example.org/foreign.jpg"/>
    </a:entry>
  </a:feed>`;
  const articles = parseFeed(xml, feed);
  expect(articles).toEqual([
    { id: 'https://www.defensenews.com/test-fixture/first', title: 'TEST FIXTURE Army denies retreat.', description: 'Army denies reports.', url: 'https://www.defensenews.com/test-fixture/first', urlToImage: 'https://images.example.org/assets/first.jpg', publishedAt: '2026-11-15T05:29:59.000Z', source: { id: feed.id, name: feed.name } },
    { id: 'https://www.defensenews.com/test-fixture/second', title: 'TEST FIXTURE second Army', description: '', url: 'https://www.defensenews.com/test-fixture/second', urlToImage: null, publishedAt: null, source: { id: feed.id, name: feed.name } },
  ]);
  expect(articles.map(article => normalizeArticle(normalizeArticle(article)))).toEqual(articles);
  expect(selectArticles(selectArticles(articles))).toEqual(articles);
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

it('TEST FIXTURE does not attach images from unrelated nested channel metadata to real feed items', () => {
  const xml = `<rss xmlns:media="http://search.yahoo.com/mrss/"><metadata><channel><item><media:thumbnail url="https://images.example.org/unrelated.jpg"/></item></channel></metadata><channel>
    <item><title>TEST FIXTURE Army article</title><link>/story</link><media:thumbnail url="https://images.example.org/article.jpg"/></item>
  </channel></rss>`;
  expect(parseFeed(xml, feed)[0].urlToImage).toBe('https://images.example.org/article.jpg');
});

it.each([
  ['RSS', '<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><channel><atom:entry><media:thumbnail url="https://images.example.org/wrong.jpg"/></atom:entry><item><title>TEST FIXTURE Army</title><link>https://www.defensenews.com/test-fixture/story</link><media:thumbnail url="https://images.example.org/right.jpg"/></item></channel></rss>'],
  ['RSS1', '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><atom:entry><media:thumbnail url="https://images.example.org/wrong.jpg"/></atom:entry><item><title>TEST FIXTURE Army</title><link>https://www.defensenews.com/test-fixture/story</link><media:thumbnail url="https://images.example.org/right.jpg"/></item></rdf:RDF>'],
  ['Atom', '<feed xmlns="http://www.w3.org/2005/Atom" xmlns:rss="http://purl.org/rss/1.0/" xmlns:media="http://search.yahoo.com/mrss/"><rss:item><media:thumbnail url="https://images.example.org/wrong.jpg"/></rss:item><entry><title>TEST FIXTURE Army</title><link href="https://www.defensenews.com/test-fixture/story"/><media:thumbnail url="https://images.example.org/right.jpg"/></entry></feed>'],
  ['RSS multiple channels', '<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><item><title>TEST FIXTURE Army</title><link>https://www.defensenews.com/test-fixture/story</link></item></channel><channel><item><media:thumbnail url="https://images.example.org/wrong.jpg"/></item></channel></rss>'],
])('TEST FIXTURE %s binds images to the exact format-selected article node', (_format, xml) => {
  const expectedImage = _format === 'RSS multiple channels' ? null : 'https://images.example.org/right.jpg';
  expect(parseFeed(xml, feed)).toMatchObject([{
    title: 'TEST FIXTURE Army', url: 'https://www.defensenews.com/test-fixture/story', urlToImage: expectedImage,
  }]);
});

it('TEST FIXTURE keeps image identity aligned when source markup contains nested items', () => {
  const xml = `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
    <item><title>TEST FIXTURE first Army</title><link>/first</link><description>TEST FIXTURE text <item><media:thumbnail url="https://images.example.org/wrong.jpg"/></item></description><media:thumbnail url="https://images.example.org/first.jpg"/></item>
    <item><title>TEST FIXTURE second Army</title><link>/second</link><media:thumbnail url="https://images.example.org/second.jpg"/></item>
  </channel></rss>`;
  expect(parseFeed(xml, feed).map(article => article.urlToImage)).toEqual(['https://images.example.org/first.jpg', 'https://images.example.org/second.jpg']);
});

it.each([
  ['RSS local default', '<rss><channel><item>', '<enclosure xmlns="https://not-rss.example.org/" type="image/jpeg" url="https://images.example.org/not-rss.jpg"/>', '</item></channel></rss>'],
  ['RSS inherited default', '<rss><channel><item xmlns="https://not-rss.example.org/">', '<enclosure type="image/jpeg" url="https://images.example.org/not-rss.jpg"/>', '</item></channel></rss>'],
  ['RSS1 foreign override', '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/"><item>', '<enclosure xmlns="https://not-rss.example.org/" type="image/jpeg" url="https://images.example.org/not-rss.jpg"/>', '</item></rdf:RDF>'],
  ['Atom default', '<feed xmlns="http://www.w3.org/2005/Atom"><entry>', '<enclosure type="image/jpeg" url="https://images.example.org/not-rss.jpg"/>', '</entry></feed>'],
  ['RSS foreign prefix', '<rss xmlns:other="https://not-rss.example.org/"><channel><item>', '<other:enclosure type="image/jpeg" url="https://images.example.org/not-rss.jpg"/>', '</item></channel></rss>'],
])('TEST FIXTURE %s refuses enclosures outside RSS namespaces', (_case, open, image, close) => {
  const xml = `${open}<title>TEST FIXTURE Army</title><link href="https://www.defensenews.com/test-fixture/story">https://www.defensenews.com/test-fixture/story</link>${image}${close}`;
  expect(parseFeed(xml, feed)).toMatchObject([{
    title: 'TEST FIXTURE Army', url: 'https://www.defensenews.com/test-fixture/story', urlToImage: null,
  }]);
});

it.each([
  ['RSS1 default enclosure', '<enclosure type="image/jpeg" url="photo.jpg"/>'],
  ['RSS1 prefixed enclosure', '<r:enclosure type="image/jpeg" url="photo.jpg"/>'],
  ['RSS1 empty namespace enclosure', '<enclosure xmlns="" type="image/jpeg" url="photo.jpg"/>'],
  ['RSS1 local media default', '<thumbnail xmlns="http://search.yahoo.com/mrss/" url="photo.jpg"/>'],
])('TEST FIXTURE preserves %s with inherited XML bases', (_case, image) => {
  const xml = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:r="http://purl.org/rss/1.0/" xml:base="https://images.example.org/assets/">
    <item xml:base="today/"><title>TEST FIXTURE Army</title><link>https://www.defensenews.com/test-fixture/story</link>${image}</item>
  </rdf:RDF>`;
  expect(parseFeed(xml, feed)[0].urlToImage).toBe('https://images.example.org/assets/today/photo.jpg');
});

it.each([
  '<media:content url="https://images.example.org/not-an-image"/>',
  '<content url="https://images.example.org/not-an-image" type="image/jpeg"/>',
  '<media:content type="audio/mpeg" url="https://images.example.org/audio.mp3"/>',
  '<enclosure type="audio/mpeg" url="https://images.example.org/audio.mp3"/>',
  '<media:thumbnail type="audio/mpeg" url="https://images.example.org/audio.mp3"/>',
  '<media:image medium="audio" url="https://images.example.org/audio.mp3"/>',
  '<media:thumbnail xmlns:media="https://not-media.example.org/" url="https://images.example.org/pretend.jpg"/>',
])('TEST FIXTURE refuses namespace-ambiguous or explicitly non-image media %s', image => {
  const xml = `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><item><title>TEST FIXTURE Army media</title>
    <link>/story</link><description>TEST FIXTURE snippet.</description>${image}</item></channel></rss>`;
  expect(parseFeed(xml, feed)[0].urlToImage).toBeNull();
});

it.each([
  'http://images.example.org/photo.jpg', 'data:image/png;base64,AAAA', 'https://localhost/photo.jpg',
  'https://images.local/photo.jpg', 'https://127.0.0.1/photo.jpg', 'https://193.32.204.199/photo.jpg',
  'https://[::1]/photo.jpg', 'https://user:secret@images.example.org/photo.jpg', 'https://images.example.org:8443/photo.jpg',
])('TEST FIXTURE rejects unsafe publisher image %s without dropping readable text', url => {
  const xml = `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><item><title>TEST FIXTURE Army image</title>
    <link>/story</link><description>TEST FIXTURE public snippet.</description><media:thumbnail url="${url}"/>
  </item></channel></rss>`;
  expect(parseFeed(xml, feed)[0]).toMatchObject({ description: 'TEST FIXTURE public snippet.', urlToImage: null });
});

it.each([
  ['media thumbnail', '<media:thumbnail url="photo.jpg"/>'],
  ['media image', '<media:image url="photo.jpg"/>'],
  ['media medium image', '<media:content medium="image" url="photo.jpg"/>'],
  ['image enclosure', '<enclosure type="image/webp" url="photo.jpg"/>'],
  ['inherited alternate namespace', '<m:group xml:base="../pictures/"><m:content type="image/png" url="photo.jpg"/></m:group>'],
])('TEST FIXTURE resolves %s images against inherited XML bases', (_case, image) => {
  const xml = `<rss xmlns:media="http://search.yahoo.com/mrss/" xmlns:m="http://search.yahoo.com/mrss/" xml:base="https://images.example.org/assets/">
    <channel xml:base="news/"><item xml:base="today/"><title>TEST FIXTURE Army image</title>
      <link>https://example.org/story</link><description>TEST FIXTURE snippet.</description>${image}
    </item></channel></rss>`;
  const expected = image.includes('group') ? 'https://images.example.org/assets/news/pictures/photo.jpg' : 'https://images.example.org/assets/news/today/photo.jpg';
  expect(parseFeed(xml, feed)[0].urlToImage).toBe(expected);
});

it('TEST FIXTURE preserves prefixed Atom fields, XHTML text, and inherited image bases', () => {
  const xml = `<a:feed xmlns:a="http://www.w3.org/2005/Atom" xmlns:m="http://search.yahoo.com/mrss/" xmlns:h="http://www.w3.org/1999/xhtml" xml:base="https://www.defensenews.com/test-fixture/">
    <a:entry xml:base="articles/"><a:title>TEST FIXTURE Army <h:strong>denies</h:strong> retreat.</a:title>
      <a:link xml:base="../" href="story"/><a:summary type="xhtml"><h:div>Army <h:strong>denies</h:strong> reports.<h:script>Not public</h:script></h:div></a:summary>
      <m:group xml:base="https://images.example.org/assets/"><m:thumbnail xml:base="today/" url="photo.jpg"/></m:group>
    </a:entry>
  </a:feed>`;
  const articles = parseFeed(xml, feed);
  expect(articles).toMatchObject([{
    title: 'TEST FIXTURE Army denies retreat.', description: 'Army denies reports.',
    url: 'https://www.defensenews.com/test-fixture/story', urlToImage: 'https://images.example.org/assets/today/photo.jpg',
  }]);
  expect(selectArticles(articles.map(article => normalizeArticle(normalizeArticle(article))))).toEqual(articles);
});

it('TEST FIXTURE preserves whitespace-trimmed image attributes without trimming mixed text', () => {
  const xml = `<rss xmlns:m=" http://search.yahoo.com/mrss/ " xml:base=" https://images.example.org/assets/ "><channel><item>
    <title>TEST FIXTURE Army <strong>denies</strong> retreat reports.</title><link>https://www.defensenews.com/test-fixture/story</link>
    <m:group xml:base=" pictures/ "><m:content type=" image/jpeg " medium=" image " url=" photo.jpg "/></m:group>
  </item></channel></rss>`;
  expect(parseFeed(xml, feed)[0]).toMatchObject({
    title: 'TEST FIXTURE Army denies retreat reports.', urlToImage: 'https://images.example.org/assets/pictures/photo.jpg',
  });
});

it('TEST FIXTURE extracts an explicitly identified RSS media image without exporting its markup', () => {
  const xml = `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><item>
    <title>TEST FIXTURE Army image</title><link>/image-story</link><description>TEST FIXTURE public snippet.</description>
    <media:content url="https://images.example.org/army.jpg" type="image/jpeg"/>
  </item></channel></rss>`;
  expect(parseFeed(xml, feed)[0]).toMatchObject({
    title: 'TEST FIXTURE Army image', description: 'TEST FIXTURE public snippet.', urlToImage: 'https://images.example.org/army.jpg',
  });
});
