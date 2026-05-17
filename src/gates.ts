// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

/**
 * Eligibility gates: USD currency, US country, valid ZIP.
 *
 * Gates return a boolean â€” caller wraps in a zero-tax result with the
 * matching `skippedReason` when any gate fails. We deliberately don't
 * throw; gates are control flow, not errors.
 */

export const SUPPORTED_CURRENCY = 'USD';
export const SUPPORTED_COUNTRY = 'US';
export const ZIP_REGEX = /^\d{5}(-\d{4})?$/;
export const DEFAULT_CATEGORY = 'general';

export function isSupportedCurrency(currency: string | undefined | null): boolean {
  if (currency === undefined || currency === null) return false;
  return currency.toUpperCase() === SUPPORTED_CURRENCY;
}

export function isSupportedCountry(country: string | undefined | null): boolean {
  if (country === undefined || country === null) return false;
  return country.toUpperCase() === SUPPORTED_COUNTRY;
}

export function isValidZip(postal: string | undefined | null): boolean {
  if (postal === undefined || postal === null) return false;
  return ZIP_REGEX.test(postal);
}

/** Slice the leading 5-digit segment from a ZIP or ZIP+4. */
export function normalizeZip(postal: string): string {
  return postal.slice(0, 5);
}

/** Cents â†’ "X.XX" decimal string. No thousands separator. */
export function centsToDecimalString(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const dollars = Math.floor(abs / 100);
  const remainder = (abs % 100).toString().padStart(2, '0');
  return `${sign}${dollars}.${remainder}`;
}
