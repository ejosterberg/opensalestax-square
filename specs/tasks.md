# Tasks — opensalestax-square v0.1.0-alpha.1

> Executed top-to-bottom in one session.

## Phase 1 — Bootstrap

- [x] Init git repo (main branch)
- [x] Copy Apache 2.0 LICENSE
- [x] Write `specs/spec.md`, `plan.md`, `tasks.md`
- [x] `package.json` — `@ejosterberg/opensalestax-square@0.1.0-alpha.1`,
      Node ≥20, ESM
- [x] `tsconfig.json` + `tsconfig.build.json`
- [x] `jest.config.js`
- [x] `.eslintrc.json`, `.prettierrc`, `.editorconfig`, `.gitignore`
- [x] `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`
- [x] `sonar-project.properties`
- [x] `.github/workflows/ci.yml`, `release.yml`
- [x] `.github/PULL_REQUEST_TEMPLATE.md`

## Phase 2 — Implement

- [x] `src/types.ts` — minimal Square shapes
- [x] `src/url-validator.ts` — SSRF guard
- [x] `src/client.ts` — embedded OpenSalesTaxClient (fetch-based)
- [x] `src/errors.ts` — typed errors
- [x] `src/gates.ts` — USD / US / ZIP gates
- [x] `src/address.ts` — Square Order/Invoice → ZIP
- [x] `src/lines.ts` — Square line_items → engine line_items
- [x] `src/cache.ts` — in-memory LRU
- [x] `src/result.ts` — TaxCalculationResult builder
- [x] `src/calculate-order.ts`
- [x] `src/calculate-invoice.ts`
- [x] `src/index.ts` — public exports

## Phase 3 — Tests (≥30)

- [x] `tests/client.test.ts`
- [x] `tests/url-validator.test.ts`
- [x] `tests/gates.test.ts`
- [x] `tests/address.test.ts`
- [x] `tests/lines.test.ts`
- [x] `tests/cache.test.ts`
- [x] `tests/calculate-order.test.ts`
- [x] `tests/calculate-invoice.test.ts`
- [x] `tests/result.test.ts`

## Phase 4 — Quality gates

- [x] `npm install` clean
- [x] `npm run lint` — 0 errors
- [x] `npm run typecheck` — clean
- [x] `npm test` — all green, coverage ≥85% line / ≥75% branch
- [x] `npm audit --omit=dev --audit-level=high` — 0 findings
- [x] Live smoke against engine `10.32.161.126:8080` documented
- [x] SonarQube scan — 0/0/0/0
- [x] `docs/SECURITY-REVIEW.md` (≥10 threats)
- [x] `docs/INTEGRATION-CHECK.md`

## Phase 5 — Ship

- [x] First commit with DCO sign-off
- [x] `gh repo create ejosterberg/opensalestax-square --public --source . --push`
- [x] `git tag -a v0.1.0-alpha.1`
- [x] `gh release create v0.1.0-alpha.1 --prerelease`
- [x] `npm publish --access public` (or document deferral)
- [x] GitHub topics: square, typescript, sales-tax, opensalestax, tax-calculation, library
