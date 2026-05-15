# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-15

Graduate alpha → stable. No code changes vs `0.1.0-alpha.2` (already
production-quality: 77 Jest tests, all CI green across the alpha
cycle, SDK-backed since alpha.2). Cuts the `-alpha` suffix and
promotes to `latest` on npm.

### Notes

- Public API surface is the v0.1 shape locked in
  `specs/spec.md`. Future minor versions can extend; breaking changes
  require a major bump per SemVer.
- Webhook handler (Shape 2 from spec.md) remains v0.2 scope.

## [0.1.0-alpha.2] - 2026-05-14

Drop the embedded `OpenSalesTaxClient` + `validateEngineUrl` in favor
of the standalone `@ejosterberg/opensalestax` SDK (v0.1.0+).
Constitution §6 / playbook trigger ("extract when a third TS
connector lands" — we have four).

No behavior change for consumers of this library. The HTTP wire
contract with the OpenSalesTax engine is identical; the SSRF
defense + URL validator port verbatim into the SDK.

### Changed
- Depend on `@ejosterberg/opensalestax@^0.1.0` instead of the
  embedded `src/client.ts` + `src/url-validator.ts`.
- Property accesses moved to the SDK's camelCase TS surface:
  `rate_pct` → `ratePct`, `tax_total` → `taxTotal`.
- Internal `CalculateRequest` / `CalculateResponse` /
  `CalculateLineItem` types replaced by `Address` / `LineItem` /
  `CalculationResult`.
- Error class rename: `OpenSalesTaxApiError` (with `.status`) →
  `OpenSalesTaxAPIError` (with `.statusCode`).
- `src/index.ts` re-exports the SDK's public surface
  (`OpenSalesTaxClient`, `OpenSalesTaxAPIError`,
  `OpenSalesTaxNetworkError`, `UrlValidationError`,
  `validateEngineUrl`, `Address`, `LineItem`,
  `CalculationResult`, etc.) so downstream consumers that
  imported from this library keep working with one rename.

### Removed
- `src/client.ts` and `src/url-validator.ts` — now in the SDK.
- `tests/client.test.ts` and `tests/url-validator.test.ts` — the
  SDK has its own test suite for these.

### Migration

For most consumers: no change. The library's public API
(`calculateForSquareOrder`, `calculateForSquareInvoice`) is
unchanged.

If your code imported types directly from this library, the only
load-bearing rename is the API error class:

```diff
-import { OpenSalesTaxApiError } from '@ejosterberg/opensalestax-square';
+import { OpenSalesTaxAPIError } from '@ejosterberg/opensalestax-square';
-} catch (e: OpenSalesTaxApiError) { console.log(e.status); }
+} catch (e: OpenSalesTaxAPIError) { console.log(e.statusCode); }
```

The library's `NonUSDError` (`(currency, sourceId)` constructor) is
unchanged. The SDK exports its own `NonUSDError` marker class with
a different signature; consumers importing `NonUSDError` from
THIS library get the original Square-domain class.

## [0.1.0-alpha.1] - 2026-05-13

### Added

- Initial alpha release. Server-side library only (Shape 1 per the
  spec); webhook handler is v0.2 work.
- `calculateForSquareOrder(order, client, options?)` — extracts the
  shipping ZIP from `Order.fulfillments[*].shipment_details.recipient.address`,
  builds engine line items from `Order.line_items[]`, calls
  OpenSalesTax `/v1/calculate`, returns a `TaxCalculationResult`.
- `calculateForSquareInvoice(invoice, client, options?)` — resolves
  the linked order via embedded `invoice.order` or
  `options.fetchOrder`; falls back to
  `invoice.primary_recipient.address` for the ZIP when the order
  has no shipping fulfillment.
- Embedded `OpenSalesTaxClient` (fetch-based, Node 20+) — no axios /
  node-fetch dependency. URL scheme allowlist + RFC-1918 blocklist
  for SSRF defense (`allowPrivate: true` opt-in for dev).
- In-memory LRU cache (500 entries, 24h TTL) keyed on
  ZIP + line bundle; merchants can opt out with `cache: false` or
  plug in their own `CacheLike` implementation.
- USD / US / ZIP gates with silent fall-through (zero-tax result +
  `skippedReason`, never throws on gate misses).
- Fail-soft on engine errors by default; opt-in `failHard: true`.
- Typed error classes: `MissingAddressError`, `MissingOrderError`,
  `NonUSDError`, `UnsupportedSourceError`, `OpenSalesTaxApiError`,
  `UrlValidationError`.
- Category mapping per `catalog_object_id` plus a `defaultCategory`
  fallback.
- 60+ Jest tests covering construction, SSRF, gating, address
  extraction, line extraction (incl. bigint money, ZIP+4, missing
  quantity, non-USD line currency), cache eviction + TTL, fail-soft
  vs fail-hard, and invoice→order resolution.
- `docs/SECURITY-REVIEW.md` (12-threat threat model).
- `docs/INTEGRATION-CHECK.md` (live engine smoke against the workshop
  engine at `10.32.161.126:8080`).
- GitHub Actions CI workflow (lint / typecheck / test+coverage /
  audit / build).
- GitHub Actions release workflow with npm Trusted Publishing
  (OIDC, provenance).
- Apache-2.0 license, DCO sign-off enforced via CONTRIBUTING.md.

### Known limitations (deferred to v0.2)

- No webhook handler — merchants must call the library themselves
  from order-finalization / invoice-issue code.
- No origin-based tax for in-person Square POS in TX / CA / IL etc.
- No standalone `opensalestax-js` SDK dependency — when the JS SDK
  v0.1 ships, the embedded client may be replaced with a thin
  re-export.
