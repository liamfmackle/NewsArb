// Simple cache that works without Redis for MVP
// Redis integration disabled to avoid build issues

let cache: Map<string, { value: unknown; expires: number }> = new Map();
const redisAvailable = false;
const redis = null;

// Cache helper functions - using in-memory cache for MVP
export async function getCache<T>(key: string): Promise<T | null> {
  const item = cache.get(key);
  if (!item) return null;

  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }

  return item.value as T;
}

export async function setCache(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  cache.set(key, {
    value,
    expires: Date.now() + ttlSeconds * 1000,
  });
}

export async function deleteCache(key: string): Promise<void> {
  // Delete matching keys (supports simple pattern matching)
  for (const k of cache.keys()) {
    if (k.startsWith(key.replace("*", ""))) {
      cache.delete(k);
    }
  }
}

// Clean expired items periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of cache.entries()) {
    if (now > item.expires) {
      cache.delete(key);
    }
  }
}, 60000);

export { redis, redisAvailable };
