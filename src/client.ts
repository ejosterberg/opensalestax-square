// SPDX-License-Identifier: Apache-2.0

import { validateEngineUrl } from './url-validator';

/**
 * Minimal HTTP client for the OpenSalesTax engine.
 *
 * Uses the global `fetch` available on Node 20+ — no axios / node-fetch
 * dependency. Keeps the published bundle small and dodges CJS/ESM
 * compatibility issues.
 *
 * Modeled on the Medusa and Vendure connectors. Embedded here because
 * the standalone `opensalestax-js` SDK isn't published to NPM yet.
 *
 * SSRF: the constructor delegates URL validation to
 * `validateEngineUrl()`. Pass `allowPrivate: true` to permit
 * loopback / RFC-1918 hosts (dev / on-prem deployments).
 */

export interface OpenSalesTaxClientOptions {
  baseUrl: string;
  apiKey?: string;
  /** Per-request timeout in milliseconds. Default 5000. */
  timeoutMs?: number;
  /** Permit private-network / loopback engine URLs. Default false. */
  allowPrivate?: boolean;
}

export interface CalculateLineItem {
  /** Pre-tax decimal string, e.g. "100.00". */
  amount: string;
  /** One of OST's six categories or "" to skip. */
  category: string;
}

export interface CalculateRequest {
  address: { zip5: string };
  line_items: CalculateLineItem[];
}

export interface JurisdictionRate {
  type: string;
  name: string;
  rate_pct: string;
  tax: string | null;
}

export interface CalculatedLine {
  amount: string;
  category: string;
  tax: string;
  rate_pct: string;
  jurisdictions: JurisdictionRate[];
  note?: string | null;
}

export interface CalculateResponse {
  subtotal: string;
  tax_total: string;
  lines: CalculatedLine[];
  disclaimer?: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  database_connected: boolean;
}

export class OpenSalesTaxApiError extends Error {
  public readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OpenSalesTaxApiError';
    this.status = status;
  }
}

export class OpenSalesTaxClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  constructor(options: OpenSalesTaxClientOptions) {
    validateEngineUrl(options.baseUrl, {
      allowPrivate: options.allowPrivate === true,
    });
    // Strip trailing slashes using a simple loop (avoids ReDoS-class
    // regex flagged by Sonar's S5852).
    let normalized = options.baseUrl;
    while (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    this.baseUrl = normalized;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  /** POST /v1/calculate. */
  async calculate(req: CalculateRequest): Promise<CalculateResponse> {
    return this.post<CalculateResponse>('/v1/calculate', req);
  }

  /** GET /v1/health — reachability probe. */
  async healthCheck(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/v1/health');
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.apiKey !== undefined && this.apiKey !== '') {
      headers['X-API-Key'] = this.apiKey;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const init: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new OpenSalesTaxApiError(
        `Network error contacting OpenSalesTax engine at ${this.baseUrl}: ${message}`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new OpenSalesTaxApiError(
        `OpenSalesTax engine returned HTTP ${response.status}${
          text ? ': ' + text.slice(0, 200) : ''
        }`,
        response.status,
      );
    }

    try {
      return (await response.json()) as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new OpenSalesTaxApiError(
        `OpenSalesTax engine returned malformed JSON: ${message}`,
      );
    }
  }
}
