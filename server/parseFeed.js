import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { normalizeArticle, plainText, safeURL } from '../src/services/articleUtils.js';
import { safePublisherImage } from '../src/services/articleLinks.js';

const elementName = node => Object.keys(node).find(key => key !== ':@' && key !== '#text');
const localName = name => name?.split(':').at(-1);
const articleAttribute = (node, name) => Object.entries(node?.[':@'] ?? {}).findLast(([key]) => !key.startsWith('@_xmlns:') && localName(key.slice(2)) === name)?.[1];
const elements = (nodes, name) => (nodes ?? []).filter(node => localName(elementName(node)) === name);
const first = (nodes, name) => {
  const node = elements(nodes, name)[0];
  return node?.[elementName(node)];
};
const blockElements = new Set('address article aside blockquote br caption dd div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section table tbody td tfoot th thead tr ul'.split(' '));
function text(nodes) {
  return (nodes ?? []).map(node => {
    if (Object.hasOwn(node, '#text')) return node['#text'];
    const name = elementName(node);
    const local = localName(name).toLowerCase();
    if (['script', 'style'].includes(local)) return '';
    const value = text(node[name]);
    return blockElements.has(local) ? ` ${value} ` : value;
  }).join('');
}

function feedImages(nodes, inheritedBase, selected, inheritedNamespaces = {}, output = new WeakMap(), current = null, parent = '') {
  for (const node of nodes ?? []) {
    const name = Object.keys(node).find(key => key !== ':@' && key !== '#text');
    if (!name || name.startsWith('?')) continue;
    const attributes = Object.fromEntries(Object.entries(node[':@'] ?? {}).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
    const namespaces = { ...inheritedNamespaces };
    for (const [key, value] of Object.entries(attributes)) {
      if (key === '@_xmlns') namespaces[''] = value;
      else if (key.startsWith('@_xmlns:')) namespaces[key.slice(8)] = value;
    }
    const base = attributes['@_xml:base'] ? safeURL(attributes['@_xml:base'], inheritedBase ?? undefined) : inheritedBase;
    const parts = name.split(':');
    const local = parts.at(-1);
    const namespace = namespaces[parts.length > 1 ? parts[0] : ''];
    let images = current;
    if (['item', 'entry'].includes(local)) {
      if (!selected.has(node)) continue;
      images = [];
      output.set(node, images);
    }
    const media = namespace === 'http://search.yahoo.com/mrss/';
    const enclosure = local === 'enclosure' && (namespace === 'http://purl.org/rss/1.0/' || (parts.length === 1 && !namespace));
    const imageType = /^image\//i.test(attributes['@_type'] ?? '');
    const nonImage = (attributes['@_type'] && !imageType) || (attributes['@_medium'] && attributes['@_medium'] !== 'image');
    if (images && !nonImage && ((media && (['thumbnail', 'image'].includes(local) || (local === 'content' && (imageType || attributes['@_medium'] === 'image')))) || (enclosure && imageType))) {
      const url = safePublisherImage(safeURL(attributes['@_url'], base ?? undefined));
      if (url) images.push(url);
    }
    const container = !images && ((parent === '' && ['rss', 'RDF', 'feed'].includes(local)) || (parent === 'rss' && local === 'channel'));
    if (container || selected.has(node) || (media && local === 'group')) feedImages(node[name], base, selected, namespaces, output, images, local);
  }
  return output;
}

export function parseFeed(xml, feed) {
  if (typeof xml !== 'string' || Buffer.byteLength(xml) > 2_000_000 || /<!\s*(DOCTYPE|ENTITY)/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid feed');
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: true, preserveOrder: true, trimValues: false }).parse(xml);
  const roots = parsed.filter(node => Object.keys(node).some(key => !key.startsWith('?') && key !== '#text' && key !== ':@'));
  const root = roots[0];
  const channel = first(first(root ? [root] : [], 'rss'), 'channel');
  const atomFeed = first(root ? [root] : [], 'feed');
  const rdf = first(root ? [root] : [], 'RDF');
  if (roots.length !== 1 || (!channel && !atomFeed && !rdf)) throw new Error('Invalid feed');
  const atom = Boolean(atomFeed);
  const rootBase = articleAttribute(root, 'base');
  const base = atom && rootBase !== undefined && rootBase !== '' ? safeURL(rootBase, feed.url) : feed.url;
  const itemName = atom ? 'entry' : 'item';
  const items = elements(channel ?? rdf ?? atomFeed, itemName);
  const images = feedImages(parsed, feed.url, new Set(items));
  const articles = [];
  const seen = new Set();
  for (const entry of items) {
    const item = entry[elementName(entry)];
    const entryBaseAttribute = articleAttribute(entry, 'base');
    const entryBase = atom && entryBaseAttribute !== undefined && entryBaseAttribute !== '' ? safeURL(entryBaseAttribute, base ?? undefined) : base;
    const atomLink = atom ? elements(item, 'link').find(link => !articleAttribute(link, 'rel') || articleAttribute(link, 'rel') === 'alternate') : null;
    const linkBaseAttribute = articleAttribute(atomLink, 'base');
    const linkBase = linkBaseAttribute !== undefined && linkBaseAttribute !== '' ? safeURL(linkBaseAttribute, entryBase ?? undefined) : entryBase;
    const link = atom ? articleAttribute(atomLink, 'href') : text(first(item, 'link'));
    const article = normalizeArticle({
      title: text(first(item, 'title')), description: ['description', 'summary', 'encoded', 'content'].map(name => text(first(item, name))).find(value => plainText(value)) ?? '',
      urlToImage: images.get(entry)?.[0] ?? null,
      url: safeURL(link, linkBase ?? undefined), publishedAt: text(first(item, 'pubDate') ?? first(item, 'date') ?? first(item, 'published') ?? first(item, 'updated')),
    }, feed);
    if (!article || seen.has(article.id)) continue;
    seen.add(article.id);
    articles.push(article);
    if (articles.length === 10) break;
  }
  return articles;
}
