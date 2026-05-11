import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { stores } from './stores';

export const discounts = sqliteTable('discounts', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id),
  code: text('code').notNull(),
  type: text('type', { enum: ['percentage', 'fixed_amount', 'free_shipping'] }).notNull(),
  value: integer('value').notNull(),
  minOrderAmount: integer('min_order_amount').default(0),
  usageLimit: integer('usage_limit'),
  usageCount: integer('usage_count').default(0),
  startsAt: integer('starts_at', { mode: 'timestamp_ms' }),
  endsAt: integer('ends_at', { mode: 'timestamp_ms' }),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
}, (table) => ({
  storeCodeIdx: uniqueIndex('idx_discounts_store_code').on(table.storeId, table.code),
}));

export const shippingZones = sqliteTable('shipping_zones', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id),
  name: text('name').notNull(),
  countryCodes: text('country_codes').notNull(),
});

export const shippingZonesRelations = relations(shippingZones, ({ many }) => ({
  rates: many(shippingRates),
}));

export const shippingRates = sqliteTable('shipping_rates', {
  id: text('id').primaryKey(),
  zoneId: text('zone_id').notNull().references(() => shippingZones.id, { onDelete: 'cascade' }),
  storeId: text('store_id').notNull().references(() => stores.id),
  name: text('name').notNull(),
  rateType: text('rate_type', { enum: ['flat', 'free', 'percentage', 'per_item'] }).notNull(),
  rateValue: integer('rate_value').notNull(),
  minOrderAmount: integer('min_order_amount').default(0),
  maxOrderAmount: integer('max_order_amount'),
  estimatedDaysMin: integer('estimated_days_min'),
  estimatedDaysMax: integer('estimated_days_max'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

export const shippingRatesRelations = relations(shippingRates, ({ one }) => ({
  zone: one(shippingZones, {
    fields: [shippingRates.zoneId],
    references: [shippingZones.id],
  }),
}));
