# 🚀 Deployment Guide - Military Info

## Quick Deploy to Vercel (Recommended)

### Option 1: Deploy from GitHub

1. **Push to GitHub** (see instructions below)
2. Visit [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add Environment Variable:
   - **Name**: `VITE_NEWS_API_KEY`
   - **Value**: Your NewsAPI key
7. Click "Deploy"

### Option 2: Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variable
vercel env add VITE_NEWS_API_KEY

# Deploy to production
vercel --prod
```

---

## Deploy to Netlify

### Option 1: Drag & Drop

1. Build the project:
   ```bash
   npm run build
   ```

2. Go to [app.netlify.com](https://app.netlify.com)
3. Drag the `dist/` folder to Netlify
4. Go to Site Settings → Environment Variables
5. Add `VITE_NEWS_API_KEY` with your API key
6. Redeploy

### Option 2: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod --dir=dist

# Add environment variable
netlify env:set VITE_NEWS_API_KEY "your_api_key_here"
```

---

## Deploy to GitHub Pages

1. Install gh-pages:
   ```bash
   npm install -D gh-pages
   ```

2. Update `vite.config.js`:
   ```javascript
   export default defineConfig({
     plugins: [react()],
     base: '/military-info/', // Your repo name
   })
   ```

3. Add deploy script to `package.json`:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```

4. Deploy:
   ```bash
   npm run deploy
   ```

5. Enable GitHub Pages in repository settings
6. **Note**: GitHub Pages doesn't support environment variables, so you'll need to use a different approach for the API key

---

## Pre-Deployment Checklist

- [ ] Test build locally: `npm run build && npm run preview`
- [ ] Verify .env is in .gitignore
- [ ] Update README with live demo URL
- [ ] Add your actual API key to deployment platform
- [ ] Test all features in production
- [ ] Check mobile responsiveness
- [ ] Verify CORS and API calls work

---

## Environment Variables

Make sure to set these on your deployment platform:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_NEWS_API_KEY` | Your NewsAPI.org API key | Yes |

Get your free API key: [newsapi.org/register](https://newsapi.org/register)

---

## Custom Domain (Optional)

### Vercel
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### Netlify
1. Go to Site Settings → Domain Management
2. Add custom domain
3. Update DNS records

---

## Monitoring & Analytics (Optional)

### Add Google Analytics

1. Create Google Analytics property
2. Add tracking code to `index.html`:
   ```html
   <!-- Google Analytics -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'GA_MEASUREMENT_ID');
   </script>
   ```

---

## Troubleshooting

### Build Fails
- Check all dependencies are installed
- Verify Node.js version (v18+)
- Clear node_modules and reinstall

### API Key Not Working
- Ensure environment variable is set on platform
- Variable must be prefixed with `VITE_`
- Redeploy after adding env variables

### 404 on Routes
- Single Page Apps need redirect rules
- Vercel: automatic
- Netlify: add `_redirects` file:
  ```
  /*    /index.html   200
  ```

---

## Performance Optimization

Already implemented:
- ✅ Vite code splitting
- ✅ Tailwind CSS purging
- ✅ React production build
- ✅ Gzip compression

---

**Ready to deploy!** Choose your platform and follow the steps above. 🚀
