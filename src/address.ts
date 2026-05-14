// SPDX-License-Identifier: Apache-2.0

import { MissingAddressError } from './errors';
import { isValidZip, normalizeZip } from './gates';
import type { SquareAddress, SquareInvoice, SquareOrder } from './types';

/**
 * Resolved shipping address — country + 5-digit ZIP. The library uses
 * destination-based tax (Square POS in-person origin-based tax is out
 * of v0.1 scope per the spec).
 */
export interface ResolvedAddress {
  countryUpper: string;
  zip5: string;
  /** Raw address chosen — populated when we found a candidate but it didn't pass gates. */
  source: 'order_fulfillment' | 'invoice_primary_recipient';
}

/**
 * Pull a shipping address off a Square Order.
 *
 * Priority:
 *   1. The first SHIPMENT-typed fulfillment with a recipient address
 *      and postal code.
 *   2. The first fulfillment with a recipient address (any type) — for
 *      callers who don't tag fulfillment.type.
 *
 * Returns `null` if no candidate address can be found.
 */
export function pickOrderAddress(order: SquareOrder): SquareAddress | null {
  const fulfillments = order.fulfillments ?? [];
  // First pass: SHIPMENT type with postal_code
  for (const f of fulfillments) {
    if (typeof f.type === 'string' && f.type.toUpperCase() === 'SHIPMENT') {
      const addr = f.shipment_details?.recipient?.address;
      if (addr && typeof addr.postal_code === 'string' && addr.postal_code.length > 0) {
        return addr;
      }
    }
  }
  // Second pass: any fulfillment with a recipient address
  for (const f of fulfillments) {
    const addr = f.shipment_details?.recipient?.address;
    if (addr && typeof addr.postal_code === 'string' && addr.postal_code.length > 0) {
      return addr;
    }
  }
  return null;
}

/**
 * Resolve a usable address from a Square Order. Throws
 * `MissingAddressError` if none can be found.
 */
export function resolveOrderAddress(order: SquareOrder): ResolvedAddress {
  const addr = pickOrderAddress(order);
  if (addr === null) {
    throw new MissingAddressError(
      `Square order '${order.id ?? '(unknown)'}' has no SHIPMENT fulfillment with a recipient ZIP.`,
    );
  }
  return buildResolved(addr, 'order_fulfillment');
}

/**
 * Resolve a usable address from a Square Invoice. Tries the embedded
 * `invoice.order` first (if present); falls back to
 * `invoice.primary_recipient.address`. Throws `MissingAddressError`
 * if neither produces a candidate.
 */
export function resolveInvoiceAddress(invoice: SquareInvoice): ResolvedAddress {
  if (invoice.order !== undefined) {
    const orderAddr = pickOrderAddress(invoice.order);
    if (orderAddr !== null) {
      return buildResolved(orderAddr, 'order_fulfillment');
    }
  }
  const fallback = invoice.primary_recipient?.address;
  if (
    fallback !== undefined &&
    typeof fallback.postal_code === 'string' &&
    fallback.postal_code.length > 0
  ) {
    return buildResolved(fallback, 'invoice_primary_recipient');
  }
  throw new MissingAddressError(
    `Square invoice '${invoice.id ?? '(unknown)'}' has no shipping fulfillment ` +
      `and no primary_recipient.address with a ZIP.`,
  );
}

function buildResolved(
  addr: SquareAddress,
  source: 'order_fulfillment' | 'invoice_primary_recipient',
): ResolvedAddress {
  const country = (addr.country ?? '').toUpperCase();
  const postal = addr.postal_code ?? '';
  const zip5 = isValidZip(postal) ? normalizeZip(postal) : '';
  return { countryUpper: country, zip5, source };
}
