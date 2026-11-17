const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const markup = /<\/?[a-z][^>]*>|<[!?][^>]*>/gi;
export function plainText(value) {
  if (typeof value !== 'string') return '';
  return value.slice(0, 100000).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(markup, ' ').replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, entity) => {
      if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? match;
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    }).replace(markup, ' ').replace(/\s+/g, ' ').trim();
}
export function safeURL(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
export function safeDate(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(input);
  if (iso) {
    if (Number(iso[4] ?? 0) > 23 || Number(iso[5] ?? 0) > 59 || Number(iso[6] ?? 0) > 59) return null;
    const [year, month, day] = iso.slice(1, 4).map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  } else {
    const rfc = /^(?:[A-Za-z]{3},?\s+)?(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+(?:GMT|UTC|[+-]\d{4})$/i.exec(input);
    if (!rfc || Number(rfc[4]) > 23 || Number(rfc[5]) > 59 || Number(rfc[6] ?? 0) > 59) return null;
    const offset = /[+-](\d{2})(\d{2})$/.exec(input);
    if (offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59)) return null;
    const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(rfc[2].toLowerCase());
    const calendar = new Date(Date.UTC(Number(rfc[3]), month, Number(rfc[1])));
    if (month < 0 || calendar.getUTCMonth() !== month || calendar.getUTCDate() !== Number(rfc[1])) return null;
  }
  const normalized = iso && input.length > 10 && !/(Z|[+-]\d{2}:?\d{2})$/.test(input) ? input.replace(' ', 'T') + 'Z' : input;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function normalizeArticle(raw, source) {
  if (!raw || typeof raw !== 'object') return null;
  const title = plainText(raw.title).slice(0, 500);
  const url = safeURL(raw.url ?? raw.link);
  if (!title || !url) return null;
  const text = plainText(raw.description || raw.snippet || raw.summary || raw.content);
  const published = raw.publishedAt ?? raw.published_at ?? raw.pubDate;
  const date = safeDate(published);
  const origin = source ?? raw.source;
  const name = plainText(typeof origin === 'string' ? origin : origin?.name) || new URL(url).hostname;
  return {
    id: url, title, description: text.length > 250 ? `${text.slice(0, 247)}...` : text,
    url, urlToImage: safeURL(raw.urlToImage ?? raw.image_url ?? raw.thumbnail),
    publishedAt: date,
    source: { id: plainText(origin?.id).slice(0, 100) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: name.slice(0, 150) },
  };
}

const categoryRules = [
  ['cyber', /\b(cyber(?:attack|security|warfare)?|ransomware|malware|hacking|phishing)\b/i],
  ['naval', /\b(naval|navy|navies|maritime|submarines?|warships?|frigates?|destroyers?|aircraft carrier)\b/i],
  ['aerospace', /\b(aerospace|air force|aircraft|aviation|fighters?|jets?|drones?|satellites?|space|spacex|hypersonic)\b/i],
  ['ground', /\b(army|armies|infantry|tanks?|artillery|soldiers?|brigades?|battalions?|ground forces)\b/i],
];

export function isMilitaryArticle(article) {
  const text = `${article?.title ?? ''} ${article?.description ?? ''}`;
  const url = safeURL(article?.url);
  if (!url) return false;
  const host = new URL(url).hostname;
  if (/(^|\.)(espn\.com|sportingnews\.com|bleacherreport\.com|cbssports\.com|si\.com|foxsports\.com)$/.test(host)) return false;
  return /\b(military|defen[cs]e|armed forces|pentagon|nato|army|navy|marines|troops|soldiers?|weapons?|missiles?|fighter|tanks?|warships?|submarines?|combat|battalions?|regiments?|brigades?|munitions?|artillery|war|warfare|conflict|invasion|national security|geopolitics|cyberattack|cybersecurity|satellites?|air force|veterans?)\b/i.test(text);
}

export function classifyArticle(article) {
  const text = `${article?.title ?? ''} ${article?.description ?? ''}`;
  return categoryRules.find(([, pattern]) => pattern.test(text))?.[0] ?? 'geopolitics';
}

export function selectArticles(articles, { query = '', category = 'all', source = 'all', sort = 'newest' } = {}) {
  const words = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
  const seen = new Set();
  const selected = (Array.isArray(articles) ? articles : []).map(article => normalizeArticle(article)).filter(article => {
    if (!article || seen.has(article.id)) return false;
    seen.add(article.id);
    const text = `${article.title} ${article.description} ${article.source.name} ${classifyArticle(article)}`.toLowerCase();
    return words.every(word => text.includes(word)) && (!category || category === 'all' || classifyArticle(article) === category)
      && (!source || source === 'all' || article.source.id === source || article.source.name === source);
  });
  return selected.sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    if (!a.publishedAt || !b.publishedAt) return Number(!a.publishedAt) - Number(!b.publishedAt) || a.id.localeCompare(b.id);
    return (Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) * (sort === 'oldest' ? 1 : -1) || a.id.localeCompare(b.id);
  });
}
