// SPDX-License-Identifier: Apache-2.0

import { resolveInvoiceAddress } from './address';
import { calculateForSquareOrder } from './calculate-order';
import type { OpenSalesTaxClient } from '@ejosterberg/opensalestax';
import { MissingOrderError, UnsupportedSourceError } from './errors';
import { isSupportedCountry, isSupportedCurrency } from './gates';
import { buildSkippedResult, type CalculateInvoiceOptions, type TaxCalculationResult } from './result';
import type { SquareInvoice, SquareOrder } from './types';

/**
 * Calculate US sales tax for a Square Invoice.
 *
 * Square Invoices reference an Order by ID; we need that Order to read
 * line items. Three paths:
 *
 *   1. Caller pre-attached `invoice.order` → we use it directly.
 *   2. Caller passes `options.fetchOrder(orderId)` → we call it.
 *   3. Neither → throw `MissingOrderError`.
 *
 * Once the order is in hand, the call defers to `calculateForSquareOrder`
 * for all the gate / extraction / engine logic. The invoice's
 * `primary_recipient.address` is the *last* address candidate (used only
 * if neither the order's fulfillments nor its overrides yield a ZIP).
 *
 * **Disclaimer:** Tax calculations are provided as-is for convenience.
 * The merchant is solely responsible for tax-collection accuracy and
 * remittance to the appropriate jurisdictions. Verify against your
 * state Department of Revenue before remitting.
 */
export async function calculateForSquareInvoice(
  invoice: SquareInvoice,
  client: OpenSalesTaxClient,
  options: CalculateInvoiceOptions = {},
): Promise<TaxCalculationResult> {
  let order: SquareOrder | undefined = invoice.order;
  if (order === undefined) {
    if (typeof invoice.order_id !== 'string' || invoice.order_id === '') {
      throw new UnsupportedSourceError(
        `Square invoice '${invoice.id ?? '(unknown)'}' has no order or order_id.`,
      );
    }
    if (options.fetchOrder === undefined) {
      throw new MissingOrderError(invoice.order_id);
    }
    order = await options.fetchOrder(invoice.order_id);
  }

  // Currency gate using the order's totals first (early exit cheap).
  const currency = order.total_money?.currency ?? order.net_amount_due_money?.currency;
  if (currency !== undefined && !isSupportedCurrency(currency)) {
    return buildSkippedResult('non_usd');
  }

  // If the order yields no shipping fulfillment, fall back to the
  // invoice's primary_recipient.address — and short-circuit on the
  // country gate before we even try the order path's extraction.
  try {
    // Try invoice-level resolution first to honor the invoice
    // primary_recipient fallback path documented in the spec.
    const invoiceAddr = resolveInvoiceAddress(invoice);
    if (!isSupportedCountry(invoiceAddr.countryUpper)) {
      return buildSkippedResult('non_us');
    }
    if (invoiceAddr.zip5 === '') {
      return buildSkippedResult('invalid_zip');
    }

    // If the invoice fell back to the primary_recipient (not the order),
    // synthesize a fulfillment on the order so the downstream extraction
    // sees the same address. We don't mutate the caller's invoice/order;
    // we work on a shallow copy.
    if (invoiceAddr.source === 'invoice_primary_recipient') {
      const recipientAddr = invoice.primary_recipient?.address;
      if (recipientAddr !== undefined) {
        order = {
          ...order,
          fulfillments: [
            ...(order.fulfillments ?? []),
            {
              type: 'SHIPMENT',
              shipment_details: {
                recipient: { address: recipientAddr },
              },
            },
          ],
        };
      }
    }
  } catch {
    // Address-resolution failure flows through to calculateForSquareOrder
    // which will also throw MissingAddressError. Let it.
  }

  return calculateForSquareOrder(order, client, options);
}
