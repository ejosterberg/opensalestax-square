// SPDX-License-Identifier: Apache-2.0

/**
 * SSRF defense for the embedded OpenSalesTaxClient.
 *
 * Validates that the configured engine URL:
 *  - Parses as a URL
 *  - Uses `http:` or `https:` (no `file:` / `javascript:` / `gopher:`)
 *  - Does NOT resolve to a loopback / private / link-local literal,
 *    unless the caller explicitly passes `allowPrivate: true`
 *
 * DNS-level rebinding is out of scope (the engine URL is set by the
 * merchant in their own process and not user-supplied). We're defending
 * against operator mistakes — e.g. wiring a public-internet base URL
 * that points back inside the cluster — rather than a malicious admin.
 */

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

export interface ValidateOptions {
  /**
   * When true, allow loopback / RFC-1918 / link-local hosts. Defaults
   * to false. Set to true in dev or for merchants whose engine lives
   * on a private network.
   */
  allowPrivate?: boolean;
}

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlValidationError';
  }
}

export function validateEngineUrl(
  rawUrl: string,
  options: ValidateOptions = {},
): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UrlValidationError(`Engine URL is not a valid URL: '${rawUrl}'`);
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new UrlValidationError(
      `Engine URL must use http: or https: (got '${parsed.protocol}')`,
    );
  }

  if (options.allowPrivate === true) {
    return parsed;
  }

  const host = parsed.hostname.toLowerCase();

  if (host === '' || host === 'localhost' || host === 'ip6-localhost') {
    throw new UrlValidationError(
      `Engine URL resolves to loopback host '${parsed.hostname}'. Pass ` +
        `allowPrivate: true to permit private-network engines.`,
    );
  }

  if (isLoopbackOrPrivateIPv4(host)) {
    throw new UrlValidationError(
      `Engine URL host '${parsed.hostname}' is loopback or RFC-1918 private. ` +
        `Pass allowPrivate: true to permit private-network engines.`,
    );
  }

  if (isPrivateIPv6(host)) {
    throw new UrlValidationError(
      `Engine URL host '${parsed.hostname}' is IPv6 loopback or link-local. ` +
        `Pass allowPrivate: true to permit private-network engines.`,
    );
  }

  return parsed;
}

function isLoopbackOrPrivateIPv4(host: string): boolean {
  const octets = host.split('.');
  if (octets.length !== 4) return false;
  const nums: number[] = [];
  for (const o of octets) {
    if (!/^\d{1,3}$/.test(o)) return false;
    const n = Number.parseInt(o, 10);
    if (n < 0 || n > 255) return false;
    nums.push(n);
  }
  const a = nums[0] as number;
  const b = nums[1] as number;
  // 127.0.0.0/8
  if (a === 127) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 link-local
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8
  if (a === 0) return true;
  return false;
}

function isPrivateIPv6(host: string): boolean {
  // URL.hostname returns IPv6 wrapped in brackets stripped — e.g. "::1"
  const h = host.replace(/^\[/, '').replace(/]$/, '').toLowerCase();
  if (h === '::1') return true;
  if (h === '::') return true;
  // fe80::/10 link-local
  if (h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) {
    return true;
  }
  // fc00::/7 unique local
  if (h.startsWith('fc') || h.startsWith('fd')) {
    return true;
  }
  return false;
}
