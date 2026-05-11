import { drizzle } from 'drizzle-orm/d1';
import * as stores from './schema/stores';
import * as products from './schema/products';
import * as categories from './schema/categories';
import * as customers from './schema/customers';
import * as orders from './schema/orders';
import * as discounts from './schema/discounts';
import * as misc from './schema/misc';

export const schema = {
  ...stores,
  ...products,
  ...categories,
  ...customers,
  ...orders,
  ...discounts,
  ...misc,
};

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;

export * from './schema/stores';
export * from './schema/products';
export * from './schema/categories';
export * from './schema/customers';
export * from './schema/orders';
export * from './schema/discounts';
export * from './schema/misc';
