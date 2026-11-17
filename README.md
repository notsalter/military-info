# Military Info

Military Info is a browser-based reader for military, defense, and geopolitics news. It shows publisher headlines and short previews, with links to the original articles. React and Vite build the UI to `dist/`; the existing Vercel project also runs one fixed-registry feed function. There is no account system or database.

## Read and save news

- Search the fetched collection by topic, place, or publisher; filter by topic and publisher and sort by date or headline.
- Open a headline to inspect its preview and choose **Read at** to visit the publisher.
- Use **Save article** and **Saved articles** for bookmarks stored in this browser. They do not sync between devices or include full articles.
- **Show more articles** displays another batch of 12 from the loaded collection. It does not fetch another page from publishers.
- Open **Sources** for the configured feed register and request results. Configured feeds are not a promise that every source works in every browser.

## Run locally

Use Node.js **22.12.0 or later** and npm, from a reviewed checkout:

```bash
npm ci --ignore-scripts
npm run dev
```

Open the local URL printed by Vite. No `.env` file or API key is required. See [setup and deployment](SETUP_INSTRUCTIONS.md) for testing, production builds, and the existing Vercel Git integration. Vercel should use Node.js **24.x**.

## Public feeds and optional keys

Keyless mode uses `/api/feeds?id=<registered-id>` on Vercel. The function requests only configured public publisher URLs and returns short normalized previews; it does not accept arbitrary URLs. A local static Vite preview has no function, so the client falls back to keyless rss2json and direct XML where publisher CORS allows it. Availability depends on publisher responses, service quotas, and network access. Search covers fetched snippets, not the publisher's entire archive. No full-article scraping or paywall bypass is implemented.

Optional NewsAPI and TheNewsAPI keys can be entered in **Settings**. They are stored in plain text in browser `localStorage`, not encrypted, and sent directly to the respective provider. Scripts running on the same origin, browser extensions with permission, and people with access to that browser may read them. Masked inputs do not protect stored keys. Avoid shared devices and do not place provider keys in `VITE_*` variables, source files, or deployment settings. Provider plans and browser-origin restrictions can still prevent requests.

Vercel requests the feed from its servers in deployed keyless mode; local fallback feed services and publisher image hosts receive browser requests. Keyless does not mean private or independent of third parties. The existing project uses the free Hobby plan, with usage allowances; exceeding them can pause service.

## Cache, freshness, and previews

News pools are reused for 15 minutes. Older validated snippets, up to seven days old, may be shown while refreshing or when live requests fail; the app warns when it returns stale cached results. This age describes fetching, not the publication date or factual accuracy of an article. **Settings → Clear news cache** forces a new request without deleting saved articles or optional keys. Browser storage can be blocked, full, or cleared.

Descriptions are plain text, limited to **250 characters including any trailing ellipsis**, in rendered previews and stored article records. Publisher attribution and source links remain. This is a product policy, not a guarantee of fair use, licensing, or copyright compliance. Publisher terms still apply. The app does not provide a DMCA contact or a full offline article archive; fictional examples belong only in tests.

## Security status

Malicious repository files were removed in containment commit `aea679c`, and the hostile remote workflows were disabled. This does **not** establish that previously used computers or credentials are safe. Device exposure, credential exposure, and rotation status remain unresolved. Do not add new credentials on an affected device until that exposure has been assessed. Read the [security note](docs/SECURITY.md) before using an older checkout or deploying.

## Documentation

- [Setup, commands, and Vercel deployment](SETUP_INSTRUCTIONS.md)
- [Data flow and implementation limits](docs/TECHNICAL_DOCS.md)
- [Demonstration checklist](docs/PRESENTATION_GUIDE.md)
- [Documentation index](docs/INDEX.md)

Project code is licensed under [MIT](LICENSE). Publisher content has its own rights and terms.
