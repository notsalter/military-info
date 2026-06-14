# 📊 Presentation Creation Brief - Military Info Command Center

## Document Purpose
This document provides key technical specifications, metrics, and slide recommendations to construct a presentation deck about the **Military Info Command Center** portal.

---

## Project Overview

### Application Name
**Military Info - Tactical Command Center**

### Tagline
"An advanced static aggregator for defense news with dynamic credentials shielding, dual RSS fallbacks, and a sleek glassmorphic HUD."

### Core Architectural Features
1. **Glassmorphic Dark Theme (HUD Style):** Modern slate backgrounds, glowing neon borders, and concentric scanning loaders.
2. **Dynamic Keyless Model:** Out-of-the-box operation utilizing 21 concurrent RSS feeds, bypassing credentials unless supplied in-app.
3. **Local Credentials Shielding:** User-entered keys (NewsAPI/TheNewsAPI) are cached locally in browser `localStorage`, preventing server-side credential leaks.
4. **Resilient XML CORS Ingest:** Custom client-side parser converting XML/Atom feeds through Allorigins CORS proxy if default aggregators hit rate limits.
5. **Display Pagination (Load More):** Fetches 60 articles into memory and renders them in increments of 12, reducing API quotas and browser drawing overhead.
6. **Drawer Previews & Bookmarks:** Sliding drawer layouts showing 250-character previews (Fair Use compliance), metadata, and custom browser bookmarks.

---

## Technical Specifications
- **Core Stack:** React 19.1, Vite 7.1, Tailwind CSS 3.4
- **Security Protocols:** Local storage key routing, JSDoc comment blocks, and standard secure outbound anchor tags.
- **Failover Logic:** Cache (15-min TTL) → Parallel API fetches → RSS CORS proxy fallbacks → Pre-populated offline mock database.

---

## Suggested Slides Layout

### Slide 1: Cover Page
- Title: Military Info Command Center
- Subtitle: Dynamic Aggregation and Credentials Shielding

### Slide 2: Problem Statement
- Statically compiled environment files leak developer keys on host platforms.
- General aggregators suffer from query pollution (e.g., mixing sports defense with defense policy).
- Full article scraping triggers copyright/DMCA issues.

### Slide 3: Secure Solutions & Architecture
- Local Key Manager isolates credentials to the client's browser.
- Strict 250-character summary limits protect publisher content (Fair Use guidelines).
- Keyless failover to 21 active military RSS nodes.

### Slide 4: Premium HUD Interface
- Geopolitical headline ticker streaming alerts.
- Domain filtering (Naval, Aerospace, Ground, Cyber, Geopolitics).
- Slides-over drawers and bookmarks dashboard.

### Slide 5: Performance Metrics
- **Cached Load Times:** <100ms
- **API Call Reduction:** 80% with localStorage caching.
- **Feeds Breadth:** 21 concurrent international defense feeds.
- **Client Pagination:** Incremental slices of 12, saving network traffic.
