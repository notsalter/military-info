# ⚡ Quick Start - Military Info

## 📝 Before You Start

You need a **FREE API Key** from NewsAPI.org to fetch news articles.

### Get Your API Key (2 minutes)

1. Go to: **https://newsapi.org/register**
2. Fill in:
   - Name
   - Email
   - Password
3. Click "Submit"
4. Check your email and verify
5. Copy your API Key (32 characters)

---

## 🚀 Running the App (3 Steps)

### Step 1: Add Your API Key

1. Open the file: **`.env`** (in the root folder)
2. Replace this line:
   ```
   VITE_NEWS_API_KEY=
   ```
   
   With your actual API key:
   ```
   VITE_NEWS_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   ```
   
   ⚠️ **Important**: No quotes, no spaces!

### Step 2: Start the Development Server

Open terminal and run:

```bash
npm run dev
```

### Step 3: Open in Browser

The app will automatically open at:
```
http://localhost:5173
```

If not, click the link in your terminal.

---

## ✅ What You Should See

1. **Blue header** with "Military Info" title and 🎖️ icon
2. **Search bar** in the header
3. **News cards** loading (with spinner animation)
4. **Grid of news articles** about military/defense topics

---

## 🧪 Test the Features

### Test 1: View Articles
- Scroll through the news feed
- You should see 20 articles

### Test 2: Click an Article
- Click any news card
- Article should open in a new tab

### Test 3: Search
- Type in search bar: **"kapal selam"**
- Press Enter or click "Cari" button
- New results should appear

### Test 4: Clear Search
- Click the **X** button in search bar
- Or click "Cari" with empty search
- Should return to default "militer" results

---

## 🐛 Troubleshooting

### ❌ Error: "API Key tidak valid"

**Fix:**
1. Check `.env` file
2. Ensure API key is correct
3. No spaces before or after the key
4. Restart the server: Press `Ctrl+C`, then `npm run dev`

### ❌ Error: "Tidak dapat terhubung ke server"

**Fix:**
1. Check your internet connection
2. Try again in a few seconds
3. NewsAPI might be temporarily down

### ❌ No Articles Showing

**Fix:**
1. Open browser console (Press F12)
2. Check for error messages
3. You might have hit the 100 requests/day limit
4. Wait 24 hours or upgrade your API plan

### ❌ Styles Look Broken

**Fix:**
1. Restart the dev server
2. Clear browser cache (Ctrl+Shift+R)
3. Check that `tailwind.config.js` exists

---

## 📱 Responsive Design

Test on different screen sizes:

- **Desktop** (1920px): 3 columns of articles
- **Tablet** (768px): 2 columns of articles  
- **Mobile** (375px): 1 column of articles

---

## 🎯 Example Search Keywords

Try these searches (in Indonesian or English):

**Indonesian:**
- kapal selam (submarine)
- jet tempur (fighter jet)
- tank militer (military tank)
- pertahanan siber (cyber defense)
- angkatan laut (navy)
- angkatan udara (air force)

**English:**
- aircraft carrier
- military drone
- defense technology
- naval fleet
- fighter aircraft

---

## 📊 API Limits (Free Tier)

- **100 requests per day**
- **100 articles per request**
- **1 month historical data**
- **Updates every 15 minutes**

If you need more, upgrade at: https://newsapi.org/pricing

---

## 🔄 Restarting the Server

If you need to restart:

1. Press **Ctrl+C** in the terminal
2. Run **`npm run dev`** again

---

## 📦 Building for Production

When ready to deploy:

```bash
npm run build
```

This creates a `dist/` folder with optimized files.

---

## 🌐 Deploy to Vercel (Free)

1. Push code to GitHub
2. Go to **vercel.com**
3. Click "Import Project"
4. Select your repository
5. Add Environment Variable:
   - Name: `VITE_NEWS_API_KEY`
   - Value: Your API key
6. Click "Deploy"

Done! Your app is live! 🎉

---

## 📚 Learn More

- **Full Documentation**: See `README.md`
- **Detailed Setup**: See `SETUP_INSTRUCTIONS.md`
- **NewsAPI Docs**: https://newsapi.org/docs

---

## 💡 Tips

1. **Save your searches**: Add feature to save favorite keywords
2. **Bookmark articles**: Add local storage to save interesting articles
3. **Share**: Add social media share buttons
4. **Dark mode**: Toggle between light/dark themes

---

**Need help?** Check the console (F12) for detailed error messages!

**Enjoy your Military Info app!** 🎖️
