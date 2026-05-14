# Plan — opensalestax-square v0.1.0-alpha.1

> Implements `specs/spec.md`. Architecture and file layout for the
> initial TypeScript library.

## File layout

```
opensalestax-square/
├── src/
│   ├── index.ts            # public API surface (calculate* + types + errors)
│   ├── types.ts            # minimal Square shapes (Order, Invoice, LineItem, Address)
│   ├── client.ts           # embedded OpenSalesTaxClient
│   ├── url-validator.ts    # SSRF defense (scheme + RFC-1918 allow/deny)
│   ├── errors.ts           # typed error classes
│   ├── gates.ts            # USD / US / ZIP gates + helpers
│   ├── address.ts          # Square Order/Invoice → ZIP extraction
│   ├── lines.ts            # Square line_items → engine line_items
│   ├── cache.ts            # in-memory LRU (24h TTL, opt-out)
│   ├── calculate-order.ts  # calculateForSquareOrder
│   ├── calculate-invoice.ts# calculateForSquareInvoice
│   └── result.ts           # TaxCalculationResult shape + builder
├── tests/
│   ├── client.test.ts
│   ├── url-validator.test.ts
│   ├── gates.test.ts
│   ├── address.test.ts
│   ├── lines.test.ts
│   ├── cache.test.ts
│   ├── calculate-order.test.ts
│   ├── calculate-invoice.test.ts
│   └── result.test.ts
├── tools/
│   └── smoke-engine.ts     # live smoke against 10.32.161.126:8080
├── docs/
│   ├── SECURITY-REVIEW.md
│   └── INTEGRATION-CHECK.md
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── release.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── jest.config.js
├── .eslintrc.json
├── .prettierrc
├── .editorconfig
├── .gitignore
├── LICENSE
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
└── sonar-project.properties
```

## Public API

```ts
// src/index.ts
export { OpenSalesTaxClient, OpenSalesTaxApiError } from './client';
export { calculateForSquareOrder } from './calculate-order';
export { calculateForSquareInvoice } from './calculate-invoice';
export type {
  TaxCalculationResult,
  TaxCalculationLine,
  TaxJurisdiction,
  CalculationOptions,
  CalculateInvoiceOptions,
  CategoryByCatalogObjectId,
} from './result';
export type {
  SquareOrder,
  SquareInvoice,
  SquareLineItem,
  SquareAddress,
  SquareMoney,
  SquareFulfillment,
} from './types';
export {
  MissingAddressError,
  MissingOrderError,
  NonUSDError,
  UnsupportedSourceError,
} from './errors';
```

## Square shapes (`src/types.ts`)

Hand-rolled minimal interfaces — we accept Square's `Order` / `Invoice`
without depending on the `squareup` SDK. Only fields we read are typed.

```ts
export interface SquareMoney { amount?: number | bigint; currency?: string; }
export interface SquareAddress {
  address_line_1?: string;
  locality?: string;            // city
  administrative_district_level_1?: string; // state
  postal_code?: string;
  country?: string;             // ISO 3166-1 alpha-2
}
export interface SquareRecipient { address?: SquareAddress; }
export interface SquareShipmentDetails { recipient?: SquareRecipient; }
export interface SquareFulfillment {
  type?: string;
  shipment_details?: SquareShipmentDetails;
}
export interface SquareLineItem {
  uid?: string;
  catalog_object_id?: string;
  name?: string;
  quantity?: string;            // Square stringifies the quantity
  base_price_money?: SquareMoney;
  total_money?: SquareMoney;
  variation_total_price_money?: SquareMoney;
}
export interface SquareOrder {
  id?: string;
  location_id?: string;
  line_items?: SquareLineItem[];
  fulfillments?: SquareFulfillment[];
  net_amount_due_money?: SquareMoney;
  total_money?: SquareMoney;
}
export interface SquareInvoice {
  id?: string;
  order_id?: string;
  order?: SquareOrder;
  primary_recipient?: { address?: SquareAddress };
}
```

## Address extraction priority

1. `Order.fulfillments[].shipment_details.recipient.address.postal_code`
   — pick the first SHIPMENT-typed fulfillment with a postal code.
2. `Invoice.primary_recipient.address.postal_code` (only for the invoice
   path, when no order address is available).
3. **Else** throw `MissingAddressError`.

