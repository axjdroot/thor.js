import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { stores } from './stores';

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id),
  clerkUserId: text('clerk_user_id').unique().notNull(),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  isBanned: integer('is_banned', { mode: 'boolean' }).default(false),
  emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp_ms' }),
}, (table) => ({
  storeEmailUnique: unique().on(table.storeId, table.email),
  clerkIdx: index('idx_customers_clerk').on(table.clerkUserId),
  storeEmailIdx: index('idx_customers_store_email').on(table.storeId, table.email),
}));

export const addresses = sqliteTable('addresses', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  storeId: text('store_id').notNull().references(() => stores.id),
  name: text('name').notNull(),
  line1: text('line1').notNull(),
  line2: text('line2'),
  city: text('city').notNull(),
  state: text('state'),
  postalCode: text('postal_code').notNull(),
  countryCode: text('country_code').notNull(),
  phone: text('phone'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
});
