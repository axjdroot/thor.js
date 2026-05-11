import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { stores } from './stores';

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  status: text('status', { enum: ['draft', 'active', 'archived'] }).default('draft').notNull(),
  taxInclusive: integer('tax_inclusive', { mode: 'boolean' }).default(false),
  weightGrams: integer('weight_grams'),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  storeSlugIdx: unique().on(table.storeId, table.slug),
  storeStatusIdx: index('idx_products_store_status').on(table.storeId, table.status),
  storeSlugIdx2: index('idx_products_store_slug').on(table.storeId, table.slug),
}));

export const variants = sqliteTable('variants', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  storeId: text('store_id').notNull().references(() => stores.id),
  sku: text('sku').notNull(),
  title: text('title').notNull(),
  price: integer('price').notNull(), // cents
  compareAtPrice: integer('compare_at_price'),
  costPrice: integer('cost_price'),
  inventoryQuantity: integer('inventory_quantity').default(0).notNull(),
  weightGrams: integer('weight_grams'),
  option1: text('option1'),
  option2: text('option2'),
  option3: text('option3'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
}, (table) => ({
  storeSkuIdx: unique().on(table.storeId, table.sku),
  productIdx: index('idx_variants_product').on(table.productId),
  storeSkuIdx2: index('idx_variants_store_sku').on(table.storeId, table.sku),
}));

export const productImages = sqliteTable('product_images', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  storeId: text('store_id').notNull().references(() => stores.id),
  url: text('url').notNull(),
  r2Key: text('r2_key'),
  alt: text('alt'),
  position: integer('position').default(0),
});

export const productOptions = sqliteTable('product_options', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').default(0),
});

export const productOptionValues = sqliteTable('product_option_values', {
  id: text('id').primaryKey(),
  optionId: text('option_id').notNull().references(() => productOptions.id, { onDelete: 'cascade' }),
  value: text('value').notNull(),
  position: integer('position').default(0),
});
