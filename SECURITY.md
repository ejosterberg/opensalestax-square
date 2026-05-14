# Security Policy

## Reporting a vulnerability

Email **ejosterberg@gmail.com** with subject line starting
`[opensalestax-square] security:`. Include affected version,
reproduction steps, and impact. Do not open a public GitHub issue for
security reports.

Acknowledgement target: 7 days. Critical issues (tax-correctness or
merchant-data access): mark `[critical]` in subject, expect faster
turnaround.

## Supported versions

Latest minor on `main`. Older releases are not back-patched.

## Threat model

This library runs in-process inside the caller's Node.js service. It
exposes **no inbound HTTP routes**. The trust boundary is the caller's
own process; whatever code loaded the library is already trusted with
the merchant's Square API key.

Library configuration comes from two trusted sources:

1. The `OpenSalesTaxClient` constructor arguments (`baseUrl`,
   `apiKey`, `timeoutMs`, `allowPrivate`).
2. The caller-supplied Square `Order` / `Invoice` objects passed to
   `calculateForSquareOrder` / `calculateForSquareInvoice`.

Both are treated as developer-controlled (not end-user input). The
library validates `baseUrl` at client construction time: URL parse +
scheme allowlist (`http:` / `https:`) + private-network blocklist
(loopback, RFC-1918, IPv6 link-local / unique-local). The
`allowPrivate: true` opt-in lifts the private-network blocklist for
dev / on-prem deployments.

See `docs/SECURITY-REVIEW.md` for the full per-threat matrix.

If you find a path that violates these guarantees, please report it
via the email above.
