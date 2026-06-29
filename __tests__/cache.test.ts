import { cacheClear, cacheGet, cacheSet, cacheSize } from '../lib/cache';

describe('cache', () => {
  beforeEach(() => {
    cacheClear();
  });

  test('returns stored value while ttl is valid', () => {
    cacheSet('k1', { ok: true }, 1000);
    expect(cacheGet<{ ok: boolean }>('k1')).toEqual({ ok: true });
  });

  test('expires values after ttl', async () => {
    cacheSet('k2', 'value', 5);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(cacheGet('k2')).toBeNull();
  });

  test('tracks current cache size', () => {
    cacheSet('a', 1);
    cacheSet('b', 2);
    expect(cacheSize()).toBe(2);
  });
});
