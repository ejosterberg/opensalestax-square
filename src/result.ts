// SPDX-License-Identifier: Apache-2.0

import type { CalculationResult } from '@ejosterberg/opensalestax';
import type { SquareOrder } from './types';

/**
 * Public result shape. Mirrors the engine's `/v1/calculate` response
 * with two additions:
 *   - `skippedReason` — if the call short-circuited (non-USD, non-US,
 *     missing ZIP, engine error), this string tells the caller why.
 *   - `engineError` — when an engine call failed in fail-soft mode,
 *     the original error message (no stack) lands here for logging.
 */
export interface TaxJurisdiction {
  type: string;
  name: string;
  ratePct: string;
  tax: string | null;
}

export interface TaxCalculationLine {
  amount: string;
  category: string;
  tax: string;
  ratePct: string;
  jurisdictions: TaxJurisdiction[];
  /** Square line UID for this engine line, if the source order had a UID. */
  squareUid?: string;
  /** Pass-through engine-side note (e.g. for missing-data hints). */
  note?: string | null;
}

export type SkipReason =
  | 'non_usd'
  | 'non_us'
  | 'invalid_zip'
  | 'no_lines'
  | 'engine_error';

export interface TaxCalculationResult {
  subtotal: string;
  taxTotal: string;
  lines: TaxCalculationLine[];
  /** Populated when the calculation short-circuited. */
  skippedReason?: SkipReason;
  /** Engine error message in fail-soft mode. */
  engineError?: string;
  /** Always present. The constitution §10 disclaimer. */
  disclaimer: string;
}

/** Options shared by `calculateForSquareOrder` + `calculateForSquareInvoice`. */
export interface CalculationOptions {
  /**
   * Map `Order.line_items[i].catalog_object_id` to an OST category
   * (`general`, `clothing`, `groceries`, `prescription_drugs`,
   * `prepared_food`, `digital_goods`). Unmapped lines fall through to
   * `defaultCategory`.
   */
  categoryByCatalogObjectId?: CategoryByCatalogObjectId;

  /**
   * Default OST category for any line item without a per-id mapping.
   * Default `'general'`.
   */
  defaultCategory?: string;

  /**
   * When true, engine errors throw instead of returning a zero-tax
   * result with `skippedReason='engine_error'`. Default `false`.
   */
  failHard?: boolean;

  /**
   * Cache control:
   *   - `undefined` / `true` → use a process-local default LRU
   *   - `false` → disable caching
   *   - object → use this CacheLike implementation
   */
  cache?: CacheControl;
}

export type CacheControl =
  | true
  | false
  | {
      get(key: string): TaxCalculationResult | undefined;
      set(key: string, value: TaxCalculationResult): void;
    };

export interface CalculateInvoiceOptions extends CalculationOptions {
  /**
   * Resolver for `invoice.order_id` when the invoice doesn't already
   * carry a `.order`. Library never calls Square's API itself — this
   * lets the caller plug in their preferred Square SDK.
   */
  fetchOrder?: (orderId: string) => Promise<SquareOrder>;
}

export type CategoryByCatalogObjectId = Readonly<Record<string, string>>;

export const CALCULATION_DISCLAIMER =
  'Tax calculations are provided as-is for convenience. The merchant is solely ' +
  'responsible for tax-collection accuracy and remittance to the appropriate ' +
  'jurisdictions. Verify against your state Department of Revenue before remitting.';

export function buildResult(
  engineResponse: CalculationResult,
  squareUids: Array<string | undefined>,
): TaxCalculationResult {
  const lines: TaxCalculationLine[] = engineResponse.lines.map((line, idx) => {
    const uid = squareUids[idx];
    const result: TaxCalculationLine = {
      amount: line.amount,
      category: line.category,
      tax: line.tax,
      ratePct: line.ratePct,
      jurisdictions: (line.jurisdictions ?? []).map((j) => ({
        type: j.type,
        name: j.name,
        ratePct: j.ratePct,
        tax: j.tax,
      })),
    };
    if (uid !== undefined) result.squareUid = uid;
    if (line.note !== undefined && line.note !== null) result.note = line.note;
    return result;
  });

  return {
    subtotal: engineResponse.subtotal,
    taxTotal: engineResponse.taxTotal,
    lines,
    disclaimer: CALCULATION_DISCLAIMER,
  };
}

export function buildSkippedResult(
  reason: SkipReason,
  subtotalCents = 0,
  engineError?: string,
): TaxCalculationResult {
  const subtotal = (subtotalCents / 100).toFixed(2);
  const result: TaxCalculationResult = {
    subtotal,
    taxTotal: '0.00',
    lines: [],
    skippedReason: reason,
    disclaimer: CALCULATION_DISCLAIMER,
  };
  if (engineError !== undefined) result.engineError = engineError;
  return result;
}
