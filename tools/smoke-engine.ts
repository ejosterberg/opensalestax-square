// SPDX-License-Identifier: Apache-2.0

/**
 * Live smoke test against the OpenSalesTax engine.
 *
 * Usage:
 *   OSTAX_API_URL=http://10.32.161.126:8080 npx ts-node tools/smoke-engine.ts
 *
 * Default `apiUrl` is the workshop engine at 10.32.161.126:8080 which
 * lives on RFC-1918 → we pass `allowPrivate: true` so the SSRF guard
 * doesn't reject it. Production engines on public URLs should leave
 * `allowPrivate` at its `false` default.
 */

import {
  calculateForSquareOrder,
  OpenSalesTaxClient,
  type SquareOrder,
} from '../src';

const BASE_URL = process.env.OSTAX_API_URL ?? 'http://10.32.161.126:8080';

const order: SquareOrder = {
  id: 'smoke_order_1',
  line_items: [
    {
      uid: 'smoke_line_1',
      quantity: '1',
      total_money: { amount: 10000, currency: 'USD' },
    },
  ],
  fulfillments: [
    {
      type: 'SHIPMENT',
      shipment_details: {
        recipient: {
          address: {
            country: 'US',
            postal_code: '55401',
          },
        },
      },
    },
  ],
  total_money: { amount: 10000, currency: 'USD' },
};

async function main(): Promise<void> {
  const client = new OpenSalesTaxClient({
    baseUrl: BASE_URL,
    allowPrivate: true,
    timeoutMs: 10000,
  });

  // healthCheck() never throws — returns a discriminated union.
  const health = await client.healthCheck();
  // eslint-disable-next-line no-console
  if (health.ok) {
    console.log(
      `engine: ok=true version=${health.version} db=${health.databaseConnected} rtt=${health.rttMs}ms`,
    );
  } else {
    console.log(`engine: ok=false rtt=${health.rttMs}ms error=${health.error}`);
  }

  const result = await calculateForSquareOrder(order, client, { cache: false });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('smoke FAILED:', err);
  process.exit(1);
});
