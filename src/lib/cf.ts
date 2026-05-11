import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb } from '@/db';

export function getEnv() {
  const ctx = getRequestContext();
  if (!ctx || !ctx.env) {
    throw new Error(
      'Cloudflare environment not found. Please run with "npm run dev:pages" or "npm run preview".'
    );
  }
  return ctx.env;
}

export function getDB() {
  return createDb(getEnv().DB!);
}

export function getKV() {
  return getEnv().KV!;
}

export function getR2() {
  return getEnv().R2!;
}

export function getAI() {
  return getEnv().AI!;
}

export async function trackEvent({
  type,
  storeId,
  customerId = 'guest',
  properties = {},
  valueInCents = 0,
}: {
  type: string;
  storeId: string;
  customerId?: string;
  properties?: any;
  valueInCents?: number;
}) {
  try {
    const { ANALYTICS } = getEnv();
    if (ANALYTICS) {
      ANALYTICS.writeDataPoint({
        blobs: [type, storeId, customerId, JSON.stringify(properties)],
        doubles: [Date.now(), valueInCents],
        indexes: [storeId],
      });
    }
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

export function getCartDO(id: string) {
  const env = getEnv();
  return env.CART_DO!.get(env.CART_DO!.idFromString(id));
}

export function getInventoryDO(variantId: string) {
  const env = getEnv();
  const id = env.INVENTORY_DO!.idFromName(`inventory:${variantId}`);
  return env.INVENTORY_DO!.get(id);
}
