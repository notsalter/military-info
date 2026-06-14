# 🚀 Setup Instructions - Military Info Command Center

## Unified Setup Process

### Step 1: Install Dependencies
Ensure you have Node.js (v18+) installed. Clone the repository and execute:
```bash
npm install
```

### Step 2: Run the Dashboard
Start the local server:
```bash
npm run dev
```
Open **http://localhost:5173** to view the interface.

---

## 🔒 Security Configuration Options
By default, the portal runs in **Keyless Mode** out of the box using public RSS feeds, protecting developer quotas and secrets from exposure.

If you wish to configure live developer keys:
1. Load the website in your browser.
2. Click **⚙️ SYSTEM CONFIG** in the upper-right corner.
3. Supply a valid **NewsAPI.org** or **TheNewsAPI.com** key.
4. Click **Apply Changes**. The credentials will be saved in your browser's private `localStorage` cache.

---

## 📁 System Component Layout
- `src/components/`
  - [SearchBar.jsx](file:///c:/Users/salter/military-info/src/components/SearchBar.jsx) - Tactical search queries.
  - [ArticleCard.jsx](file:///c:/Users/salter/military-info/src/components/ArticleCard.jsx) - Glassmorphic cards with custom category SVG fallbacks.
  - [ArticleGrid.jsx](file:///c:/Users/salter/military-info/src/components/ArticleGrid.jsx) - Grid display.
  - [ArticleDrawer.jsx](file:///c:/Users/salter/military-info/src/components/ArticleDrawer.jsx) - Side-drawer containing previews and legal disclaimers.
  - [SettingsModal.jsx](file:///c:/Users/salter/military-info/src/components/SettingsModal.jsx) - local storage Key manager and cache controller.
  - [Loading.jsx](file:///c:/Users/salter/military-info/src/components/Loading.jsx) - Concentric scanning reticle.
  - [ErrorMessage.jsx](file:///c:/Users/salter/military-info/src/components/ErrorMessage.jsx) - Red warning HUD layout.
- `src/services/`
  - [newsApi.js](file:///c:/Users/salter/military-info/src/services/newsApi.js) - Unified query engine, credential storage, content filtering, and mock offline database fallbacks.
  - [rssService.js](file:///c:/Users/salter/military-info/src/services/rssService.js) - 21 RSS channels manager with XML proxy fallbacks.

---

## 🛠️ Available Dev Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Starts Vite development server |
| `npm run build` | Bundles static distribution directory to `dist/` |
| `npm run test` | Performs automated Vitest unit testing |
| `npm run preview` | Serves local build for verification |

---

## 🏛️ Copyright Compliance
This portal strictly enforces:
- A **250-character limit** on article descriptions (Fair Use guidelines).
- A **DMCA takedown notice** block in the footer.
- Click-through source redirects with secure outbound parameters.
