# @ejosterberg/opensalestax-square

[![ci](https://github.com/ejosterberg/opensalestax-square/actions/workflows/ci.yml/badge.svg)](https://github.com/ejosterberg/opensalestax-square/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@ejosterberg/opensalestax-square.svg)](https://www.npmjs.com/package/@ejosterberg/opensalestax-square)
[![License: Apache-2.0 OR GPL-2.0-or-later](https://img.shields.io/badge/License-Apache_2.0_OR_GPL_2.0--or--later-blue.svg)](LICENSE)

Server-side TypeScript library that computes **destination-based US sales tax**
for **Square Orders and Invoices** via the self-hosted
[OpenSalesTax](https://github.com/ejosterberg/opensalestax) engine. No SaaS,
no per-transaction fees, no third-party API keys.

- Pure server-side functions — `calculateForSquareOrder` and
  `calculateForSquareInvoice` take an already-fetched Square object
  plus an engine client, and return a structured tax breakdown.
- **USD-only / US-only.** Non-USD or non-US orders return a zero-tax
  result with `skippedReason` populated; the caller falls through to
  whatever default behavior they like.
- **Fail-soft default.** If the OpenSalesTax engine is unreachable,
  the library returns zero tax + an `engineError` string. Opt into
  fail-hard via `options.failHard`.
- **No inbound HTTP surface.** Pure outbound calls to the configured
  engine URL. The library runs in the merchant's own process.
- **No `squareup` SDK dependency.** Library types Square shapes via
  hand-rolled interfaces — bring your own Square SDK or REST client.

> Tax calculations are provided as-is for convenience. The merchant is
> solely responsible for tax-collection accuracy and remittance to the
> appropriate jurisdictions. Verify against your state Department of
> Revenue before remitting.

## Compatibility

| Library | Square REST API | OST engine | Node |
|---------|-----------------|-----------|------|
| 0.1.x   | 2024-x+         | 0.22+ (v1 API) | 20+ |

## Install

```bash
npm install @ejosterberg/opensalestax-square
```

## Quickstart

```ts
import {
  calculateForSquareOrder,
  OpenSalesTaxClient,
  type SquareOrder,
} from '@ejosterberg/opensalestax-square';

// 1. Build a client. The constructor enforces a scheme allowlist
//    (http: / https:) and blocks loopback / RFC-1918 hosts unless
//    you explicitly opt in with `allowPrivate: true`.
const ostClient = new OpenSalesTaxClient({
  baseUrl: process.env.OSTAX_API_URL!, // e.g. "https://ost.your-domain.com"
  // apiKey: process.env.OSTAX_API_TOKEN, // optional X-API-Key
  // timeoutMs: 5000,                     // optional per-request timeout
});

// 2. Fetch the order via Square's SDK (or REST directly).
//    The shape below is illustrative; you'll typically just hand off
//    the SDK-returned object.
const order: SquareOrder = {
  id: 'ORDER_ID',
  line_items: [
    { uid: 'line_1', quantity: '1', total_money: { amount: 10000, currency: 'USD' } },
  ],
  fulfillments: [
    {
      type: 'SHIPMENT',
      shipment_details: {
        recipient: {
          address: { country: 'US', postal_code: '55401' },
        },
      },
    },
  ],
  total_money: { amount: 10000, currency: 'USD' },
};

// 3. Calculate.
const result = await calculateForSquareOrder(order, ostClient);

// 4. Apply to Square's order via UpdateOrder.
// result.taxTotal, result.lines[i].jurisdictions[j], etc.
```

For Square Invoices:

```ts
import { calculateForSquareInvoice } from '@ejosterberg/opensalestax-square';

const result = await calculateForSquareInvoice(invoice, ostClient, {
  // Optional — only needed if invoice.order isn't pre-attached.
  fetchOrder: async (id) => squareSdk.ordersApi.retrieveOrder(id).then((r) => r.order),
});
```

## Configuration

```ts
new OpenSalesTaxClient({
  baseUrl: 'https://ost.your-domain.com', // required, scheme allowlist enforced
  apiKey: 'optional-x-api-key',
  timeoutMs: 5000,                         // per-request, default 5000
  allowPrivate: false,                     // permit RFC-1918 / loopback, default false
});

await calculateForSquareOrder(order, client, {
  defaultCategory: 'general',              // default category when no mapping matches
  categoryByCatalogObjectId: {
    cat_id_shirt: 'clothing',
    cat_id_book:  'general',
  },
  failHard: false,                          // throw on engine errors instead of fail-soft
  cache: true,                              // true | false | CacheLike (default true)
});
```

## How it works

1. **Address resolution.** Reads the destination ZIP from the order's
   first SHIPMENT fulfillment (`Order.fulfillments[i].shipment_details.recipient.address`).
   For invoices, falls back to `Invoice.primary_recipient.address` if the
   linked order has no shipping fulfillment.
2. **Gating.** USD / US country / ZIP regex `^\d{5}(-\d{4})?$`. Any
   gate failure → zero-tax `TaxCalculationResult` with `skippedReason`.
3. **Line extraction.** Reads each `line_items[i].total_money.amount`
   (preferred), else `base_price_money.amount * quantity`. Lines with
   no resolvable amount are skipped. Any non-USD line currency aborts
   with `NonUSDError`.
4. **Engine call.** Single `POST /v1/calculate` per order. The
   response carries per-line and per-jurisdiction breakdowns.
5. **Caching.** In-memory LRU keyed on ZIP + line bundle; 24h TTL by
   default. Set `cache: false` to disable, or pass `cache: { get, set }`
   to plug in Redis / Memcached.

## Square POS in-person tax (origin-based)

The library uses **destination-based** tax — appropriate for online
orders and shipped goods. In-person Square POS transactions in some
states (TX, CA, IL) follow **origin-based** tax sourced from the seller
location, not the destination. v0.1 does not handle this case; if your
business is brick-and-mortar POS exclusively, this library may not be
the right fit. v0.2+ may add origin-mode support — open an issue if
you want it.

## What this library does NOT do

By design (engine constitution §13 + this repo's spec):

- **Filing or remittance.** It computes tax. You file.
- **Address validation.** Bring your own / use Square's SDK.
- **Non-USD currencies / non-US jurisdictions.** Returns
  zero-tax + `skippedReason`.
- **Webhook handling.** Square's `order.created` / `invoice.created`
  webhooks → tax-write-back flow is deferred to v0.2. Until then,
  call the library yourself from your order-finalization or
  invoice-issue code.
- **Square POS origin-based tax** (see above).
- **Calling Square's API.** The library reads caller-supplied
  Square objects; the caller is responsible for fetching them and
  writing tax results back via Square's `UpdateOrder` or
  `UpdateInvoice` endpoints.

## Security

The library exposes **no inbound HTTP routes**. The trust boundary is
your own process; whatever code imports this library is already
trusted.

`baseUrl` is validated at client construction time: URL parse + scheme
allowlist (`http:` / `https:`) + private-network blocklist (loopback,
RFC-1918, IPv6 link-local) unless you opt in with `allowPrivate: true`.

The library never logs customer addresses, line item descriptions,
product names, or customer emails. See [`docs/SECURITY-REVIEW.md`](docs/SECURITY-REVIEW.md)
for the full threat model.

Reporting vulnerabilities: see [`SECURITY.md`](SECURITY.md).

## Contributing

DCO sign-off mandatory on every commit (`git commit -s`). See
[`CONTRIBUTING.md`](CONTRIBUTING.md). Dual-licensed under your choice of Apache-2.0 OR GPL-2.0-or-later. See [`LICENSE`](LICENSE).

## Related projects

| Connector | Stack | Repo |
|-----------|-------|------|
| OpenSalesTax engine | Python | [opensalestax](https://github.com/ejosterberg/opensalestax) |
| Stripe (PHP)         | PHP | [opensalestax-stripe-php](https://github.com/ejosterberg/opensalestax-stripe-php) |
| Medusa v2            | TypeScript | [opensalestax-medusa](https://github.com/ejosterberg/opensalestax-medusa) |
| Vendure              | TypeScript | [opensalestax-vendure](https://github.com/ejosterberg/opensalestax-vendure) |
| Square               | TypeScript | **this repo** |
