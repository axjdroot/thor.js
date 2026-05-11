import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, like, sql, desc, count, or } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
  const q = searchParams.get('q');
  const lowStockOnly = searchParams.get('lowStockOnly') === 'true';
  const outOfStockOnly = searchParams.get('outOfStockOnly') === 'true';

  const store = await db.query.stores.findFirst({
    where: eq(schema.stores.id, storeId),
  });

  const lowStockThreshold = store?.lowStockThreshold || 10;

  const where = and(
    eq(schema.variants.storeId, storeId),
    lowStockOnly ? and(sql`${schema.variants.inventoryQuantity} < ${lowStockThreshold}`, sql`${schema.variants.inventoryQuantity} > 0`) : undefined,
    outOfStockOnly ? eq(schema.variants.inventoryQuantity, 0) : undefined,
    q ? or(like(schema.variants.sku, `%${q}%`), like(schema.products.name, `%${q}%`)) : undefined
  );

  const variants = await db
    .select({
      id: schema.variants.id,
      sku: schema.variants.sku,
      title: schema.variants.title,
      inventoryQuantity: schema.variants.inventoryQuantity,
      product: {
        id: schema.products.id,
        name: schema.products.name,
        slug: schema.products.slug,
        imageUrl: sql<string>`(SELECT url FROM ${schema.productImages} WHERE product_id = ${schema.products.id} LIMIT 1)`,
      },
    })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .where(where)
    .orderBy(schema.variants.inventoryQuantity)
    .limit(limit)
    .offset((page - 1) * limit);

  const totalResult = await db
    .select({ count: count() })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .where(where);

  const total = totalResult[0].count;

  // Batch fetch live data from InventoryDO
  const items = await Promise.all(
    variants.map(async (v) => {
      try {
        const id = env.INVENTORY_DO!.idFromName(`inventory:${v.id}`);
        const stub = env.INVENTORY_DO!.get(id);
        // Using RPC-style call as requested
        const available = await (stub as any).getAvailable(v.id);
        const reserved = (v.inventoryQuantity || 0) - available;
        
        return {
          ...v,
          available,
          reserved,
          lowStockThreshold,
          isLowStock: (v.inventoryQuantity || 0) < lowStockThreshold,
          isOutOfStock: v.inventoryQuantity === 0,
        };
      } catch (error) {
        return {
          ...v,
          available: v.inventoryQuantity || 0,
          reserved: 0,
          lowStockThreshold,
          isLowStock: (v.inventoryQuantity || 0) < lowStockThreshold,
          isOutOfStock: v.inventoryQuantity === 0,
        };
      }
    })
  );

  return Response.json({ data: items, meta: { total, page, limit } });
}
