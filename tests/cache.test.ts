// SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later

import { buildCacheKey, InMemoryLruCache } from '../src/cache';

describe('InMemoryLruCache', () => {
  it('returns undefined for unknown keys', () => {
    const cache = new InMemoryLruCache<string>();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('stores and retrieves values', () => {
    const cache = new InMemoryLruCache<string>();
    cache.set('a', 'alpha');
    expect(cache.get('a')).toBe('alpha');
  });

  it('expires entries past the TTL', () => {
    const cache = new InMemoryLruCache<string>({ ttlMs: 10 });
    cache.set('a', 'alpha');
    const realNow = Date.now;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(realNow() + 1000);
    expect(cache.get('a')).toBeUndefined();
    spy.mockRestore();
  });

  it('evicts the oldest entry past maxEntries', () => {
    const cache = new InMemoryLruCache<string>({ maxEntries: 2 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    expect(cache.size()).toBe(2);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
  });

  it('bumps LRU position on read', () => {
    const cache = new InMemoryLruCache<string>({ maxEntries: 2 });
    cache.set('a', '1');
    cache.set('b', '2');
    // Read 'a' so it becomes most-recently used
    cache.get('a');
    cache.set('c', '3');
    // 'b' should have been evicted, not 'a'
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
  });

  it('overwrites existing keys without growing past max', () => {
    const cache = new InMemoryLruCache<string>({ maxEntries: 2 });
    cache.set('a', '1');
    cache.set('a', '1b');
    expect(cache.get('a')).toBe('1b');
    expect(cache.size()).toBe(1);
  });
});

describe('buildCacheKey', () => {
  it('produces a stable key for identical inputs', () => {
    const k1 = buildCacheKey('55403', 'US', [{ amount: '100.00', category: 'general' }]);
    const k2 = buildCacheKey('55403', 'US', [{ amount: '100.00', category: 'general' }]);
    expect(k1).toBe(k2);
  });

  it('produces different keys for different ZIPs', () => {
    const k1 = buildCacheKey('55403', 'US', [{ amount: '100.00', category: 'general' }]);
    const k2 = buildCacheKey('94103', 'US', [{ amount: '100.00', category: 'general' }]);
    expect(k1).not.toBe(k2);
  });

  it('produces different keys for different line bundles', () => {
    const k1 = buildCacheKey('55403', 'US', [{ amount: '100.00', category: 'general' }]);
    const k2 = buildCacheKey('55403', 'US', [{ amount: '200.00', category: 'general' }]);
    expect(k1).not.toBe(k2);
  });

  it('normalizes country to uppercase', () => {
    const k1 = buildCacheKey('55403', 'US', [{ amount: '100.00', category: 'general' }]);
    const k2 = buildCacheKey('55403', 'us', [{ amount: '100.00', category: 'general' }]);
    expect(k1).toBe(k2);
  });

  it('returns a 32-character hex string', () => {
    const k = buildCacheKey('55403', 'US', [{ amount: '1.00', category: 'general' }]);
    expect(k).toMatch(/^[0-9a-f]{32}$/);
  });
});