Address must also be `country === 'US'` (case-insensitive). ZIP must
match `^\d{5}(-\d{4})?$`; we slice to the first 5 digits.

## Line extraction

For each `Order.line_items[i]`:

1. Quantity `q = Number.parseFloat(line_items[i].quantity ?? '1')` —
   default to 1 if missing/blank.
2. Unit amount cents: prefer `base_price_money.amount`, fall back to
   `total_money.amount / q`. If neither resolvable → skip the line
   (logged).
3. Reject any line whose money currency is set and not `USD` → throw
   `NonUSDError` (entire calc aborts; never partial-tax a USD line
   while another line is foreign).
4. Decimal string format: cents → `"X.XX"` (integer-floor; no rounding
   beyond `Math.round`).
5. Category: `options.categoryByCatalogObjectId?.[id] ?? options.defaultCategory ?? 'general'`.

## Engine call

Single `POST /v1/calculate` with all line items (one engine call per
order). Square doesn't have per-line tax buckets like Stripe Tax Codes,
so all lines share the same address and the engine handles per-line
calculation in one round trip. This is also cache-friendly.

## Cache

`src/cache.ts`:

- In-memory LRU, default max 500 entries, default TTL 24h.
- Key: `sha256(json({zip5, line_items, country}))` — first 16 hex chars.
- `options.cache === false` disables; `options.cache === 'CacheLike'`
  swaps the implementation (e.g. for Redis wrappers).

## Gates

- `currencyCode` (or each line's `base_price_money.currency`) must be
  `USD`. The order's `total_money.currency` is checked first for early
  exit; per-line checks happen during line extraction.
- `country` resolved from the chosen address must be `US`.
- `postal_code` must match the ZIP regex.

If any gate fails, return a zero-tax result with `skippedReason`
populated — **don't throw**. (Constitution §8 — fail-soft.)

## Errors

`src/errors.ts`:

```ts
export class OpenSalesTaxApiError extends Error { /* status?: number */ }
export class MissingAddressError extends Error { }
export class MissingOrderError extends Error { }
export class NonUSDError extends Error { /* currency: string */ }
export class UnsupportedSourceError extends Error { }
```

The `client.ts` module re-exports `OpenSalesTaxApiError`; the rest are
domain-level and live in `errors.ts`.

## SSRF defense (`src/url-validator.ts`)

The `OpenSalesTaxClient` constructor calls
`validateEngineUrl(baseUrl, { allowPrivate?: boolean })`:

1. `new URL(baseUrl)` — must succeed.
2. `protocol` ∈ {`http:`, `https:`}.
3. If `allowPrivate !== true`:
   - Reject `localhost`, `127.0.0.0/8`, `::1`.
   - Reject RFC-1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
   - Reject link-local (`169.254.0.0/16`, `fe80::/10`).

Production deployments use the merchant's own engine, often on RFC-1918
in dev — so `allowPrivate: true` is supported but not the default.

## Calculation flow (calculate-order)

```
calculateForSquareOrder(order, client, options)
  ├─ gate: order.total_money.currency != null && !== 'USD' → return zero result with skipped='non_usd'
  ├─ extractAddress(order) → ZIP5 or throw MissingAddressError
  ├─ gate: country !== 'US' → zero result with skipped='non_us'
  ├─ gate: ZIP regex fails → zero result with skipped='invalid_zip'
  ├─ extractLines(order, options) → engine line_items[]
  ├─ if line_items empty → zero result with skipped='no_lines'
  ├─ cache lookup → return cached result if hit
  ├─ client.calculate({ address, line_items }) → engine response
  ├─ on error:
  │     - failHard → re-throw
  │     - default → return zero result with skipped='engine_error', engineError attached
  ├─ build TaxCalculationResult from response
  ├─ cache.set(key, result)
  └─ return result
```

## Disclaimer

The exact text appears in:
- `README.md` quickstart
- Every `TaxCalculationResult.disclaimer` (so callers that surface to
  end-users have the right text by default)
- Every error message JSON (constitution §10)
- JSDoc on `calculateForSquareOrder` + `calculateForSquareInvoice`

## Quality bar

- 30+ Jest tests across all modules
- Coverage ≥85% lines, ≥75% branches
- TS strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- ESLint clean
- `npm audit --omit=dev --audit-level=high` 0 findings
- SonarQube 0/0/0/0
- Live engine smoke test passes
