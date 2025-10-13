# 🚀 Setup Instructions - Military Info

## Quick Start Guide

### Step 1: Install Dependencies

All dependencies are already installed. If you need to reinstall:

```bash
npm install
```

### Step 2: Get Your News API Key

1. Visit **[NewsAPI.org](https://newsapi.org/register)**
2. Fill out the registration form
3. Verify your email
4. Copy your API Key from the dashboard

### Step 3: Configure Environment Variables

1. Open the `.env` file in the root directory
2. Replace the empty value with your API key:

```env
VITE_NEWS_API_KEY=paste_your_api_key_here
```

**Example:**
```env
VITE_NEWS_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Step 4: Run the Application

Start the development server:

```bash
npm run dev
```

The application will open at: **http://localhost:5173**

### Step 5: Test the Application

1. Wait for the initial news to load
2. Try searching for specific keywords:
   - "kapal selam" (submarine)
   - "jet tempur" (fighter jet)
   - "pertahanan siber" (cyber defense)
   - "angkatan laut" (navy)
3. Click on any news card to open the full article

## Common Issues & Solutions

### ❌ API Key Error (401 Unauthorized)

**Symptoms:**
- Red error message appears
- "API Key tidak valid"

**Solutions:**
1. Double-check your API key in `.env`
2. Ensure there are no extra spaces
3. Restart the development server: `Ctrl+C` then `npm run dev`
4. Verify your API key at [NewsAPI Dashboard](https://newsapi.org/account)

### ❌ No Articles Showing Up

**Symptoms:**
- "Tidak ada artikel yang ditemukan"

**Solutions:**
1. Check your internet connection
2. Try different search keywords
3. Check if you've exceeded the 100 requests/day limit (free tier)
4. Open browser console (F12) to see detailed errors

### ❌ Tailwind Styles Not Working

**Symptoms:**
- Application looks unstyled
- No colors or layouts

**Solutions:**
1. Ensure `postcss.config.js` and `tailwind.config.js` exist
2. Restart the development server
3. Clear browser cache (Ctrl+Shift+R)

## Project Structure

```
src/
├── components/          # React components
│   ├── ArticleCard.jsx  # Individual article card
│   ├── ArticleGrid.jsx  # Grid layout for articles
│   ├── SearchBar.jsx    # Search input component
│   ├── Loading.jsx      # Loading spinner
│   └── ErrorMessage.jsx # Error display
├── services/
│   └── newsApi.js       # News API integration
├── App.jsx              # Main application
├── main.jsx             # Entry point
└── index.css            # Tailwind imports
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Building for Production

1. Build the application:
   ```bash
   npm run build
   ```

2. Test the production build:
   ```bash
   npm run preview
   ```

3. Deploy the `dist/` folder to your hosting service

## Deployment Options

### Option 1: Vercel (Easiest)

1. Push your code to GitHub
2. Visit [Vercel](https://vercel.com)
3. Import your GitHub repository
4. Add environment variable: `VITE_NEWS_API_KEY`
5. Deploy!

### Option 2: Netlify

1. Build the project: `npm run build`
2. Visit [Netlify](https://netlify.com)
3. Drag & drop the `dist/` folder
4. Add environment variable in Site Settings

## Features Implemented

✅ News feed from NewsAPI.org  
✅ Real-time search functionality  
✅ Responsive design (mobile, tablet, desktop)  
✅ Loading indicators  
✅ Error handling  
✅ Click to open full article  
✅ Professional UI with Tailwind CSS  
✅ Environment variables for API key security  

## Next Steps (Optional Enhancements)

- [ ] Add pagination for more articles
- [ ] Implement category filters (land, sea, air forces)
- [ ] Add bookmark/save functionality
- [ ] Dark mode toggle
- [ ] Share article on social media
- [ ] Offline support with Service Workers

## Need Help?

- **NewsAPI Documentation**: https://newsapi.org/docs
- **React Documentation**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Vite Documentation**: https://vite.dev

## AI-Assisted Development

This project was developed with AI assistance for:
- API integration patterns
- State management implementation
- Component architecture
- Error handling strategies
- Responsive design with Tailwind CSS

All AI-assisted code sections are documented in the source files with comments.

---

**Happy Coding!** 🎖️
