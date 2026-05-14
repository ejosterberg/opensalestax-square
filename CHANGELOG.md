# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
