import { getKV } from './cf';

export const CACHE_KEYS = {
  product: (id: string) => `product:${id}`,
  productList: (storeId: string) => `products:${storeId}`,
  categories: (storeId: string) => `categories:${storeId}`,
  store: (slug: string) => `store:${slug}`,
  analytics: (storeId: string) => `analytics:${storeId}`,
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  const kv = getKV();
  const data = await kv.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return data as unknown as T;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  const kv = getKV();
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  await kv.put(key, stringValue, { expirationTtl: ttlSeconds });
}

export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached) return cached;

  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

export async function cacheInvalidate(key: string): Promise<void> {
  const kv = getKV();
  await kv.delete(key);
}
