# Technical reference

## Client-side data flow

The application is a React single-page app served as Vite-built static files, plus one Vercel Node.js feed function. It has no database, login, scheduled ingestion, or key vault. The function is used only on the existing free Hobby project; usage limits can pause the deployment.

1. `App.jsx` starts `fetchNews`, accepts progressive results, and aborts superseded requests. A request-generation check prevents late results from replacing a newer search.
2. `newsApi.js` checks a validated merged pool in browser storage. Without user-entered keys it starts RSS only; configured NewsAPI and TheNewsAPI requests run alongside RSS.
3. `rssService.js` reads the register in `feeds.js`, fetches feeds with bounded concurrency, and reports per-feed results as they complete.
4. `articleUtils.js` normalizes and deduplicates articles by normalized URL. It applies search, topic, publisher, and sort selection. API results also pass a military-keyword relevance check and a sports-domain exclusion; configured RSS content is not guaranteed to be relevant or accurate.
5. `App.jsx` displays the selected collection, initially 12 articles. **Show more articles** reveals another 12 locally rather than requesting another publisher page.

The UI requests up to 200 selected articles. Search terms are matched against headline, preview, source name, and derived topic in the fetched collection. This is not full-text archive search. Topic classification is a keyword heuristic shared by cards, article details, and filters.

## RSS and source availability

`feeds.js` is the source register. Use it or the **Sources** dialog for the current list instead of maintaining a second count in documentation.

Each registered feed first uses the same-origin `/api/feeds?id=<id>` endpoint. Only an exact registered ID is accepted; additional parameters, duplicates, non-GET methods, and arbitrary URLs are rejected. The function uses HTTPS with certificate verification, validates all DNS answers, pins the checked address for the connection, and rechecks at most four redirects that retain the exact initial hostname. Redirects between `www` and apex hosts or to other subdomains are rejected before DNS lookup. Private/reserved addresses and the identified hostile destination are excluded. A single six-second fetch deadline and a two-million-byte body cap bound upstream work; the Vercel function has a ten-second maximum duration. It exports at most ten normalized snippets per feed, never a separate full-content field.

Successful snippets are coalesced and cached for 15 minutes in a warm instance and the CDN. Reuse preserves the original `fetchedAt`, and the CDN freshness window is reduced by elapsed cache age rather than restarted. Errors are generic, not cached, and do not expose upstream response bodies. Memory caching is instance-local, not a durable database or global abuse limit.

A local static Vite preview has no endpoint. On a missing endpoint, the browser falls back to keyless rss2json and then direct XML where publisher CORS permits it. Deployed endpoint failures are not bypassed with external converter requests. There is no Allorigins fallback, paid rss2json key, arbitrary URL proxy, or full-article scraper.

Default scheduling uses three workers with a 150 ms start interval, a five-second timeout per RSS transport attempt, and an 18-second deadline for the feed pool. Optional API transports use an eight-second timeout. These are request bounds, not measured load-time promises. Publisher or endpoint 429 responses save a cooldown for that feed; rss2json 429 responses stop converter calls without blocking registered same-origin endpoint requests. Optional providers have independent cooldowns. Retry-After accepts seconds or an HTTP date, and deadlines remain in memory if storage is unavailable. Forced refresh does not bypass cooldowns.

XML parsing uses `fast-xml-parser` for RSS and Atom, validates structure, and rejects documents over the configured size limit or with DOCTYPE/ENTITY declarations. Malformed sibling items can be discarded without inventing replacements.

The service exposes `feedHealth`, `fetchedAt`, `cached`, `stale`, and `storageWarnings`. **Sources** shows response, empty, failure, timeout, and rate-limit labels where available, with cached health identified separately. Each request resets its health; retained articles are labeled as previous results when the new request has not replaced them or fails. These labels are not ongoing publisher-uptime measurements. A configured feed, a server-side endpoint probe, and a successful browser fetch are different kinds of evidence.

## Article policy

Normalized records contain a URL-based ID, headline, short description, source attribution, optional publication date, and optional image URL. They do not retain a separate full-content field.

- Descriptions are converted to plain text and capped at **250 characters**, including the trailing `...` for truncated text. Stored caches and bookmarks use the same normalization as displayed articles.
- Links accept HTTP/HTTPS URLs without embedded credentials; unsafe or missing article URLs are rejected. This validation does not vouch for the publisher's site.
- Invalid publication dates become unavailable; the UI does not substitute the current date. Dates are displayed in UTC.
- Missing or failed images are omitted. Remote image hosts still receive browser requests.
- Full-article links open the publisher in a new tab with `noopener noreferrer`.

The snippet limit and attribution are product rules. They do not grant redistribution rights, establish fair use, bypass paywalls, or supply a DMCA contact.

## Browser storage and freshness

`storage.js` wraps `localStorage` operations so blocked or full storage does not need to crash the reader. It validates versioned caches and bookmarks and normalizes stored articles on read and write.

| Data | Behavior |
| --- | --- |
| News/RSS pools | Reused for 15 minutes; validated stale pools are usable for up to seven days after fetching. Invalid, future-dated, or older pools are rejected. |
| Saved articles | Up to 500 normalized bookmark records in this browser, with no device sync and no full-article download. |
| Optional API keys | Plain-text local values, read only from the browser's user-entered settings. No environment-variable fallback. |

Expired pools may be published while requests run and returned if live sources fail. The stale result retains its original fetch timestamp and triggers a warning in the latest-news view. A recent fetch timestamp does not imply every feed succeeded or that the publisher's stories are recent. Failed or empty live results are not filled with fictional reports.

**Clear news cache** removes news/RSS pools and starts a forced refresh, preserving bookmarks and optional keys. **Remove keys** clears the local key fields; it does not revoke provider credentials. Clearing all browser site data also removes bookmarks and keys. Storage is origin-specific, so a localhost bookmark is not automatically available on Vercel.

Keys are not encrypted or protected by masking the input. Same-origin scripts, permitted extensions, or access to the browser/device can expose them. NewsAPI receives its key in a request header; TheNewsAPI receives its token as a query parameter. Do not share request logs containing keys. Keyless mode avoids sending optional provider keys, but still contacts feed services and publisher hosts.

## Tests and operational limits

Vitest tests live beside services and components. They mock network requests and browser storage and use test-only records and XML. They cover normalization, cache boundaries, failures, cancellation, rate limits, selection, and reader interactions. They do not certify every publisher as browser-accessible.

The Playwright suite in `tests/browser/reader.spec.js` intercepts feed requests with explicitly labeled test fixtures and blocks other external requests. `playwright.config.js` starts Vite preview against the existing `dist/` build. It checks reader interactions, failure states, keyboard focus, responsive layouts, and axe accessibility findings without live keys. Run a build before running the browser suite by itself; `npm run verify` already orders those steps.

Repository safety tests check known hostile paths and selected workflow patterns. They cannot establish that a computer was uncompromised or that credentials were rotated. Fixture-based browser QA and deployed-origin live-feed checks answer different questions; do not publish a result until that check ran.

See [setup](../SETUP_INSTRUCTIONS.md) for the actual npm commands and [security status](SECURITY.md) for the unresolved incident. Production does not include an invented offline news database. Existing cached snippets and bookmarks can remain readable after a network failure once the app is loaded; there is no service-worker installation or guaranteed offline app launch.
