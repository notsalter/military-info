# ⚡ Quick Start - Military Info Command Center

## 📝 Before You Start
Military Info now features a **Keyless Operation Model**. You can clone and run the application instantly—no environment variables or API keys are required to get started! By default, the app query engine resolves to 21 active international military RSS syndication channels and falls back to a local offline archive if network issues occur.

---

## 🚀 Running the App (3 Steps)

### Step 1: Install Dependencies
Open a terminal in the project folder and run:
```bash
npm install
```

### Step 2: Start the Tactical Dev Server
Launch Vite development server:
```bash
npm run dev
```

### Step 3: Open in Browser
The app will output the local network URL, typically:
```
http://localhost:5173
```
Open it to access the dark-themed Tactical HUD.

---

## ⚙️ Secure Credentials Configuration
If you have personal API keys for **NewsAPI.org** or **TheNewsAPI.com** and wish to integrate them:
1. Open the portal in your browser.
2. Click the **⚙️ SYSTEM CONFIG** button in the header.
3. Paste your key(s) in the modal fields.
4. Click **Apply Changes**. The keys will be saved securely in your browser's private `localStorage` cache.

---

## 🧪 Test the Features

### Test 1: Geopolitical Alert Ticker
- Check the top of the interface: a real-time horizontal scrolling ribbon streams the latest indexed headlines.

### Test 2: Category Channels
- Click on category tabs like **NAVAL OPERATIONS** or **CYBER & INTEL**. The news feed filters instantly client-side.

### Test 3: Safe Summary Inspection & Outbound Links
- Click any article card. A secure side-drawer slides out containing a summary limited to 250 characters (protecting publisher copyright) and a click-through **Read Full Article** button.

### Test 4: Bookmarks Section
- Open an article in the side drawer and click **★ Bookmark Report**.
- Click the **★ BOOKMARKS** button in the header to view only saved intelligence reports.

### Test 5: Load More Pagination
- Scroll to the bottom of the feed. Click **[ LOAD MORE INTEL REPORTS ]** to render the next 12 reports in the current channel feed.

---

## 📦 Building for Production
To bundle optimized, minified assets for production hosting:
```bash
npm run build
```
This generates standard static files in the `dist/` directory, ready to deploy to Vercel, Netlify, or Github Pages.
