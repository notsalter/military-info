# Security status

## Repository containment

Malicious files were removed from the development tree in containment commit `aea679c` after private evidence preservation. The hostile remote workflows were disabled. The user approved application repairs and work toward deployment through the existing Vercel Git integration.

The removed material included a hostile editor task, a disguised executable asset, and hostile workflow definitions. Do not restore them, execute instructions from an older checkout, or publish private incident evidence. Removing files from the current tree does not remove them from older checkouts or repository history.

`npm run test:safety` checks the known artifact paths and selected unsafe workflow patterns. A pass means those specific checks passed; it is not a complete malware scan or proof of incident recovery.

## Unresolved exposure

Exposure of previously used computers and credentials remains unresolved. This project does not establish that affected devices are clean, that credentials were not accessed, or that keys, tokens, passwords, and sessions have been rotated or revoked.

Before entering new credentials or deploying from an affected device, assess that device and the accounts it could access. Perform any necessary revocation or rotation from a trusted device and verify it at the provider. Keep those recovery results separate from repository test results. Do not put credentials, request logs containing tokens, or private evidence in issues, commits, screenshots, or deployment logs.

## Current application's privacy limits

Public RSS mode needs no provider API key. On Vercel, a fixed-registry function requests publisher feeds; local static previews fall back to browser requests to feed services and publishers. Publisher images are still requested by the browser. Optional NewsAPI and TheNewsAPI keys are stored unencrypted in `localStorage` and sent directly to their providers, not through the feed function. Same-origin scripts, permitted browser extensions, and browser/device access can expose them. Removing keys in Settings clears local values only; it does not revoke the credentials.

Do not embed provider keys in `VITE_*` variables or public build files. Bookmarks and cached previews are also local browser data, not encrypted account storage. Clear site data on a shared browser when appropriate, knowing that it also removes saved articles.

See [setup](../SETUP_INSTRUCTIONS.md) for verification and deployment checks. Unit tests, browser tests, a clean build, and a successful deployment each answer different questions; none alone closes this incident.
