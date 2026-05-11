import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { stores } from './stores';
import { customers, addresses } from './customers';

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id),
  customerId: text('customer_id').references(() => customers.id),
  checkoutEmail: text('checkout_email').notNull(),
  status: text('status', { enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] }).default('pending').notNull(),
  paymentStatus: text('payment_status', { enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'disputed'] }).default('pending').notNull(),
  fulfillmentStatus: text('fulfillment_status', { enum: ['unfulfilled', 'partially_fulfilled', 'fulfilled', 'returned'] }).default('unfulfilled').notNull(),
  currencyCode: text('currency_code').notNull(),
  subtotalAmount: integer('subtotal_amount').notNull(),
  discountAmount: integer('discount_amount').default(0).notNull(),
  shippingAmount: integer('shipping_amount').default(0).notNull(),
  taxAmount: integer('tax_amount').default(0).notNull(),
  totalAmount: integer('total_amount').notNull(),
  refundedAmount: integer('refunded_amount').default(0).notNull(),
  shippingAddressId: text('shipping_address_id').references(() => addresses.id),
  billingAddressId: text('billing_address_id').references(() => addresses.id),
  paymentIntentId: text('payment_intent_id').unique(),
  idempotencyKey: text('idempotency_key').unique(),
  confirmationEmailSentAt: integer('confirmation_email_sent_at', { mode: 'timestamp_ms' }),
  notes: text('notes'),
  metadata: text('metadata').default('{}').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => ({
  storeStatusIdx: index('idx_orders_store_status').on(table.storeId, table.status),
  customerIdx: index('idx_orders_customer').on(table.customerId, table.createdAt),
  paymentIntentIdx: index('idx_orders_payment_intent').on(table.paymentIntentId),
}));

export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  storeId: text('store_id').notNull().references(() => stores.id),
  variantId: text('variant_id'),
  productName: text('product_name').notNull(),
  variantTitle: text('variant_title').notNull(),
  sku: text('sku'),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  totalPrice: integer('total_price').notNull(),
});

export const fulfillments = sqliteTable('fulfillments', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  storeId: text('store_id').notNull().references(() => stores.id),
  trackingNumber: text('tracking_number'),
  carrier: text('carrier'),
  shippedAt: integer('shipped_at', { mode: 'timestamp_ms' }),
  deliveredAt: integer('delivered_at', { mode: 'timestamp_ms' }),
});

export const refunds = sqliteTable('refunds', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  storeId: text('store_id').notNull().references(() => stores.id),
  amount: integer('amount').notNull(),
  reason: text('reason'),
  stripeRefundId: text('stripe_refund_id'),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const orderNotes = sqliteTable('order_notes', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  actorId: text('actor_id'),
  actorRole: text('actor_role'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});
