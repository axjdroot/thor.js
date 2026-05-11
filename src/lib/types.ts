import { schema } from '@/db';
import { InferSelectModel } from 'drizzle-orm';

export type Product = InferSelectModel<typeof schema.products>;
export type Variant = InferSelectModel<typeof schema.variants>;
export type ProductImage = InferSelectModel<typeof schema.productImages>;
export type Category = InferSelectModel<typeof schema.categories>;
export type Store = InferSelectModel<typeof schema.stores>;
export type Order = InferSelectModel<typeof schema.orders>;
export type Customer = InferSelectModel<typeof schema.customers>;

export type ProductWithRelations = Product & {
  variants: Variant[];
  images: ProductImage[];
};
