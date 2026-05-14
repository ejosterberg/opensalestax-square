// SPDX-License-Identifier: Apache-2.0

import { NonUSDError, UnsupportedSourceError } from '../src/errors';
import { extractOrderLines } from '../src/lines';
import type { SquareOrder } from '../src/types';

describe('extractOrderLines', () => {
  it('extracts amount from total_money when present', () => {
    const order: SquareOrder = {
      id: 'order_1',
      line_items: [
        {
          uid: 'line_a',
          quantity: '2',
          total_money: { amount: 2000, currency: 'USD' },
        },
      ],
    };
    const got = extractOrderLines(order);
    expect(got.line_items).toEqual([{ amount: '20.00', category: 'general' }]);
    expect(got.squareUids).toEqual(['line_a']);
    expect(got.skippedUnpriced).toEqual([]);
  });

  it('multiplies base_price_money * quantity when total_money absent', () => {
    const order: SquareOrder = {
      id: 'order_2',
      line_items: [
        {
          uid: 'line_b',
          quantity: '3',
          base_price_money: { amount: 1500, currency: 'USD' },
        },
      ],
    };
    const got = extractOrderLines(order);
    expect(got.line_items[0]?.amount).toBe('45.00');
  });

  it('uses variation_total_price_money as second fallback', () => {
    const order: SquareOrder = {
      id: 'order_3',
      line_items: [
        {
          uid: 'line_c',
          quantity: '1',
          variation_total_price_money: { amount: 999, currency: 'USD' },
        },
      ],
    };
    const got = extractOrderLines(order);
    expect(got.line_items[0]?.amount).toBe('9.99');
  });

  it('defaults quantity to 1 when missing', () => {
    const order: SquareOrder = {
      id: 'order_4',
      line_items: [
        {
          uid: 'line_d',
          base_price_money: { amount: 500, currency: 'USD' },
        },
      ],
    };
    const got = extractOrderLines(order);
    expect(got.line_items[0]?.amount).toBe('5.00');
  });

  it('skips lines with zero or negative quantity', () => {
    const order: SquareOrder = {
      id: 'order_5',
      line_items: [
        { uid: 'good', quantity: '1', total_money: { amount: 100, currency: 'USD' } },
        { uid: 'zero', quantity: '0', total_money: { amount: 100, currency: 'USD' } },
        { uid: 'neg', quantity: '-1', total_money: { amount: 100, currency: 'USD' } },
      ],
    };
    const got = extractOrderLines(order);
    expect(got.line_items).toHaveLength(1);
    expect(got.skippedUnpriced).toEqual(['zero', 'neg']);
  });

  it('skips lines with no resolvable amount', () => {
    const order: SquareOrder = {
      id: 'order_6',
      line_items: [
        { uid: 'unpriced', quantity: '1' },
        { uid: 'priced', quantity: '1', total_money: { amount: 100, currency: 'USD' } },
      ],
    };
    const got = extractOrderLines(order);
    expect(got.line_items).toHaveLength(1);
    expect(got.skippedUnpriced).toEqual(['unpriced']);
  });

  it('throws NonUSDError if any line currency is set and non-USD', () => {
    const order: SquareOrder = {
      id: 'order_7',
      line_items: [
        { uid: 'eur', quantity: '1', total_money: { amount: 100, currency: 'EUR' } },
      ],
    };
    expect(() => extractOrderLines(order)).toThrow(NonUSDError);
  });

  it('throws UnsupportedSourceError when line_items is not an array', () => {
    // Cast around the type to simulate a malformed input from a wild SDK
    const malformed = { id: 'order_8' } as SquareOrder;
    expect(() => extractOrderLines(malformed)).toThrow(UnsupportedSourceError);
  });

  it('applies category mapping by catalog_object_id', () => {
    const order: SquareOrder = {
      id: 'order_9',
      line_items: [
        {
          uid: 'shirt',
          catalog_object_id: 'cat_shirt',
          quantity: '1',
          total_money: { amount: 2500, currency: 'USD' },
        },
        {
          uid: 'other',
          catalog_object_id: 'cat_other',
          quantity: '1',
          total_money: { amount: 1000, currency: 'USD' },
        },
      ],
    };
    const got = extractOrderLines(order, {
      categoryByCatalogObjectId: { cat_shirt: 'clothing' },
      defaultCategory: 'general',
    });
    expect(got.line_items[0]?.category).toBe('clothing');
    expect(got.line_items[1]?.category).toBe('general');
  });

  it('uses defaultCategory when provided and no mapping matches', () => {
    const order: SquareOrder = {
      id: 'order_10',
      line_items: [
        {
          uid: 'x',
          quantity: '1',
          total_money: { amount: 100, currency: 'USD' },
        },
      ],
    };
    const got = extractOrderLines(order, { defaultCategory: 'digital_goods' });
    expect(got.line_items[0]?.category).toBe('digital_goods');
  });

  it('accepts bigint money amounts', () => {
    const order: SquareOrder = {
      id: 'order_11',
      line_items: [
        {
          uid: 'big',
          quantity: '1',
          total_money: { amount: 2500n, currency: 'USD' },
        },
      ],
    };
    const got = extractOrderLines(order);
    expect(got.line_items[0]?.amount).toBe('25.00');
  });

  it('tolerates lines with no uid (no entry in skippedUnpriced)', () => {
    const order: SquareOrder = {
      id: 'order_12',
      line_items: [
        { quantity: '0', total_money: { amount: 100, currency: 'USD' } },
      ],
    };
    const got = extractOrderLines(order);
    expect(got.line_items).toHaveLength(0);
    expect(got.skippedUnpriced).toEqual([]);
  });
});
