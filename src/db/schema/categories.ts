import { sqliteTable, text, integer, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { stores } from './stores';
import { products } from './products';

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  storeId: text('store_id').notNull().references(() => stores.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  parentId: text('parent_id'),
  description: text('description'),
  imageUrl: text('image_url'),
  position: integer('position').default(0),
}, (table) => ({
  storeSlugIdx: uniqueIndex('idx_categories_store_slug').on(table.storeId, table.slug),
}));

export const productCategories = sqliteTable('product_categories', {
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.productId, table.categoryId] }),
}));
