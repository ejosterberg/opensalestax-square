// SPDX-License-Identifier: Apache-2.0

/**
 * Typed error classes for the OpenSalesTax Square library.
 *
 * `OpenSalesTaxApiError` lives in `./client` (it's tied to HTTP I/O);
 * the rest are domain-level and live here.
 *
 * The calculation-only disclaimer is appended to every error message so
 * the merchant sees it even when surfacing errors to end-users.
 */

const DISCLAIMER =
  ' (Tax calculations are provided as-is for convenience. The merchant is solely ' +
  'responsible for tax-collection accuracy and remittance to the appropriate ' +
  'jurisdictions. Verify against your state Department of Revenue before remitting.)';

/** No usable shipping/recipient address with a US ZIP. */
export class MissingAddressError extends Error {
  constructor(message: string) {
    super(message + DISCLAIMER);
    this.name = 'MissingAddressError';
  }
}

/** Invoice references an order ID but no order/resolver was supplied. */
export class MissingOrderError extends Error {
  public readonly orderId: string;
  constructor(orderId: string) {
    super(
      `Square invoice references order_id '${orderId}' but no expanded order ` +
        `was attached and no options.fetchOrder resolver was passed.` +
        DISCLAIMER,
    );
    this.name = 'MissingOrderError';
    this.orderId = orderId;
  }
}

/** A line item or order is in a non-USD currency. */
export class NonUSDError extends Error {
  public readonly currency: string;
  constructor(currency: string, sourceId: string) {
    super(
      `Square source '${sourceId}' is currency='${currency || '(empty)'}', ` +
        `but this library supports USD only.` +
        DISCLAIMER,
    );
    this.name = 'NonUSDError';
    this.currency = currency;
  }
}

/** Source object (order or invoice) is malformed in a way we can't recover from. */
export class UnsupportedSourceError extends Error {
  constructor(message: string) {
    super(message + DISCLAIMER);
    this.name = 'UnsupportedSourceError';
  }
}
