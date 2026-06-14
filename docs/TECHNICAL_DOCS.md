# 📚 Technical Documentation - Military Info Command Center

Complete technical reference for developers working with the refactored, secure, and copyright-compliant Military Info dashboard.

---

## Table of Contents
1. [Core Aggregator Architecture](#1-core-aggregator-architecture)
2. [Secure Credentials & Keyless Operation](#2-secure-credentials--keyless-operation)
3. [Resilient RSS & CORS Proxy Parsing](#3-resilient-rss--cors-proxy-parsing)
4. [Client-Side Pagination (Load More)](#4-client-side-pagination-load-more)
5. [Intelligent Content Filtering](#5-intelligent-content-filtering)
6. [Offline Database Fallback](#6-offline-database-fallback)
7. [Fair Use & DMCA Compliance](#7-fair-use--dmca-compliance)

---

## 1. Core Aggregator Architecture

Military Info coordinates requests across three primary ingestion layers in parallel, merging and cleaning results on the client side:

```
                  [ USER SEARCH / CHANNEL SELECT ]
                                 │
                        Check local cache?
                       ┌─────────┴─────────┐
                    (YES)                (NO)
                       │                   │
               [ Return Cache ]   [ Promise.allSettled ]
                                 ┌─────────┼─────────┐
                            NewsAPI    TheNewsAPI   RSS Feeds
                                 └─────────┼─────────┘
                                           │
                                    Merge & Filter
                                           │
                                   Remove Duplicates
                                           │
                                      Sort by Date
                                           │
                                    Store in Cache
                                           │
                                    Slice & Display
```

---

## 2. Secure Credentials & Keyless Operation

To shield developers from credentials theft and quota drain, keys are loaded dynamically in the browser rather than compiled statically.

### Local Key Configuration
Users enter custom keys in the **SettingsModal** UI, which calls:
```javascript
export const saveCustomKeys = (newsApiKey, theNewsApiKey) => {
  localStorage.setItem('military_newsapi_key', newsApiKey ? newsApiKey.trim() : '');
  localStorage.setItem('military_thenewsapi_key', theNewsApiKey ? theNewsApiKey.trim() : '');
};
```
If no keys are found in `localStorage` or environment variables, the system executes in **Keyless Public Mode**, bypasses API fetches, and queries RSS feeds directly.

---

## 3. Resilient RSS & CORS Proxy Parsing

The application lists **21 active feeds** representing global military commands, newsrooms, and aerospace analysts.

### Feeds Profile
- **Defense Analysts:** Defense News, Military Times, Breaking Defense, Defense One, The Defense Post, National Defense, War on the Rocks, RealClearDefense, C4ISRNET.
- **National Commands:** US Dept of Defense, US Army Combat, US Navy News, US Air Force News, UK Ministry of Defence News.
- **Technology & Specs:** The Aviationist, Naval News, DARPA News, Army Technology, Naval Technology, Aerospace Technology.

### Dual-Fetch XML Parser Fallback
If `rss2json.com` fails or runs out of free requests, the service queries feeds through Allorigins CORS proxy and parses XML client-side:
```javascript
const response = await axios.get(`https://api.allorigins.win/get?url=${encodeURIComponent(feed.url)}`);
const parser = new DOMParser();
const xmlDoc = parser.parseFromString(response.data.contents, 'text/xml');
```
It supports both standard RSS (`item` tags) and Atom (`entry` tags) schemas.

---

## 4. Client-Side Pagination (Load More)

To limit network requests and browser rendering overhead, we implement client-side display pagination:
1. **Large Data Query:** The aggregator fetches a larger pool of items (default `pageSize = 60`) from successful APIs and RSS feeds.
2. **Local Slice:** The UI renders only a subset (controlled by `visibleCount`, starting at 12).
3. **Display Increment:** Clicking the **[ LOAD MORE INTEL REPORTS ]** button increments `visibleCount` by 12.
4. **Reset Triggers:** Switching categories, executing a search, or toggling bookmarks resets `visibleCount` back to 12.

---

## 5. Intelligent Content Filtering

Every article undergoes strict keyword inspection to filter out false positives (e.g. sports or food context using the term "defense"):

- **Positive Keywords (40+):** `military`, `defense`, `defence`, `armed forces`, `pentagon`, `nato`, `cyberattack`, `cyber warfare`, `satellite`, etc.
- **Negative Exclusions (60+):** Sports strategy jargon (`touchdown`, `playoff`, `quarterback`, `sec home win`, `premier league`), real estate, entertainment, obituaries, and natural disasters (unless military-responded).
- **Domain Blocking:** Blacklists aggregate noise sites (e.g. `biztoc.com`, `fark.com`).

---

## 6. Offline Database Fallback

If network connections are unavailable and caches are cleared, the application falls back to `OFFLINE_NEWS_DATABASE` containing pre-written reports categorized by tactical domain:
- **Naval Operations:** e.g., underwater search-and-rescue drills.
- **Aerospace Defense:** e.g., hypersonic stealth fighter avionics envelope testing.
- **Ground Systems:** e.g., low-thermal-signature hybrid tactical infantry transport.
- **Cyber & Intelligence:** e.g., contractors phishing defense system.
- **Geopolitics & Policy:** e.g., Arctic defensive sovereignty guidelines.

---

## 7. Fair Use & DMCA Compliance

To shield the developer from copyright claims:
- **Hard Preview Limits:** Description summaries are cut off at 250 characters (`slice(0, 250) + '...'`).
- **Attribution Badges:** Display publisher names prominently in cards and drawers.
- **Direct Redirection:** Outbound links open official web properties in new tabs with secure referrer policies.
- **Takedown Link:** DMCA removal requests contact details are displayed clearly in the footer.
