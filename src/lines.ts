// SPDX-License-Identifier: Apache-2.0

import type { LineItem } from '@ejosterberg/opensalestax';
import { NonUSDError, UnsupportedSourceError } from './errors';
import { centsToDecimalString, DEFAULT_CATEGORY, SUPPORTED_CURRENCY } from './gates';
import type { CategoryByCatalogObjectId } from './result';
import type { SquareLineItem, SquareOrder } from './types';

export interface ExtractLinesOptions {
  categoryByCatalogObjectId?: CategoryByCatalogObjectId;
  defaultCategory?: string;
}

export interface ExtractedLines {
  /** Engine-formatted line_items, in the same order as Square's input. */
  line_items: LineItem[];
  /** Square line UID per engine line — for caller-side correlation. */
  squareUids: Array<string | undefined>;
  /** UIDs of lines we skipped because they had no resolvable amount. */
  skippedUnpriced: string[];
}

/**
 * Convert Square order line_items to engine line_items.
 *
 * Rules:
 *   - Money currency must be `USD` (or unset — Square frequently omits
 *     currency on individual lines and reports it only on `total_money`).
 *     If any line has currency != USD → throw `NonUSDError`.
 *   - Amount: prefer `total_money.amount` if present (already
 *     quantity-multiplied by Square). Else `base_price_money.amount *
 *     quantity`. Else `variation_total_price_money.amount`.
 *   - Quantity comes off `line_items[i].quantity` (a string per
 *     Square's API). Default 1; non-finite or ≤0 → skip.
 *   - Lines with no resolvable amount are skipped (not an error) — they
 *     show up in `skippedUnpriced` so the caller can audit.
 *   - Category resolved via `options.categoryByCatalogObjectId` → fall
 *     through to `options.defaultCategory` → fall through to `'general'`.
 */
export function extractOrderLines(
  order: SquareOrder,
  options: ExtractLinesOptions = {},
): ExtractedLines {
  if (!Array.isArray(order.line_items)) {
    throw new UnsupportedSourceError(
      `Square order '${order.id ?? '(unknown)'}' has no line_items array.`,
    );
  }

  const defaultCategory = options.defaultCategory ?? DEFAULT_CATEGORY;
  const categoryMap = options.categoryByCatalogObjectId;
  const orderId = order.id ?? '(unknown)';

  const line_items: LineItem[] = [];
  const squareUids: Array<string | undefined> = [];
  const skippedUnpriced: string[] = [];

  for (const line of order.line_items) {
    const converted = convertLine(line, orderId, categoryMap, defaultCategory);
    if (converted.kind === 'skipped') {
      if (converted.uid !== undefined) skippedUnpriced.push(converted.uid);
      continue;
    }
    line_items.push(converted.item);
    squareUids.push(line.uid);
  }

  return { line_items, squareUids, skippedUnpriced };
}

type ConvertedLine =
  | { kind: 'ok'; item: LineItem }
  | { kind: 'skipped'; uid: string | undefined };

function convertLine(
  line: SquareLineItem,
  orderId: string,
  categoryMap: ExtractLinesOptions['categoryByCatalogObjectId'],
  defaultCategory: string,
): ConvertedLine {
  assertUsdLine(line, orderId);
  const quantity = parseQuantity(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { kind: 'skipped', uid: line.uid };
  }
  const cents = resolveAmountCents(line, quantity);
  if (cents === null) {
    return { kind: 'skipped', uid: line.uid };
  }
  return {
    kind: 'ok',
    item: {
      amount: centsToDecimalString(cents),
      category: resolveCategory(line.catalog_object_id, categoryMap, defaultCategory),
    },
  };
}

function assertUsdLine(line: SquareLineItem, orderId: string): void {
  const lineCurrency =
    pickCurrency(line.total_money) ??
    pickCurrency(line.base_price_money) ??
    pickCurrency(line.variation_total_price_money);
  if (lineCurrency !== undefined && lineCurrency.toUpperCase() !== SUPPORTED_CURRENCY) {
    throw new NonUSDError(lineCurrency, orderId);
  }
}

function resolveCategory(
  catalogObjectId: string | undefined,
  categoryMap: ExtractLinesOptions['categoryByCatalogObjectId'],
  defaultCategory: string,
): string {
  if (categoryMap === undefined || catalogObjectId === undefined) return defaultCategory;
  return categoryMap[catalogObjectId] ?? defaultCategory;
}

function pickCurrency(money: { currency?: string } | undefined): string | undefined {
  if (money === undefined) return undefined;
  if (typeof money.currency !== 'string' || money.currency === '') return undefined;
  return money.currency;
}

function parseQuantity(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 1;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 1;
}

function resolveAmountCents(line: SquareLineItem, quantity: number): number | null {
  // Square's `total_money` is base × quantity already; prefer it.
  const total = toCents(line.total_money?.amount);
  if (total !== null) return total;

  const variationTotal = toCents(line.variation_total_price_money?.amount);
  if (variationTotal !== null) return variationTotal;

  const base = toCents(line.base_price_money?.amount);
  if (base !== null) return Math.round(base * quantity);

  return null;
}

function toCents(amount: number | bigint | undefined): number | null {
  if (amount === undefined) return null;
  if (typeof amount === 'bigint') {
    // bigint Money amounts > Number.MAX_SAFE_INTEGER are pathological in
    // commerce contexts; coerce and let downstream clamp.
    return Number(amount);
  }
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return Math.round(amount);
  }
  return null;
}
