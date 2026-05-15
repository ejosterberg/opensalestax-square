// SPDX-License-Identifier: Apache-2.0

import nock from 'nock';

import { calculateForSquareOrder } from '../src/calculate-order';
import { OpenSalesTaxClient } from '@ejosterberg/opensalestax';
import { MissingAddressError } from '../src/errors';
import type { SquareOrder } from '../src/types';

const BASE_URL = 'http://order-engine.example.test';

function buildOrder(overrides: Partial<SquareOrder> = {}): SquareOrder {
  return {
    id: 'order_test',
    line_items: [
      {
        uid: 'line_a',
        quantity: '1',
        total_money: { amount: 10000, currency: 'USD' },
      },
    ],
    fulfillments: [
      {
        type: 'SHIPMENT',
        shipment_details: {
          recipient: {
            address: { country: 'US', postal_code: '55403' },
          },
        },
      },
    ],
    total_money: { amount: 10000, currency: 'USD' },
    ...overrides,
  };
}

function newClient() {
  return new OpenSalesTaxClient({ baseUrl: BASE_URL });
}

function engineCalc(jurisdictions: Array<{ type: string; name: string; rate_pct: string }>) {
  return {
    subtotal: '100.00',
    tax_total: '7.875',
    lines: [
      {
        amount: '100.00',
        category: 'general',
        tax: '7.875',
        rate_pct: '7.875',
        jurisdictions: jurisdictions.map((j) => ({ ...j, tax: '0' })),
        note: null,
      },
    ],
    disclaimer: 'Calculation only.',
  };
}

describe('calculateForSquareOrder', () => {
  beforeEach(() => {
    nock.cleanAll();
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  describe('gates', () => {
    it('returns skippedReason=non_usd for an EUR order', async () => {
      const order = buildOrder({ total_money: { amount: 10000, currency: 'EUR' } });
      const got = await calculateForSquareOrder(order, newClient(), { cache: false });
      expect(got.skippedReason).toBe('non_usd');
    });

    it('returns skippedReason=non_us for a CA shipping address', async () => {
      const order = buildOrder({
        fulfillments: [
          {
            type: 'SHIPMENT',
            shipment_details: {
              recipient: { address: { country: 'CA', postal_code: 'M5V3A8' } },
            },
          },
        ],
      });
      const got = await calculateForSquareOrder(order, newClient(), { cache: false });
      expect(got.skippedReason).toBe('non_us');
    });

    it('returns skippedReason=invalid_zip for a malformed ZIP', async () => {
      const order = buildOrder({
        fulfillments: [
          {
            type: 'SHIPMENT',
            shipment_details: {
              recipient: { address: { country: 'US', postal_code: 'ABCDE' } },
            },
          },
        ],
      });
      const got = await calculateForSquareOrder(order, newClient(), { cache: false });
      expect(got.skippedReason).toBe('invalid_zip');
    });

    it('returns skippedReason=no_lines when extraction yields no priced lines', async () => {
      const order = buildOrder({ line_items: [{ uid: 'empty', quantity: '1' }] });
      const got = await calculateForSquareOrder(order, newClient(), { cache: false });
      expect(got.skippedReason).toBe('no_lines');
    });

    it('throws MissingAddressError when the order has no fulfillment', async () => {
      const order = buildOrder({ fulfillments: [] });
      await expect(calculateForSquareOrder(order, newClient(), { cache: false })).rejects.toThrow(
        MissingAddressError,
      );
    });
  });

  describe('happy path', () => {
    it('calls the engine and returns mapped jurisdictions', async () => {
      nock(BASE_URL)
        .post('/v1/calculate', (body) => {
          expect(body).toEqual({
            address: { zip5: '55403' },
            line_items: [{ amount: '100.00', category: 'general' }],
          });
          return true;
        })
        .reply(
          200,
          engineCalc([
            { type: 'STATE', name: 'Minnesota', rate_pct: '6.875' },
            { type: 'CITY', name: 'Minneapolis', rate_pct: '0.500' },
          ]),
        );

      const got = await calculateForSquareOrder(buildOrder(), newClient(), { cache: false });
      expect(got.skippedReason).toBeUndefined();
      expect(got.lines).toHaveLength(1);
      expect(got.lines[0]?.jurisdictions).toHaveLength(2);
      expect(got.lines[0]?.squareUid).toBe('line_a');
    });

    it('respects ZIP+4 by slicing to zip5', async () => {
      nock(BASE_URL)
        .post('/v1/calculate', (body) => body.address.zip5 === '55403')
        .reply(200, engineCalc([]));

      const order = buildOrder({
        fulfillments: [
          {
            type: 'SHIPMENT',
            shipment_details: {
              recipient: { address: { country: 'US', postal_code: '55403-1234' } },
            },
          },
        ],
      });
      const got = await calculateForSquareOrder(order, newClient(), { cache: false });
      expect(got.skippedReason).toBeUndefined();
    });

    it('uses the default in-memory cache to skip repeat calls', async () => {
      nock(BASE_URL).post('/v1/calculate').once().reply(200, engineCalc([]));

      const client = newClient();
      const order = buildOrder();
      const a = await calculateForSquareOrder(order, client);
      const b = await calculateForSquareOrder(order, client);
      expect(a).toEqual(b);
      // If the cache didn't fire, nock would 404 the second call → mismatch.
      expect(nock.isDone()).toBe(true);
    });

    it('honors cache=false', async () => {
      nock(BASE_URL).post('/v1/calculate').twice().reply(200, engineCalc([]));

      const client = newClient();
      const order = buildOrder();
      await calculateForSquareOrder(order, client, { cache: false });
      await calculateForSquareOrder(order, client, { cache: false });
      expect(nock.isDone()).toBe(true);
    });

    it('honors a caller-supplied cache', async () => {
      nock(BASE_URL).post('/v1/calculate').once().reply(200, engineCalc([]));

      const store = new Map<string, never>();
      const cache = {
        get: (k: string) => store.get(k) as never | undefined,
        set: (k: string, v: never) => {
          store.set(k, v);
        },
      };
      const client = newClient();
      const order = buildOrder();
      await calculateForSquareOrder(order, client, { cache });
      await calculateForSquareOrder(order, client, { cache });
      expect(store.size).toBe(1);
    });
  });

  describe('error handling', () => {
    it('fail-soft (default): returns engine_error result on 5xx', async () => {
      nock(BASE_URL).post('/v1/calculate').reply(503, 'down');
      const got = await calculateForSquareOrder(buildOrder(), newClient(), { cache: false });
      expect(got.skippedReason).toBe('engine_error');
      expect(got.engineError).toContain('503');
    });

    it('fail-soft: returns engine_error result on network failure', async () => {
      nock(BASE_URL).post('/v1/calculate').replyWithError('ECONNREFUSED');
      const got = await calculateForSquareOrder(buildOrder(), newClient(), { cache: false });
      expect(got.skippedReason).toBe('engine_error');
    });

    it('failHard=true: re-throws engine errors', async () => {
      nock(BASE_URL).post('/v1/calculate').reply(500, '');
      await expect(
        calculateForSquareOrder(buildOrder(), newClient(), { cache: false, failHard: true }),
      ).rejects.toThrow();
    });
  });
});
