# GitHub updates

This project already lives at [notsalter/military-info](https://github.com/notsalter/military-info). Use a focused branch and pull request, not a new repository or a rewritten history.

Read [Contributing](CONTRIBUTING.md), run the real [verification commands](SETUP_INSTRUCTIONS.md#commands-and-verification), and stage only the intended files. Keep the dependency lockfile committed. Never include provider keys, private evidence, or secret-bearing reports. `.gitignore` does not protect secrets compiled through `VITE_*` variables.

Read back the exact remote branch and PR head after pushing. Check CI on that revision before merging. The existing Vercel integration handles deployment; publishing a commit is not proof that production serves it. See [Deployment](DEPLOYMENT.md) and [Security status](docs/SECURITY.md).
