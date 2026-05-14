// SPDX-License-Identifier: Apache-2.0

import {
  pickOrderAddress,
  resolveInvoiceAddress,
  resolveOrderAddress,
} from '../src/address';
import { MissingAddressError } from '../src/errors';
import type { SquareInvoice, SquareOrder } from '../src/types';

function orderWithFulfillment(args: {
  type?: string;
  address?: { country?: string; postal_code?: string };
}): SquareOrder {
  const order: SquareOrder = { id: 'order_1', line_items: [] };
  if (args.address !== undefined) {
    order.fulfillments = [
      {
        ...(args.type !== undefined ? { type: args.type } : {}),
        shipment_details: { recipient: { address: args.address } },
      },
    ];
  } else {
    order.fulfillments = [
      {
        ...(args.type !== undefined ? { type: args.type } : {}),
        shipment_details: { recipient: {} },
      },
    ];
  }
  return order;
}

describe('pickOrderAddress', () => {
  it('returns the first SHIPMENT fulfillment with a postal_code', () => {
    const order: SquareOrder = {
      fulfillments: [
        {
          type: 'SHIPMENT',
          shipment_details: {
            recipient: { address: { postal_code: '55403', country: 'US' } },
          },
        },
        {
          type: 'PICKUP',
          shipment_details: {
            recipient: { address: { postal_code: '94103', country: 'US' } },
          },
        },
      ],
    };
    const got = pickOrderAddress(order);
    expect(got?.postal_code).toBe('55403');
  });

  it('falls back to non-SHIPMENT fulfillment with a postal_code', () => {
    const order: SquareOrder = {
      fulfillments: [
        {
          type: 'PICKUP',
          shipment_details: {
            recipient: { address: { postal_code: '94103', country: 'US' } },
          },
        },
      ],
    };
    const got = pickOrderAddress(order);
    expect(got?.postal_code).toBe('94103');
  });

  it('returns null when no fulfillment has a postal_code', () => {
    const order: SquareOrder = {
      fulfillments: [{ type: 'SHIPMENT', shipment_details: { recipient: {} } }],
    };
    expect(pickOrderAddress(order)).toBeNull();
  });

  it('returns null for an empty fulfillments array', () => {
    expect(pickOrderAddress({})).toBeNull();
  });
});

describe('resolveOrderAddress', () => {
  it('returns country + zip5 + source=order_fulfillment', () => {
    const order = orderWithFulfillment({
      type: 'SHIPMENT',
      address: { country: 'US', postal_code: '55403-1234' },
    });
    const got = resolveOrderAddress(order);
    expect(got).toEqual({
      countryUpper: 'US',
      zip5: '55403',
      source: 'order_fulfillment',
    });
  });

  it('throws MissingAddressError when no candidate exists', () => {
    expect(() => resolveOrderAddress({ id: 'order_x' })).toThrow(MissingAddressError);
  });

  it('returns zip5 as empty string when ZIP is malformed (caller gates)', () => {
    const order = orderWithFulfillment({
      type: 'SHIPMENT',
      address: { country: 'US', postal_code: 'ABCDE' },
    });
    // The picker accepts any non-empty postal_code; the resolver only emits zip5 if valid.
    expect(() => resolveOrderAddress(order)).not.toThrow();
    const got = resolveOrderAddress(order);
    expect(got.zip5).toBe('');
  });
});

describe('resolveInvoiceAddress', () => {
  it('prefers an embedded invoice.order shipment over primary_recipient', () => {
    const invoice: SquareInvoice = {
      id: 'inv_1',
      order: orderWithFulfillment({
        type: 'SHIPMENT',
        address: { country: 'US', postal_code: '55403' },
      }),
      primary_recipient: { address: { country: 'US', postal_code: '94103' } },
    };
    const got = resolveInvoiceAddress(invoice);
    expect(got.zip5).toBe('55403');
    expect(got.source).toBe('order_fulfillment');
  });

  it('falls back to primary_recipient when no order fulfillment yields a ZIP', () => {
    const invoice: SquareInvoice = {
      id: 'inv_2',
      order: { id: 'order_2', line_items: [] },
      primary_recipient: { address: { country: 'US', postal_code: '94103' } },
    };
    const got = resolveInvoiceAddress(invoice);
    expect(got.zip5).toBe('94103');
    expect(got.source).toBe('invoice_primary_recipient');
  });

  it('throws when neither order fulfillment nor primary_recipient yield an address', () => {
    const invoice: SquareInvoice = { id: 'inv_3' };
    expect(() => resolveInvoiceAddress(invoice)).toThrow(MissingAddressError);
  });
});
