import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const stores = sqliteTable('stores', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  domain: text('domain').unique(),
  contactEmail: text('contact_email').notNull(),
  logoUrl: text('logo_url'),
  currencyCode: text('currency_code').default('USD').notNull(),
  timezone: text('timezone').default('UTC').notNull(),
  orderPrefix: text('order_prefix'),
  lowStockThreshold: integer('low_stock_threshold').default(5),
  guestCheckoutEnabled: integer('guest_checkout_enabled', { mode: 'boolean' }).default(true),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
