# Contributing to opensalestax-square

Thanks for your interest. Bug reports, fixes, and well-scoped features
are welcome.

## Developer Certificate of Origin (DCO)

Every commit must carry a DCO sign-off:

```bash
git commit -s -m "your message"
```

The `-s` flag appends a `Signed-off-by: Name <email>` trailer asserting
your right to contribute under the project license. PRs without DCO
sign-off on every commit will not be merged.

## No AI co-author trailers

Do not add `Co-Authored-By:` trailers attributing AI assistants
(Claude, Copilot, ChatGPT, etc.). Human authors take responsibility
for their contributions.

## License

By contributing, you agree your contribution is dual-licensed under
your choice of Apache-2.0 OR GPL-2.0-or-later (see `LICENSE`).

## Branching model

Single-branch (`main`); semver tags `vX.Y.Z` mark releases.
Open feature/fix PRs against `main`.

## Quality gate

Before opening a PR, run:

```bash
npm run check
```

This runs lint, type check, tests, and `npm audit --omit=dev
--audit-level=high`. PRs that fail CI cannot merge.

## Style

- TypeScript strict mode; no `any` without an inline justification
  comment
- SPDX header (`// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later`) on every
  source file
- JSDoc on every exported function / class
- Structured logging only — never log customer addresses, product
  names, customer email, or full order payloads

## Reporting bugs

Open a GitHub issue with: Square REST API version (date string),
library version, OST engine version, the failing scenario, and the
relevant log lines (with PII scrubbed).

## Reporting security issues

See `SECURITY.md` — do not open a public issue.
