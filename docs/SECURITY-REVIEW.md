# Security Review — opensalestax-square v0.1.0-alpha.1

> Threat model + mitigations for the initial alpha. Reviewed and locked
> 2026-05-13.

## Trust model

- **Process trust:** the library runs inside the merchant's own
  service (e.g. their Node.js order-finalization worker). Whatever
  code imports the library already has access to Square API keys
  and the merchant's customer data.
- **Inputs treated as trusted:** `OpenSalesTaxClient` constructor
  args; `SquareOrder` / `SquareInvoice` objects passed in by the
  caller.
- **Inputs treated as untrusted (theoretical):** none — the library
  has no public HTTP surface and no direct end-user input.
- **Outbound network:** only to the configured engine URL. No
  Square API calls. No callbacks. No telemetry.

## Threats and mitigations

### T1 — SSRF via attacker-controlled `baseUrl`

**Scenario:** the merchant's service accepts a tenant-supplied
OpenSalesTax URL (e.g. multi-tenant SaaS); an attacker registers a
tenant with `baseUrl: http://169.254.169.254/latest/meta-data/` to
exfiltrate AWS instance-metadata credentials.

**Mitigation:** `validateEngineUrl()` runs in the
`OpenSalesTaxClient` constructor:

- URL parse — rejects unparseable strings.
- Scheme allowlist — only `http:` and `https:`. `file:`,
  `javascript:`, `gopher:`, `data:`, etc. are rejected.
- Private-network blocklist (default-on): loopback (`127.0.0.0/8`,
  `::1`), RFC-1918 (`10.0.0.0/8`, `172.16.0.0/12`,
  `192.168.0.0/16`), link-local (`169.254.0.0/16`, `fe80::/10`),
  unique-local (`fc00::/7`), wildcard (`0.0.0.0`).
- DNS rebinding is **out of scope** for this defense — the engine
  URL is configured by the merchant in their own process, not by
  end users. Multi-tenant SaaS callers should validate tenant
  input ahead of construction.

**Residual risk:** opt-in `allowPrivate: true` lifts the
blocklist. Documented in the README; merchants must consciously
enable it.

### T2 — Outbound request smuggling / SSRF via path traversal in engine URL

**Scenario:** an attacker provides `baseUrl: https://innocent.example.com/../admin`
hoping URL normalization produces a different effective target.

**Mitigation:** the library only appends fixed paths
(`/v1/calculate`, `/v1/health`) and uses Node's `fetch`, which
follows WHATWG URL semantics — `..` segments are resolved at parse
time, so the effective host stays fixed even if the path component
contains traversal characters.

### T3 — Credential leak via timing on `apiKey`

**Scenario:** the optional `X-API-Key` header is the engine's
shared secret. If the library hashed or echoed it in a side channel
(logs, error messages), an attacker reading those channels could
recover it.

**Mitigation:** `apiKey` is only used as the `X-API-Key` header
value. It is never logged, never echoed in error messages, never
included in cache keys, never exposed on the result object.

### T4 — Engine response confusion (parsed as control flow)

**Scenario:** a compromised engine returns a malicious response
that, when consumed by the library, triggers prototype pollution or
unexpected mutation.

**Mitigation:** the library only reads documented response fields
(`subtotal`, `tax_total`, `lines[]`, `jurisdictions[]`). It never
spreads the entire response, never uses `Object.assign` with
attacker-controlled keys, and never `eval`s anything. The library
shape is plain data assembled via direct property reads.

### T5 — ReDoS via crafted ZIP / postal_code

**Scenario:** an attacker provides a pathologically long
postal_code that triggers exponential regex backtracking on the
ZIP validator.

**Mitigation:** the only regex is `/^\d{5}(-\d{4})?$/`, which is
linear (no nested quantifiers, no alternation overlaps). The URL
parser also avoids quantified-trailing-slash regexes (the client
trims trailing slashes with a `while` loop per Sonar's S5852).

### T6 — Cache key collision leaking tax data across tenants

**Scenario:** a multi-tenant caller shares a single library
instance; the in-memory cache key collides and tenant A sees tenant
B's tax result.

**Mitigation:** the cache key is SHA-256 over the canonicalized
{ZIP, country, line_items} tuple. SHA-256 collisions are not
practical. Cache values are pure tax math — they don't carry
customer / tenant identifiers, so even a collision exposes only
tax math, not PII. Merchants who want strict per-tenant isolation
should pass `cache: false` or a tenant-keyed `CacheLike`.

### T7 — Untrusted Square SDK object triggers TypeError → uncaught rejection

**Scenario:** Square SDK returns a malformed object (missing fields
the library expects to read). The library throws an uncaught
TypeError that crashes the calling process.

**Mitigation:** every field read uses optional-chaining and
explicit-type guards. The library throws **only** documented error
classes (`MissingAddressError`, `MissingOrderError`, `NonUSDError`,
`UnsupportedSourceError`). Tests cover malformed inputs.

### T8 — Sensitive PII (customer addresses, names, emails) leaked via logs

**Scenario:** the library logs customer addresses at debug level;
those logs get shipped to a third-party log aggregator the merchant
forgot to scrub.

**Mitigation:** the library does no logging at all (no `console.*`,
no logger injection). Error messages reference object IDs and
high-level shapes only; raw addresses / names / emails are never
embedded in error strings.

### T9 — Timing side-channel reveals whether a ZIP is in the engine database

**Scenario:** an attacker observes response latency to infer
whether a probed ZIP exists.

**Mitigation:** out of scope for the library — this is a property
of the engine, not the connector. The engine treats all ZIP lookups
uniformly per its own constitution.

### T10 — Tax calculation passed off as legal / tax advice

**Scenario:** an end user relies on the library's output for a
real-money remittance and the calculation is wrong (rate data is
stale, jurisdiction is misclassified, etc.).

**Mitigation:** every `TaxCalculationResult.disclaimer` carries
the calculation-only disclaimer text. Every error message includes
the disclaimer. The README, CHANGELOG, and JSDoc all repeat the
disclaimer. Constitution §10 enforces this across all connectors.

### T11 — Engine takes too long and ties up the caller's request

**Scenario:** a slow / hung engine causes the caller's HTTP
request to time out at a layer above the library, exhausting
worker threads.

**Mitigation:** the client enforces a per-request `timeoutMs`
(default 5s) via `AbortController`. Engine-error responses
fail-soft (return a `skippedReason: 'engine_error'` result, log
nothing) unless the caller opts into `failHard: true`.

### T12 — Supply-chain attack via a compromised transitive dependency

**Scenario:** an attacker compromises one of the dev-dependency
packages and ships malicious code into the published bundle.

**Mitigation:** zero runtime dependencies. All deps are dev-only
(jest, eslint, etc.) and never reach the published `dist/`.
Production audit (`npm audit --omit=dev --audit-level=high`) is
required in CI. NPM Trusted Publishing (OIDC + provenance) prevents
unauthorized tagged releases.

## Out of scope

- DNS rebinding against the engine URL (engine is operator-controlled
  in v0.1; revisit if multi-tenant SaaS callers emerge).
- Side-channel attacks based on engine response timing.
- Resource exhaustion via huge line_items arrays — Square caps order
  size; the library does not impose its own cap.
- The merchant's tax-correctness obligations — see the calculation-only
  disclaimer.

## Review log

- 2026-05-13: initial threat model written alongside v0.1.0-alpha.1 ship.
  All 12 threats have implemented mitigations.
