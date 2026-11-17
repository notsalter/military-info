# Setup and deployment

## Prerequisites

Use Node.js **22.12.0 or later**, npm, and a reviewed checkout of this repository. Use **24.x** in Vercel's project settings. Before using a checkout from before containment commit `aea679c`, read [Security status](docs/SECURITY.md). Do not execute instructions or editor tasks from an older checkout.

## Local development

From the repository directory:

```bash
node --version
npm ci --ignore-scripts
npm run dev
```

Open the URL printed in the terminal, usually `http://localhost:5173`. The install command avoids dependency lifecycle scripts. Do not enable scripts blindly if an installation later requires one; review the dependency and the exact script first.

Public feeds require no keys and no `.env` file. The existing `.env.example` keeps legacy fields blank; the app does not read them. Browser-facing `VITE_*` variables are not a secret store.

Optional provider keys belong only in **Settings → Save keys**. They persist unencrypted in that browser and are sent to the chosen provider. **Remove keys** returns to public-feed operation. Removing a stored key does not revoke it at the provider. Avoid keys on shared or incident-affected devices.

## Commands and verification

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite for local development. |
| `npm run test:safety` | Check for the known hostile artifacts and selected unsafe workflow patterns. This is not a complete malware or credential audit. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run Vitest service and component tests once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run build` | Build the static site into `dist/`. |
| `npm run preview` | Serve the existing production build locally. |
| `npm run test:browser` | Run Playwright against a previously built `dist/`; Chromium and the suite configuration are required. |
| `npm run verify` | Run safety checks, lint, Vitest, build, then browser tests, stopping on failure. |

Use the installed Playwright CLI to install the Chromium binary if needed:

```bash
npm exec -- playwright install chromium
npm run verify
```

Browser installation needs network access and may require system libraries. Do not treat a missing browser, missing suite, or skipped check as a pass. A build alone does not verify browser behavior, feed availability, deployment success, or incident recovery.

Service and component tests mock requests and use small test fixtures, so they do not need live feeds or provider keys. The Playwright suite also intercepts feed requests with labeled fixtures and blocks other external requests. It starts Vite preview against the built `dist/`; build first when running `npm run test:browser` on its own. Fixture headlines are test data, not real reports or a production fallback. Browser QA must check loading, empty/error states, search, filters, pagination, bookmarks, dialogs and keyboard focus, broken images, storage failure, and narrow-screen layouts. Check live feed behavior separately on the deployed origin because CORS and quotas can differ. Record actual results rather than copying test counts from an earlier run.

To inspect the built site manually:

```bash
npm run build
npm run preview
```

## Deploy through the existing Vercel Git integration

Use the existing linked Vercel project rather than creating a second repository, a new deployment workflow, or a paid service.

1. Review the repaired branch and run the verification commands. Keep unresolved failures visible.
2. In the linked Vercel project, confirm the Git repository, root directory, and intended preview/production branch.
3. Select the **Vite** framework preset, Node.js **24.x**, install command `npm ci --ignore-scripts`, build command `npm run build`, and output directory `dist`. Leave provider API keys out of project environment variables.
4. After approval, push the reviewed branch through the normal Git process. The integration creates a preview deployment; use the project's existing production-branch process for release.
5. Read the deployment log and inspect the resulting URL. Check keyless loading and honest failure states, source links, saved articles after reload, dialogs and keyboard use, mobile layout, and absence of credentials in public assets.

These steps describe deployment, not a claim that deployment has succeeded. Safety tests and Vercel's build do not resolve historical device or credential exposure.

## Troubleshooting

- **Unsupported Node version:** compare `node --version` with the requirement before reinstalling dependencies.
- **No articles:** open **Sources**, reset filters, or retry. Public feeds can return empty results, time out, reject CORS, or be rate-limited. No synthetic stories are inserted.
- **Old snippets:** check the stale notice, then use **Clear news cache**. Clearing cannot bypass a provider's rate limit.
- **Saved changes fail:** browser storage may be blocked or full. Saved articles and keys are local to that origin and browser; clearing site data removes them.
- **API requests fail:** provider quotas, key validity, plan restrictions, and browser CORS rules still apply. Prefer keyless mode; do not work around this by embedding keys in the deployment.
