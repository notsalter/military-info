# Deployment

Use [Setup and deployment](SETUP_INSTRUCTIONS.md#deploy-through-the-existing-vercel-git-integration) for the current Vercel process and [Security status](docs/SECURITY.md) before deploying an older checkout.

The repository is already linked to its Vercel project. Do not create a replacement project or put provider keys in `VITE_*` variables: these values are public in browser builds.

A static `dist/` preview can check the UI, but does not run the same-origin feed function. Verify the function and real source responses on the deployed origin separately. A successful build does not establish deployment success or recovery from the historical security incident.
