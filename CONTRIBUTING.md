# Contributing to Military Info

Report bugs with the tested revision, URL, reproduction steps, and expected and actual behavior. Check existing issues first. Do not attach keys, cookies, or secret-bearing request logs.

## Development

Read [Setup and deployment](SETUP_INSTRUCTIONS.md) for the Node requirement and commands, and [Security status](docs/SECURITY.md) before using an older checkout. Work in a focused branch. Install the locked dependencies without lifecycle scripts; no `.env` file is needed.

For each behavior change, add a regression test, observe its expected failure, then implement and rerun it. Keep test-only headlines visibly labeled and block external requests in browser fixtures. Do not add invented news or timestamps to production behavior. Preserve the 250-character snippet policy and publisher links; never embed provider keys in source or `VITE_*` settings.

## Before a pull request

Run `npm run verify` and `npm audit --audit-level=moderate`. Check search, filters, saved articles after reload, loading/empty/error states, images, storage failures, dialogs, keyboard focus, and narrow layouts. Deterministic fixture tests do not establish live-feed health. Record exact results and untested limits in the PR.

Review and stage only intended files, retain the lockfile, and keep private evidence outside the repository. Use focused commits; no history rewriting. Read back remote checks on the PR head before release, and verify the deployed revision separately. Be specific and respectful in code review.
