// SPDX-License-Identifier: Apache-2.0

import { UrlValidationError, validateEngineUrl } from '../src/url-validator';

describe('validateEngineUrl', () => {
  it('accepts a public https URL', () => {
    expect(() => validateEngineUrl('https://ost.example.com')).not.toThrow();
  });

  it('accepts a public http URL', () => {
    expect(() => validateEngineUrl('http://ost.example.com')).not.toThrow();
  });

  it('rejects file: URLs', () => {
    expect(() => validateEngineUrl('file:///etc/passwd')).toThrow(UrlValidationError);
  });

  it('rejects javascript: URLs', () => {
    expect(() => validateEngineUrl('javascript:alert(1)')).toThrow(UrlValidationError);
  });

  it('rejects gopher: URLs', () => {
    expect(() => validateEngineUrl('gopher://x.test')).toThrow(UrlValidationError);
  });

  it('rejects unparseable strings', () => {
    expect(() => validateEngineUrl('not a url')).toThrow(UrlValidationError);
  });

  it('rejects loopback hostnames by default', () => {
    expect(() => validateEngineUrl('http://localhost:8080')).toThrow(UrlValidationError);
    expect(() => validateEngineUrl('http://127.0.0.1:8080')).toThrow(UrlValidationError);
  });

  it('rejects RFC-1918 by default (10.x)', () => {
    expect(() => validateEngineUrl('http://10.0.0.5:8080')).toThrow(UrlValidationError);
  });

  it('rejects RFC-1918 by default (172.16-31)', () => {
    expect(() => validateEngineUrl('http://172.20.0.5:8080')).toThrow(UrlValidationError);
    expect(() => validateEngineUrl('http://172.15.0.5:8080')).not.toThrow();
    expect(() => validateEngineUrl('http://172.32.0.5:8080')).not.toThrow();
  });

  it('rejects RFC-1918 by default (192.168)', () => {
    expect(() => validateEngineUrl('http://192.168.1.5:8080')).toThrow(UrlValidationError);
  });

  it('rejects link-local 169.254.x.x by default', () => {
    expect(() => validateEngineUrl('http://169.254.169.254/latest')).toThrow(UrlValidationError);
  });

  it('rejects IPv6 ::1 by default', () => {
    expect(() => validateEngineUrl('http://[::1]:8080')).toThrow(UrlValidationError);
  });

  it('rejects IPv6 fe80:: link-local by default', () => {
    expect(() => validateEngineUrl('http://[fe80::1]:8080')).toThrow(UrlValidationError);
  });

  it('rejects IPv6 fd00:: unique local by default', () => {
    expect(() => validateEngineUrl('http://[fd00::1]:8080')).toThrow(UrlValidationError);
  });

  it('allows loopback when allowPrivate=true', () => {
    expect(() => validateEngineUrl('http://localhost:8080', { allowPrivate: true })).not.toThrow();
    expect(() => validateEngineUrl('http://10.32.161.126:8080', { allowPrivate: true })).not.toThrow();
  });

  it('rejects malformed IPv4 octets (out of range) at URL parse stage', () => {
    // Node's WHATWG URL parser rejects out-of-range IPv4 literals outright,
    // so this surfaces as a URL parse error rather than reaching our
    // private-network check.
    expect(() => validateEngineUrl('http://999.0.0.1:8080')).toThrow();
  });

  it('rejects 0.0.0.0 by default', () => {
    expect(() => validateEngineUrl('http://0.0.0.0:8080')).toThrow(UrlValidationError);
  });
});
