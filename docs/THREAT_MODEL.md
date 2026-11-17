# Feed integration threat model

This model covers the observed reader and fixed-ID feed function, not a full security certification or historical device recovery.

## Observed flows and boundaries

| ID | Flow | Evidence |
| --- | --- | --- |
| F1 | Browser to same-origin fixed feed ID | `src/services/rssService.js`, `api/feeds.js` |
| F2 | Function to registered public HTTPS publisher | `server/publicFeedFetch.js`, `src/services/feeds.js` |
| F3 | Untrusted XML to normalized snippets | `server/parseFeed.js`, `src/services/articleUtils.js` |
| F4 | Snippets to warm-instance/CDN and browser caches | `server/feedHandler.js`, `src/services/storage.js` |
| F5 | Browser-entered optional keys to their providers | `src/services/newsApi.js`, `src/components/SettingsModal.jsx` |
| F6 | Bookmarks and settings to browser storage | `src/services/storage.js`, `src/App.jsx` |

There are no accounts, privileged roles, payments, database, scheduled ingestion, or full-article archive in this implementation. Public feed IDs are deliberately readable without authentication.

## Scenarios and verification

| Scenario | Asset and precondition | Control and verification | Residual risk |
| --- | --- | --- | --- |
| Caller supplies a private or attacker-controlled URL | Function network access; public endpoint accepts a request | Exact ID-only query, shared registry, no URL parameter; negative handler and entry tests reject extra/duplicate/encoded fields before upstream work | Registered publishers remain external dependencies |
| Publisher DNS or redirect targets a private address | Function network access; attacker controls a DNS answer or publisher redirect | Every answer checked, validated address pinned for the connection, redirects restricted to exact publisher hosts and revalidated; public-address and DNS-rebinding tests | A public publisher can still serve inaccurate or unwanted content |
| Unbounded slow response or oversized XML | Compute/memory; publisher stalls or emits excessive bytes | One six-second upstream deadline, four redirects, two-million-byte cap, ten-second platform maximum; stalled DNS/socket/body and size tests | Many distinct public callers can still consume free-plan allowances |
| Malformed XML or unsafe article fields | Reader integrity; publisher content is untrusted | DOCTYPE/ENTITY rejection, structure validation, HTTP(S) URL normalization, plain-text previews, nullable dates, ten-item output cap; parser/handler tests | Word-order and content-quality regression tests are separate from security tests; no parser can verify reporting accuracy |
| Cached content represented as newly acquired | Reader freshness; cache reuse or mixed sources | Original server `fetchedAt` and remaining CDN lifetime retained; expiry/coalescing tests | Mixed client-source provenance needs its own service regressions; source status is a request result, not uptime |
| Same-origin script reads optional keys | User-entered provider keys; origin/device compromised | No compiled `VITE_*` key defaults, explicit plaintext-storage warning, direct provider routing, safe outbound links | `localStorage` is not encrypted; CSP cannot protect a compromised browser or device |
| Storage blocked or full | Local bookmarks/cache/settings; browser denies an operation | Guarded reads/writes, explicit save feedback, storage-failure regressions | Browser data can disappear; no device sync or server backup |

## Operating limits

The existing project uses Vercel's free Hobby plan, as confirmed by its owner. This change does not authorize a paid upgrade, database, scheduled job, or external proxy. A 15-minute CDN/warm-instance cache reduces repeated fetches but is not a global rate limiter. The allowance can be exhausted and service paused; successful requests are not guaranteed.

The historical repository incident remains unresolved at the device and credential level. Current-tree containment and endpoint tests do not establish that old checkouts, devices, credentials, or sessions are safe. See [Security status](SECURITY.md).
