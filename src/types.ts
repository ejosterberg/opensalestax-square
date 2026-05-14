// SPDX-License-Identifier: Apache-2.0

/**
 * Minimal Square shapes consumed by this library.
 *
 * We deliberately hand-roll these instead of depending on the `squareup`
 * SDK so this library has zero peer / runtime deps. Only fields we read
 * are typed; callers can pass full Square SDK objects — extra properties
 * are ignored. Use `import type` from `squareup` if you want full types
 * on the caller side.
 *
 * Field names match Square's REST shape (snake_case). Square's
 * JavaScript SDK returns camelCase by default; if you use it, transform
 * to snake_case before calling this library, or build the objects
 * directly from Square's REST responses.
 */

export interface SquareMoney {
  amount?: number | bigint;
  currency?: string;
}

export interface SquareAddress {
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  administrative_district_level_1?: string;
  postal_code?: string;
  country?: string;
}

export interface SquareRecipient {
  display_name?: string;
  email_address?: string;
  address?: SquareAddress;
}

export interface SquareShipmentDetails {
  recipient?: SquareRecipient;
}

export interface SquareFulfillment {
  uid?: string;
  type?: string;
  state?: string;
  shipment_details?: SquareShipmentDetails;
}

export interface SquareLineItem {
  uid?: string;
  catalog_object_id?: string;
  name?: string;
  quantity?: string;
  base_price_money?: SquareMoney;
  total_money?: SquareMoney;
  variation_total_price_money?: SquareMoney;
  gross_sales_money?: SquareMoney;
}

export interface SquareOrder {
  id?: string;
  location_id?: string;
  line_items?: SquareLineItem[];
  fulfillments?: SquareFulfillment[];
  net_amount_due_money?: SquareMoney;
  total_money?: SquareMoney;
}

export interface SquareInvoicePrimaryRecipient {
  customer_id?: string;
  given_name?: string;
  family_name?: string;
  email_address?: string;
  address?: SquareAddress;
}

export interface SquareInvoice {
  id?: string;
  order_id?: string;
  /**
   * Optional pre-expanded order — if the caller already retrieved the
   * referenced order via Square's SDK, attaching it here avoids the
   * need to pass `options.fetchOrder`.
   */
  order?: SquareOrder;
  primary_recipient?: SquareInvoicePrimaryRecipient;
}
