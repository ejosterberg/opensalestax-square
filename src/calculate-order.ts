// SPDX-License-Identifier: Apache-2.0

import { resolveOrderAddress } from './address';
import type {
  CalculationResult,
  LineItem,
  OpenSalesTaxClient,
} from '@ejosterberg/opensalestax';
import { buildCacheKey, InMemoryLruCache } from './cache';
import { isSupportedCountry, isSupportedCurrency } from './gates';
import { extractOrderLines, type ExtractLinesOptions } from './lines';
import {
  buildResult,
  buildSkippedResult,
  type CalculationOptions,
  type TaxCalculationResult,
} from './result';
import type { SquareOrder } from './types';

/**
 * Process-local default cache. Created lazily so importing the module
 * doesn't allocate a Map for callers who pass their own cache.
 */
let defaultCache: InMemoryLruCache<TaxCalculationResult> | null = null;
function getDefaultCache(): InMemoryLruCache<TaxCalculationResult> {
  defaultCache ??= new InMemoryLruCache<TaxCalculationResult>();
  return defaultCache;
}

interface OrderCacheLike {
  get(key: string): TaxCalculationResult | undefined;
  set(key: string, value: TaxCalculationResult): void;
}

/**
 * Calculate US sales tax for a Square Order.
 *
 * The caller fetches the `Order` via Square's SDK (or REST API)
 * before calling this function. The library reads the order's
 * destination address (first shipping fulfillment), extracts line
 * items, calls OpenSalesTax `/v1/calculate`, and returns a
 * structured tax breakdown the caller can write back to Square's
 * `Order.taxes[]` via `UpdateOrder`.
 *
 * USD-only / US-only / valid-ZIP-only — non-matching orders return a
 * zero-tax result with `skippedReason` populated (constitution §8 —
 * fail-soft). Engine errors also fail-soft by default; pass
 * `failHard: true` to surface them as exceptions.
 *
 * **Disclaimer:** Tax calculations are provided as-is for convenience.
 * The merchant is solely responsible for tax-collection accuracy and
 * remittance to the appropriate jurisdictions. Verify against your
 * state Department of Revenue before remitting.
 *
 * @param order Square Order — already fetched by the caller
 * @param client OpenSalesTax engine client
 * @param options Optional cache / category / fail-hard overrides
 */
export async function calculateForSquareOrder(
  order: SquareOrder,
  client: OpenSalesTaxClient,
  options: CalculationOptions = {},
): Promise<TaxCalculationResult> {
  const gated = gateOrderEnvelope(order);
  if (gated !== null) return gated;

  const addr = resolveOrderAddress(order);
  const addrGate = gateAddress(addr);
  if (addrGate !== null) return addrGate;

  const { line_items, squareUids } = extractOrderLines(order, buildExtractOpts(options));
  if (line_items.length === 0) {
    return buildSkippedResult('no_lines');
  }

  const cache = resolveCache(options.cache);
  const cacheKey = cache === null ? null : buildCacheKey(addr.zip5, addr.countryUpper, line_items);
  const cached = readCache(cache, cacheKey);
  if (cached !== undefined) return cached;

  const engineResult = await callEngine(client, addr.zip5, line_items, options.failHard === true);
  if (engineResult.kind === 'error') return engineResult.value;

  const result = buildResult(engineResult.value, squareUids);
  writeCache(cache, cacheKey, result);
  return result;
}

/** Early-exit non_usd gate based on the order's totals. */
function gateOrderEnvelope(order: SquareOrder): TaxCalculationResult | null {
  const orderCurrency = order.total_money?.currency ?? order.net_amount_due_money?.currency;
  if (orderCurrency !== undefined && !isSupportedCurrency(orderCurrency)) {
    return buildSkippedResult('non_usd');
  }
  return null;
}

/** Country + ZIP gates on the resolved destination address. */
function gateAddress(addr: { countryUpper: string; zip5: string }): TaxCalculationResult | null {
  if (!isSupportedCountry(addr.countryUpper)) {
    return buildSkippedResult('non_us');
  }
  if (addr.zip5 === '') {
    return buildSkippedResult('invalid_zip');
  }
  return null;
}

function buildExtractOpts(options: CalculationOptions): ExtractLinesOptions {
  const extractOpts: ExtractLinesOptions = {};
  if (options.categoryByCatalogObjectId !== undefined) {
    extractOpts.categoryByCatalogObjectId = options.categoryByCatalogObjectId;
  }
  if (options.defaultCategory !== undefined) {
    extractOpts.defaultCategory = options.defaultCategory;
  }
  return extractOpts;
}

function resolveCache(control: CalculationOptions['cache']): OrderCacheLike | null {
  if (control === false) return null;
  if (control === undefined || control === true) {
    return getDefaultCache();
  }
  return control;
}

function readCache(cache: OrderCacheLike | null, key: string | null): TaxCalculationResult | undefined {
  if (cache === null || key === null) return undefined;
  return cache.get(key);
}

function writeCache(cache: OrderCacheLike | null, key: string | null, value: TaxCalculationResult): void {
  if (cache !== null && key !== null) cache.set(key, value);
}

type EngineCallResult =
  | { kind: 'ok'; value: CalculationResult }
  | { kind: 'error'; value: TaxCalculationResult };

async function callEngine(
  client: OpenSalesTaxClient,
  zip5: string,
  line_items: LineItem[],
  failHard: boolean,
): Promise<EngineCallResult> {
  try {
    const value = await client.calculate({ zip5 }, line_items);
    return { kind: 'ok', value };
  } catch (err) {
    if (failHard) throw err;
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'error', value: buildSkippedResult('engine_error', 0, message) };
  }
}
