// SPDX-License-Identifier: Apache-2.0

import nock from 'nock';

import { calculateForSquareInvoice } from '../src/calculate-invoice';
import { OpenSalesTaxClient } from '../src/client';
import { MissingOrderError, UnsupportedSourceError } from '../src/errors';
import type { SquareInvoice, SquareOrder } from '../src/types';

const BASE_URL = 'http://invoice-engine.example.test';

function newClient() {
  return new OpenSalesTaxClient({ baseUrl: BASE_URL });
}

function buildOrder(): SquareOrder {
  return {
    id: 'order_inv',
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
          recipient: { address: { country: 'US', postal_code: '55403' } },
        },
      },
    ],
    total_money: { amount: 10000, currency: 'USD' },
  };
}

function engineOk() {
  return {
    subtotal: '100.00',
    tax_total: '7.875',
    lines: [
      {
        amount: '100.00',
        category: 'general',
        tax: '7.875',
        rate_pct: '7.875',
        jurisdictions: [
          { type: 'STATE', name: 'Minnesota', rate_pct: '6.875', tax: '6.875' },
        ],
      },
    ],
  };
}

describe('calculateForSquareInvoice', () => {
  beforeEach(() => {
    nock.cleanAll();
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  it('uses the embedded invoice.order when present', async () => {
    nock(BASE_URL).post('/v1/calculate').reply(200, engineOk());

    const invoice: SquareInvoice = { id: 'inv_1', order_id: 'order_inv', order: buildOrder() };
    const got = await calculateForSquareInvoice(invoice, newClient(), { cache: false });
    expect(got.skippedReason).toBeUndefined();
    expect(got.taxTotal).toBe('7.875');
  });

  it('calls options.fetchOrder when invoice.order is absent', async () => {
    nock(BASE_URL).post('/v1/calculate').reply(200, engineOk());

    const fetchOrder = jest.fn(async (_id: string) => buildOrder());
    const invoice: SquareInvoice = { id: 'inv_2', order_id: 'order_inv' };
    const got = await calculateForSquareInvoice(invoice, newClient(), {
      cache: false,
      fetchOrder,
    });
    expect(fetchOrder).toHaveBeenCalledWith('order_inv');
    expect(got.skippedReason).toBeUndefined();
  });

  it('throws MissingOrderError when no resolver and no embedded order', async () => {
    const invoice: SquareInvoice = { id: 'inv_3', order_id: 'order_inv' };
    await expect(
      calculateForSquareInvoice(invoice, newClient(), { cache: false }),
    ).rejects.toThrow(MissingOrderError);
  });

  it('throws UnsupportedSourceError when neither order nor order_id is set', async () => {
    const invoice: SquareInvoice = { id: 'inv_4' };
    await expect(
      calculateForSquareInvoice(invoice, newClient(), { cache: false }),
    ).rejects.toThrow(UnsupportedSourceError);
  });

  it('falls back to invoice.primary_recipient.address when the order has no fulfillment', async () => {
    nock(BASE_URL)
      .post('/v1/calculate', (body) => body.address.zip5 === '94103')
      .reply(200, engineOk());

    const invoice: SquareInvoice = {
      id: 'inv_5',
      order: {
        id: 'order_no_ship',
        line_items: [
          { uid: 'line_a', quantity: '1', total_money: { amount: 10000, currency: 'USD' } },
        ],
        total_money: { amount: 10000, currency: 'USD' },
      },
      primary_recipient: { address: { country: 'US', postal_code: '94103' } },
    };

    const got = await calculateForSquareInvoice(invoice, newClient(), { cache: false });
    expect(got.skippedReason).toBeUndefined();
  });

  it('skips on non_usd at the invoice level (order currency != USD)', async () => {
    const order = buildOrder();
    order.total_money = { amount: 10000, currency: 'EUR' };
    const invoice: SquareInvoice = { id: 'inv_6', order_id: 'order_inv', order };
    const got = await calculateForSquareInvoice(invoice, newClient(), { cache: false });
    expect(got.skippedReason).toBe('non_usd');
  });

  it('skips on non_us when primary_recipient is non-US and no order fulfillment', async () => {
    const invoice: SquareInvoice = {
      id: 'inv_7',
      order: { id: 'order_no_ship', line_items: [], total_money: { amount: 0, currency: 'USD' } },
      primary_recipient: { address: { country: 'CA', postal_code: 'M5V3A8' } },
    };
    const got = await calculateForSquareInvoice(invoice, newClient(), { cache: false });
    expect(got.skippedReason).toBe('non_us');
  });
});
