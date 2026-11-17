# Demonstration checklist

Use the current reader interface, not the older tactical-dashboard description. Review [security status](SECURITY.md) before demonstrating from an older checkout. Leave optional keys empty, and do not display credentials or private incident evidence.

## Show the reader

1. Open **Latest news**. Explain that headlines and short previews come from publishers and may arrive progressively.
2. Search for a term present in the loaded collection. Use **Topic**, **Publisher**, and **Sort articles**, then reset the filters. A search miss should be shown as empty, not replaced by examples.
3. Open a headline. Show attribution, publication date or **Date unavailable**, the short preview, and the **Read at** publisher link. Publisher paywalls and terms still apply.
4. Choose **Save article**, close the dialog, and switch to **Saved articles**. Reload to check persistence in this browser. Full articles and cross-device sync are not included.
5. Use **Show more articles** if enough results exist. It reveals loaded records; it does not fetch another page.
6. Open **Sources** and distinguish configured feeds from measured request results. Browser CORS, timeouts, and rate limits may leave some sources unavailable.
7. Open **Settings** without entering a key. Show the plain-text storage warning and **Clear news cache**; explain that clearing news leaves saved articles unchanged.

## Show limits rather than hiding them

For repeatable behavior checks, use automated mocked tests and test-only fixtures. Label fixture headlines as test data, never as live reporting. If the live service fails, show its error, a stale-cache warning if present, or previously saved snippets. Do not claim a live-news demonstration succeeded because fixture tests passed.

The 250-character description limit is a product policy, not a legal shield. Browser-stored keys are not encrypted. Configured source counts do not measure uptime, and a successful build does not establish deployment success or resolve device/credential exposure.

Before sharing a deployment, check keyboard navigation and focus return, mobile layout, missing images, empty/error states, and persistence. Use [setup and verification](../SETUP_INSTRUCTIONS.md) for commands and report only checks that actually ran.
