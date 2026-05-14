# Integration Check — live engine smoke

> Records the live smoke result against the workshop OpenSalesTax engine
> for v0.1.0-alpha.1.

## Setup

Engine: `http://10.32.161.126:8080`
(Workshop instance per `~/.claude/CLAUDE.md`)

```bash
OSTAX_API_URL=http://10.32.161.126:8080 npx ts-node tools/smoke-engine.ts
```

The script:

1. Constructs an `OpenSalesTaxClient` with `allowPrivate: true`
   (RFC-1918 host is blocked by default).
2. Calls `client.healthCheck()` and prints the result.
3. Builds a synthetic `SquareOrder`: one SHIPMENT fulfillment to
   ZIP `55401`, one line item at `$100.00` USD.
4. Calls `calculateForSquareOrder(order, client, { cache: false })`.
5. Prints the full `TaxCalculationResult` JSON.

## Result (see file SMOKE-OUTPUT for the captured run)

See [`SMOKE-OUTPUT.txt`](./SMOKE-OUTPUT.txt) in this directory for the
captured run. Key data points:

- `/v1/health` returned `status=ok` with the engine version.
- `/v1/calculate` returned a populated `lines[0].jurisdictions[]`
  with rates summing to the expected Minneapolis combined rate.
- The library mapped the engine response to the public
  `TaxCalculationResult` shape with all expected fields
  (`subtotal`, `taxTotal`, `lines[*].ratePct`,
  `lines[*].jurisdictions[*].type`, etc.).

This confirms the embedded `OpenSalesTaxClient` round-trips end-to-end
against a real engine.

## Notes

- The default `OpenSalesTaxClient` SSRF guard blocks RFC-1918 hosts.
  Production callers using a public engine URL should leave
  `allowPrivate` at its `false` default. Dev / on-prem callers (like
  the workshop) explicitly opt in.
- The smoke uses `cache: false` so the engine is actually hit on every
  run. Production callers benefit from the default cache.
