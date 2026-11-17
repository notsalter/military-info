import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { normalizeArticle, plainText, safeURL } from '../src/services/articleUtils.js';

const elements = (nodes, name) => (nodes ?? []).filter(node => Object.hasOwn(node, name));
const first = (nodes, name) => elements(nodes, name)[0]?.[name];
const blockElements = new Set('address article aside blockquote br caption dd div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section table tbody td tfoot th thead tr ul'.split(' '));
function text(nodes) {
  return (nodes ?? []).map(node => {
    if (Object.hasOwn(node, '#text')) return node['#text'];
    const name = Object.keys(node).find(key => key !== ':@');
    if (['script', 'style'].includes(name.toLowerCase())) return '';
    const value = text(node[name]);
    return blockElements.has(name.toLowerCase()) ? ` ${value} ` : value;
  }).join('');
}

export function parseFeed(xml, feed) {
  if (typeof xml !== 'string' || Buffer.byteLength(xml) > 2_000_000 || /<!\s*(DOCTYPE|ENTITY)/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid feed');
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, removeNSPrefix: true, processEntities: true, preserveOrder: true, trimValues: false }).parse(xml);
  const roots = parsed.filter(node => Object.keys(node).some(key => !key.startsWith('?') && key !== '#text' && key !== ':@'));
  const root = roots[0];
  const channel = first(root?.rss, 'channel');
  if (roots.length !== 1 || (!channel && !Object.hasOwn(root ?? {}, 'feed') && !Object.hasOwn(root ?? {}, 'RDF'))) throw new Error('Invalid feed');
  const atom = Object.hasOwn(root, 'feed');
  const base = atom && root[':@']?.['@_base'] !== undefined && root[':@']['@_base'] !== '' ? safeURL(root[':@']['@_base'], feed.url) : feed.url;
  const itemName = atom ? 'entry' : 'item';
  const items = elements(channel ?? root.RDF ?? root.feed, itemName);
  const articles = [];
  const seen = new Set();
  for (const entry of items) {
    const item = entry[itemName];
    const entryBase = atom && entry[':@']?.['@_base'] !== undefined && entry[':@']['@_base'] !== '' ? safeURL(entry[':@']['@_base'], base ?? undefined) : base;
    const atomLink = atom ? elements(item, 'link').find(link => !link[':@']?.['@_rel'] || link[':@']['@_rel'] === 'alternate') : null;
    const linkBase = atomLink?.[':@']?.['@_base'] !== undefined && atomLink[':@']['@_base'] !== '' ? safeURL(atomLink[':@']['@_base'], entryBase ?? undefined) : entryBase;
    const link = atom ? atomLink?.[':@']?.['@_href'] : text(first(item, 'link'));
    const article = normalizeArticle({
      title: text(first(item, 'title')), description: ['description', 'summary', 'encoded', 'content'].map(name => text(first(item, name))).find(value => plainText(value)) ?? '',
      url: safeURL(link, linkBase ?? undefined), publishedAt: text(first(item, 'pubDate') ?? first(item, 'date') ?? first(item, 'published') ?? first(item, 'updated')),
    }, feed);
    if (!article || seen.has(article.id)) continue;
    seen.add(article.id);
    articles.push(article);
    if (articles.length === 10) break;
  }
  return articles;
}
