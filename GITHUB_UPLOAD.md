# 📦 GitHub Upload Guide - Military Info

## Step-by-Step Instructions to Upload to GitHub

### 1️⃣ Create a New Repository on GitHub

1. Go to [github.com](https://github.com)
2. Click the **+** icon → **New repository**
3. Fill in:
   - **Repository name**: `military-info`
   - **Description**: `Modern military and defense news aggregator Command Center featuring 21 RSS channels, in-app keys encryption, and local cache controls.`
   - **Visibility**: Public (or Private if preferred)
   - ⚠️ **DO NOT** initialize with README, .gitignore, or license (we already have these)
4. Click **Create repository**

### 2️⃣ Initialize Git in Your Project

Open PowerShell in your project directory:

```powershell
cd C:\Users\notsalter\Downloads\MilitaryInfo
```

Initialize Git (if not already initialized):

```bash
git init
```

### 3️⃣ Add All Files to Git

```bash
# Add all files
git add .

# Check status (optional)
git status
```

### 4️⃣ Create Initial Commit

```bash
git commit -m "Initial commit: Military Info news aggregator

- React 19 + Vite 7 + Tailwind CSS 3
- NewsAPI integration
- Responsive design
- Search functionality
- AI-assisted development
- Complete documentation"
```

### 5️⃣ Connect to GitHub Repository

Replace `YOUR_USERNAME` with your actual GitHub username:

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/military-info.git

# Verify remote
git remote -v
```

### 6️⃣ Push to GitHub

```bash
# Push to main branch
git push -u origin main
```

If you get an error about `master` vs `main`:

```bash
# Rename branch to main
git branch -M main

# Push again
git push -u origin main
```

### 7️⃣ Verify Upload

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/military-info`
2. Check that all files are uploaded
3. Verify README.md displays correctly

---

## 🔒 Security Check Before Upload

**CRITICAL**: Make sure these are in `.gitignore`:

- ✅ `.env` (contains API key)
- ✅ `node_modules/`
- ✅ `dist/`

Verify:

```bash
# Check .gitignore
cat .gitignore

# Verify .env is not being tracked
git status
```

If `.env` appears in `git status`, it means it's being tracked. Remove it:

```bash
git rm --cached .env
git commit -m "Remove .env from tracking"
```

---

## 📝 After Upload - Repository Settings

### Add Topics

1. Go to repository page
2. Click **⚙️ Settings** next to About
3. Add topics:
   - `react`
   - `vite`
   - `tailwindcss`
   - `news-aggregator`
   - `military-news`
   - `newsapi`
   - `defense-news`

### Update Description

Add to the repository description:
```
🎖️ Modern military and defense news aggregator built with React, Vite, and Tailwind CSS. Real-time news from NewsAPI.
```

### Add Website URL (After Deployment)

After deploying to Vercel/Netlify, add the live URL to:
- Repository Settings → Website

---

## 🚀 Next Steps After Upload

1. **Deploy to Vercel/Netlify** (see DEPLOYMENT.md)
2. **Add deployment badge** to README:
   ```markdown
   [![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](https://your-app.vercel.app)
   ```
3. **Update README** with live demo link
4. **Share your project** with the community!

---

## 📋 Files Uploaded to GitHub

### Main Files
- ✅ `README.md` - Main documentation
- ✅ `package.json` - Dependencies
- ✅ `LICENSE` - MIT License
- ✅ `.gitignore` - Ignore rules
- ✅ `.env.example` - Environment template

### Source Code
- ✅ `src/` - React components & services
- ✅ `public/` - Static assets
- ✅ `index.html` - HTML template

### Configuration
- ✅ `vite.config.js` - Vite config
- ✅ `tailwind.config.js` - Tailwind config
- ✅ `postcss.config.js` - PostCSS config
- ✅ `eslint.config.js` - ESLint config

### Documentation
- ✅ `QUICK_START.md` - Quick start guide
- ✅ `SETUP_INSTRUCTIONS.md` - Setup guide
- ✅ `DEPLOYMENT.md` - Deployment guide
- ✅ `AI_DEVELOPMENT_LOG.md` - AI contribution log
- ✅ `PRESENTATION_GUIDE.md` - Presentation guide
- ✅ `CONTRIBUTING.md` - Contribution guidelines
- ✅ `GITHUB_UPLOAD.md` - This guide

### NOT Uploaded (in .gitignore)
- ❌ `.env` - Your API key (secret!)
- ❌ `node_modules/` - Dependencies
- ❌ `dist/` - Build output
- ❌ `package-lock.json` (optional to include)

---

## 🔄 Making Updates Later

After initial upload, to push changes:

```bash
# Check what changed
git status

# Add changes
git add .

# Commit with message
git commit -m "Description of changes"

# Push to GitHub
git push
```

---

## 🆘 Troubleshooting

### Permission Denied

If you get authentication errors:

1. Use GitHub CLI (recommended):
   ```bash
   gh auth login
   ```

2. Or use Personal Access Token:
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate new token with `repo` scope
   - Use token as password when pushing

### Large Files Warning

If you accidentally try to upload large files:

```bash
# Remove from git
git rm --cached <file>

# Add to .gitignore
echo "<file>" >> .gitignore

# Commit
git commit -m "Remove large file"
```

---

## ✅ Upload Checklist

Before pushing to GitHub:

- [ ] Verified `.env` is in `.gitignore`
- [ ] Tested build: `npm run build`
- [ ] Removed any sensitive data from code
- [ ] Updated README with correct information
- [ ] Checked all documentation files
- [ ] Verified license is appropriate
- [ ] All files are committed

---

**You're ready to upload!** 🚀

Run the commands above and your project will be live on GitHub!
