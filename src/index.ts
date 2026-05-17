// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

/**
 * Public entry point for `@ejosterberg/opensalestax-square`.
 *
 * Typical usage:
 *
 * ```ts
 * import {
 *   calculateForSquareOrder,
 *   OpenSalesTaxClient,
 * } from '@ejosterberg/opensalestax-square';
 *
 * const ostClient = new OpenSalesTaxClient({
 *   baseUrl: process.env.OSTAX_API_URL!,
 * });
 *
 * const result = await calculateForSquareOrder(order, ostClient);
 * // result.lines[i].jurisdictions[j].ratePct, etc.
 * ```
 *
 * Tax calculations are provided as-is for convenience. The merchant is
 * solely responsible for tax-collection accuracy and remittance to the
 * appropriate jurisdictions. Verify against your state Department of
 * Revenue before remitting.
 */

export { calculateForSquareOrder } from './calculate-order';
export { calculateForSquareInvoice } from './calculate-invoice';

// Re-export the SDK's public surface so consumers of this library can
// access types and the client class without an explicit
// @ejosterberg/opensalestax dep. Names mirror the SDK as of v0.1.0;
// the old `CalculateRequest` / `CalculateResponse` / `CalculateLineItem`
// types from the v0.1.0-alpha.1 embedded client have been replaced by
// `Address` / `LineItem` / `CalculationResult`.
export {
  OpenSalesTaxClient,
  OpenSalesTaxAPIError,
  OpenSalesTaxNetworkError,
  UrlValidationError,
  validateEngineUrl,
  type Address,
  type CalculatedLine,
  type CalculationResult,
  type HealthResponse,
  type JurisdictionRate,
  type LineItem,
  type OpenSalesTaxClientOptions,
} from '@ejosterberg/opensalestax';

// Square-specific domain errors. Note: the SDK also exports a
// `NonUSDError`, but it's a marker class with a different
// constructor signature. The Square library has historically
// exposed its own `NonUSDError(currency, sourceId)` shape, and we
// preserve that â€” consumers of THIS library import NonUSDError from
// here (it shadows the SDK's). If you need the SDK's marker,
// import it explicitly from `@ejosterberg/opensalestax`.
export {
  MissingAddressError,
  MissingOrderError,
  NonUSDError,
  UnsupportedSourceError,
} from './errors';
export {
  InMemoryLruCache,
  type CacheLike,
  buildCacheKey,
} from './cache';
export {
  CALCULATION_DISCLAIMER,
  type TaxCalculationResult,
  type TaxCalculationLine,
  type TaxJurisdiction,
  type CalculationOptions,
  type CalculateInvoiceOptions,
  type CategoryByCatalogObjectId,
  type SkipReason,
  type CacheControl,
} from './result';
export type {
  SquareOrder,
  SquareInvoice,
  SquareLineItem,
  SquareAddress,
  SquareMoney,
  SquareFulfillment,
  SquareShipmentDetails,
  SquareRecipient,
  SquareInvoicePrimaryRecipient,
} from './types';
