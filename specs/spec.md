# Spec — opensalestax-square (v0.1)

> **Status:** Locked for v0.1.0-alpha.1 — open questions resolved below.
> **Public repo:** `ejosterberg/opensalestax-square`
> **NPM:** `@ejosterberg/opensalestax-square`
> **Last updated:** 2026-05-13

## Goal

Server-side TypeScript library that computes destination-based US sales tax
for **Square Orders** and **Square Invoices** by calling a self-hosted
OpenSalesTax engine. Modeled on the Stripe library (see hub constitution §8):
the caller already holds a `SquareOrder` / `SquareInvoice` they fetched via
Square's own SDK; this library extracts ZIP + line items, calls the engine,
and returns a structured breakdown the caller can write back via Square's
API.

## In scope (v0.1.0-alpha.1)

**Shape (1) — Server-side library:**

- `calculateForSquareOrder(order, client, options?)` — extracts the
  shipping address (or fulfillment recipient) ZIP + line items, calls
  OpenSalesTax `/v1/calculate`, returns a `TaxCalculationResult`.
- `calculateForSquareInvoice(invoice, client, options?)` — same shape,
  resolves to the linked `Order` if `invoice.order_id` is present and the
  caller passes an order resolver in `options`; otherwise honors a
  pre-attached `invoice.order` blob.
- Embedded `OpenSalesTaxClient` — minimal `fetch`-based HTTP wrapper
  (mirrors the Medusa connector). No standalone `opensalestax-js`
  dependency; the JS SDK isn't published yet.
- USD-only / US-only gates; fail-soft default; opt-in `failHard`.
- 24h in-memory LRU cache (keyed on ZIP + line-item hash); callers can
  disable with `cache: false` or supply their own implementation.
- Apache 2.0 + DCO + SPDX headers on every source file.

## Out of scope (deferred to v0.2)

- **Shape (2) — Webhook handler.** Verifying Square's HMAC-SHA1
  webhook signatures, listening for `order.created` / `invoice.created`,
  writing tax back via Square's REST API.
- Hard dependency on `squareup` SDK (we use `import type` only).
- Non-USD currencies (engine constitution §5).
- Tax filing / remittance (engine constitution §13).
- Square POS in-person origin-based tax handling (the v0.1 model is
  destination-based — see "Origin vs destination" below).
- Square Connect / multi-merchant flows.

## Resolved open questions

1. **Language: TypeScript.** Per spec recommendation; matches Vendure /
   Medusa / Saleor library shape. NPM is the primary registry; PyPI +
   Packagist are deferred follow-ons if demand surfaces.
2. **Origin vs destination address.** v0.1 uses the **destination
   address** — `Order.fulfillments[].shipment_details.recipient.address`
   for shipped orders, or `Invoice.primary_recipient` for billed
   invoices. In-person Square POS origin-based tax is out of scope.
3. **Order vs Invoice precedence in `calculateForSquareInvoice`.** If
   the caller provides `invoice.order` (pre-expanded), use it. Otherwise,
   if the caller passes `options.fetchOrder(orderId)`, use that. Otherwise,
   throw `MissingOrderError` — no implicit Square SDK calls.
4. **Webhook handler:** deferred to v0.2 (per spec).
5. **Square POS in-person:** out of scope for v0.1; documented limitation
   in README.

## User story

A Node.js SaaS or marketplace running on top of Square's REST API. After
fetching an `Order` via Square's SDK and before calling Square's
`UpdateOrder` (or `PayOrder`) endpoint, the integrator calls
`calculateForSquareOrder(order, ostClient)` to get a tax breakdown. They
then push that breakdown back into Square's `Order.taxes[]` array as
`AD_VALOREM` taxes scoped to the relevant line items.

## Integration shape

- **Plugin model:** Library — Square has no plugin model.
- **Distribution:** NPM, public, scoped under `@ejosterberg/*`.
- **Trust boundary:** library runs in the caller's process; the caller
  is already trusted with the Square API key.
- **Outbound HTTP:** only to the merchant-configured OpenSalesTax engine
  URL (scheme allowlist `http:` / `https:`, optional RFC-1918 block).
- **Tax-model touchpoints:** read-only against caller-supplied Square
  shapes; output is a pure value — the library never mutates the
  Square objects nor calls Square's API.

## Success criteria for v0.1.0-alpha.1

- `calculateForSquareOrder(testOrder, client)` returns a populated
  `TaxCalculationResult` for ZIP 55401 with a 100.00 line.
- 30+ Jest tests cover construction, gating, address extraction,
  jurisdiction mapping, fail-soft / fail-hard, cache, errors.
- Live smoke test against `http://10.32.161.126:8080` documented in
  `docs/INTEGRATION-CHECK.md`.
- SonarQube: 0 bugs / 0 vulnerabilities / 0 code smells / 0 hotspots.
- README explains install / configure / debug, including the
  calculation-only disclaimer (constitution §10).
- Apache 2.0 + DCO + SPDX header on every source file.
- Tag `v0.1.0-alpha.1`, GitHub release created, NPM publish attempted.

## License + conventions

- Apache 2.0; SPDX header on every file.
- DCO sign-off on every commit.
- No AI co-author trailers.
- TypeScript strict mode (`exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`).
- ESLint + Prettier; Jest with ts-jest.
- Semantic versioning; compatibility statement against tested
  OpenSalesTax + Square API versions in README.
