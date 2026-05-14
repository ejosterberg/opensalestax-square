// SPDX-License-Identifier: Apache-2.0

import {
  centsToDecimalString,
  isSupportedCountry,
  isSupportedCurrency,
  isValidZip,
  normalizeZip,
} from '../src/gates';

describe('gates', () => {
  describe('isSupportedCurrency', () => {
    it('accepts USD (any case)', () => {
      expect(isSupportedCurrency('USD')).toBe(true);
      expect(isSupportedCurrency('usd')).toBe(true);
    });
    it('rejects other currencies', () => {
      expect(isSupportedCurrency('EUR')).toBe(false);
      expect(isSupportedCurrency('CAD')).toBe(false);
    });
    it('rejects undefined / null', () => {
      expect(isSupportedCurrency(undefined)).toBe(false);
      expect(isSupportedCurrency(null)).toBe(false);
    });
  });

  describe('isSupportedCountry', () => {
    it('accepts US (any case)', () => {
      expect(isSupportedCountry('US')).toBe(true);
      expect(isSupportedCountry('us')).toBe(true);
    });
    it('rejects other countries', () => {
      expect(isSupportedCountry('CA')).toBe(false);
      expect(isSupportedCountry('GB')).toBe(false);
    });
    it('rejects undefined / null', () => {
      expect(isSupportedCountry(undefined)).toBe(false);
      expect(isSupportedCountry(null)).toBe(false);
    });
  });

  describe('isValidZip', () => {
    it('accepts 5-digit ZIPs', () => {
      expect(isValidZip('55403')).toBe(true);
      expect(isValidZip('00501')).toBe(true);
    });
    it('accepts ZIP+4', () => {
      expect(isValidZip('55403-1234')).toBe(true);
    });
    it('rejects letters', () => {
      expect(isValidZip('ABCDE')).toBe(false);
    });
    it('rejects partial / over-long', () => {
      expect(isValidZip('1234')).toBe(false);
      expect(isValidZip('123456')).toBe(false);
    });
    it('rejects null / undefined / empty', () => {
      expect(isValidZip(undefined)).toBe(false);
      expect(isValidZip(null)).toBe(false);
      expect(isValidZip('')).toBe(false);
    });
  });

  describe('normalizeZip', () => {
    it('slices to 5 digits', () => {
      expect(normalizeZip('55403-1234')).toBe('55403');
      expect(normalizeZip('55403')).toBe('55403');
    });
  });

  describe('centsToDecimalString', () => {
    it('formats whole dollars', () => {
      expect(centsToDecimalString(10000)).toBe('100.00');
    });
    it('formats cents', () => {
      expect(centsToDecimalString(1234)).toBe('12.34');
      expect(centsToDecimalString(5)).toBe('0.05');
    });
    it('handles negative amounts', () => {
      expect(centsToDecimalString(-1234)).toBe('-12.34');
    });
    it('rounds non-integer cents', () => {
      expect(centsToDecimalString(1234.6)).toBe('12.35');
    });
    it('handles NaN as zero', () => {
      expect(centsToDecimalString(Number.NaN)).toBe('0.00');
    });
  });
});
