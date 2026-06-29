interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const store = new Map<string, CacheEntry<unknown>>();
let writes = 0;

function cleanupExpired(now = Date.now()): void {
  for (const [key, value] of store.entries()) {
    if (value.expiresAt <= now) {
      store.delete(key);
    }
  }
}

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): void {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });

  writes += 1;
  if (writes % 100 === 0) {
    cleanupExpired();
  }
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheClear(): void {
  store.clear();
  writes = 0;
}

export function cacheSize(): number {
  return store.size;
}

export const cacheConfig = {
  CACHE_TTL_MS,
  cleanupExpired
};
