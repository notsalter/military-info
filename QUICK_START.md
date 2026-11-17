# Quick start

Use Node.js 22.12.0 or later and a reviewed checkout. Read [Security status](docs/SECURITY.md) before using an older checkout.

```bash
npm ci --ignore-scripts
npm run dev
```

Open the URL printed by Vite. No `.env` file or provider key is required. Local Vite serves the UI without the Vercel feed function, so keyless requests can be limited by converter quotas and publisher CORS. No fictional offline stories are inserted.

See [Setup and deployment](SETUP_INSTRUCTIONS.md) for tests, builds, troubleshooting, and the existing Vercel project. Optional keys entered in Settings remain plain text in that browser.
