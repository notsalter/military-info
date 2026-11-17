export const categoryLabels = { all: 'All topics', naval: 'Naval', aerospace: 'Aerospace', ground: 'Ground', cyber: 'Cyber', geopolitics: 'Geopolitics' };

export function PublicationDate({ value }) {
  if (!value || !Number.isFinite(Date.parse(value))) return <span>Date unavailable</span>;
  return <time dateTime={value}>{new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</time>;
}
