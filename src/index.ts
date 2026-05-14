// SPDX-License-Identifier: Apache-2.0

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
export {
  OpenSalesTaxClient,
  OpenSalesTaxApiError,
  type OpenSalesTaxClientOptions,
  type CalculateRequest,
  type CalculateResponse,
  type CalculatedLine,
  type CalculateLineItem,
  type JurisdictionRate,
  type HealthResponse,
} from './client';
export {
  MissingAddressError,
  MissingOrderError,
  NonUSDError,
  UnsupportedSourceError,
} from './errors';
export {
  UrlValidationError,
  validateEngineUrl,
  type ValidateOptions,
} from './url-validator';
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
