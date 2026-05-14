// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';

import type { CalculateLineItem } from './client';

/**
 * Tiny in-memory LRU cache with TTL, used to short-circuit duplicate
 * engine calls for the same ZIP + line bundle.
 *
 * Defaults: max 500 entries, 24h TTL.
 *
 * Merchants who want a shared / multi-process cache should pass their
 * own implementation via `options.cache` (any object with the same
 * `get` / `set` shape).
 */

export interface CacheLike<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 500;

export class InMemoryLruCache<V> implements CacheLike<V> {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  // Map iteration order in JS is insertion-order → cheap LRU by re-set.
  private readonly entries = new Map<string, Entry<V>>();

  constructor(options: { maxEntries?: number; ttlMs?: number } = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  get(key: string): V | undefined {
    const found = this.entries.get(key);
    if (found === undefined) return undefined;
    if (found.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Re-insert to bump LRU position.
    this.entries.delete(key);
    this.entries.set(key, found);
    return found.value;
  }

  set(key: string, value: V): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (typeof oldest === 'string') {
        this.entries.delete(oldest);
      }
    }
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /** Internal — exposed for tests. */
  size(): number {
    return this.entries.size;
  }
}

/**
 * Build a stable cache key from the engine request parameters.
 *
 * SHA-256 over the JSON-canonical encoding, truncated to 32 hex chars
 * (128 bits — more than enough collision resistance for this use case).
 * SHA-256 is used purely for collision resistance on a cache key — not
 * for any auth / integrity purpose — so the choice of hash algorithm
 * doesn't carry security weight.
 */
export function buildCacheKey(
  zip5: string,
  country: string,
  line_items: CalculateLineItem[],
): string {
  const canonical = JSON.stringify({
    zip5,
    country: country.toUpperCase(),
    line_items: line_items.map((l) => ({ amount: l.amount, category: l.category })),
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}
