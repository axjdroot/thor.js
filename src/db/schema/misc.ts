import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { stores } from './stores';
import { products } from './products';

export const taxRates = sqliteTable('tax_rates', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id),
  name: text('name').notNull(),
  countryCode: text('country_code').notNull(),
  stateCode: text('state_code'),
  rate: text('rate').notNull(),
  appliesToShipping: integer('applies_to_shipping', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  customerId: text('customer_id'),
  authorName: text('author_name').notNull(),
  authorEmail: text('author_email').notNull(),
  rating: integer('rating').notNull(),
  title: text('title'),
  body: text('body').notNull(),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false),
  isApproved: integer('is_approved', { mode: 'boolean' }).default(false),
  helpfulCount: integer('helpful_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id),
  actorId: text('actor_id'),
  actorRole: text('actor_role'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  ipAddress: text('ip_address'),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  resourceIdx: index('idx_audit_resource').on(table.resourceType, table.resourceId),
}));

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  metadata: text('metadata').default('{}'),
  readAt: integer('read_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  storeReadIdx: index('idx_notifications_store').on(table.storeId, table.readAt, table.createdAt),
}));
