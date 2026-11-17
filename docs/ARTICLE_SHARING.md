# Article links and publisher images

## Curation disclaimer

Military Info curates headlines and short previews from third-party sources; we do not produce the original reporting. Original articles and images belong to their respective rights holders. Inclusion is not an endorsement. Read the linked publisher for full context and updates.

The same wording appears in the reader footer and article preview so direct-link visitors can see it. It identifies the site's role and attribution; it does not claim permission, legal immunity, or verification of every publisher's reporting.

## Reader behavior

Registered public-feed headlines open the existing article drawer and put a Military Info article URL in the address bar. The headline remains a real link, so copying its address or opening it in another tab also works. The drawer offers a first-party copy action and native sharing where the browser supports it. Clipboard denial exposes a selectable URL instead of claiming success. “Read at” still opens the publisher's original article.

These links are previews, not an archive. They resolve only while the article remains among the source feed's bounded items. A publisher can change its feed or withdraw an article. The link then shows an unavailable page; it never accepts an unverified headline or source URL from the visitor as news. Permanently retained previews would require a separately approved storage design.

## Social preview

New links use `/article/<registered-feed-id>/<headline-words>~<16hex-id>`. The decorative slug is the first eight lowercase ASCII word tokens from the actual headline, stopping before a whole word would exceed 60 characters. Missing usable words do not produce an invented headline slug. The identifier is the first 64 bits (16 lowercase hex digits) of SHA-256 over the validated canonical source URL's ASCII bytes. A dependency-free synchronous SHA-256 implementation keeps native headline links and rendering synchronous; tests compare padding and long-URL boundaries with Node's SHA-256 implementation. This compact identifier is not reversible and needs no database or stored mapping.

The server looks up the identifier only among the existing fixed-ID feed handler's bounded normalized results. The slug never supplies headline, snippet or attribution. A changed headline for the same source URL still resolves by identifier; HTML canonical and share fields use the current real headline's generated path at the fixed `https://military-info.vercel.app` origin. A 64-bit prefix is not mathematically collision-free: multiple matching records fail closed with an unavailable response, never first-match attribution. There is no retained feed archive.

Existing `/article/<registered-feed-id>/<base64url-encoded-canonical-article-url>` links remain valid identifiers. The client uses explicit URL-identity matching for initialization, accepted feed progress, saved-storage recovery, popstate and Close; it preserves exact per-entry history paths and previously resolved snapshots for Forward. New copy/share actions generate the readable form. The legacy encoded URL is also only an identifier, never a fetch destination. Neither route fetches article pages or image destinations.

Both bounded token forms rewrite to `api/article.js`. The request parser accepts a bare valid article path, the exact ordered `/api/article?feed=<feed>&article=<token>` control, or the original article pathname plus that same exact raw query echo. The last form matches the original-path preservation and injected query in pinned public Vercel reference code; it is reference emulation, not captured production internals. Duplicate/conflicting fields, extras, reordered fields, encoded spellings, fragments and malformed tokens are rejected before feed access. It does not trust forwarded URL headers or `req.query` to select a different article.

The HTML response includes a canonical first-party URL, Open Graph and Twitter metadata, headline, bounded description, source attribution and original publication date when supplied and valid. Social crawlers can read it without JavaScript. A real publisher image is optional; text-only metadata remains valid when no image exists. Messaging platforms choose and cache their own display, so rendered metadata is not a guarantee of identical cards in every app.

Preview content is bounded to the same ten feed items and 250-character snippet policy as the reader. Cached acquisition time remains unchanged, with the remaining freshness window rather than a new 15-minute lifetime. Unavailable and invalid responses are not cached and are not indexed. The canonical production origin is fixed rather than derived from an untrusted Host header.

## Images

Use real image URLs supplied inside registered feeds as explicit image media, thumbnails, or image enclosures. Images present only in an HTML feed excerpt are not extracted. Do not scrape article pages, invent illustrations, insert stock substitutes, or add an arbitrary image proxy. Only public HTTPS image URLs without credentials or nonstandard ports are accepted.

Cards without an image remain text-only. Broken images disappear, and a changed image URL can retry. Dimensions reserve the image's aspect ratio. Reader and preview images use a no-referrer policy. Loading a remote image still discloses the reader's network address to that image host; no-referrer is not anonymity. Publisher licensing and hotlink policies continue to apply. External image availability is outside this project's control.

## Deployment cleanup

Vercel stores separate build snapshots; multiple history entries do not mean multiple live websites. GitHub deployment records and actual Vercel deployments are different inventories. Cleanup must list actual deployments within `military-info`, preserve the final active production deployment and its exact Git revision, privately retain the selected inventory, then remove only obsolete deployment IDs. Never use a project-name deletion command: it can remove the project itself.

Keeping one deployment is a one-time cleanup result, not a permanent Vercel invariant. Future pushes and PRs normally create new snapshots. Removing older deployments also removes immediate rollback targets; Git history remains intact. No retention setting, account upgrade, scheduled cleanup, database or paid preview service is introduced by this feature.

## Verification

Local unit tests cover link validation, metadata escaping, feed-only lookup, image extraction and unavailable/error behavior. Built-browser tests cover headline navigation, copy fallback, source links, browser history, dialog focus and responsive accessibility. Deployment verification must additionally exercise the actual rewrite and raw HTML metadata on the deployed origin; a Vite static preview does not run Node functions. CI, reviewed revision, PR/commit references, live verification and final inventory results belong in the corresponding GitHub PR record.
