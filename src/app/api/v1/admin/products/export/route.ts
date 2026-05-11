import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, like, or, sql } from 'drizzle-orm';

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
  const q = searchParams.get('q');
  const status = searchParams.get('status') as any;

  const where = and(
    eq(schema.products.storeId, storeId),
    status ? eq(schema.products.status, status) : undefined,
    q ? or(like(schema.products.name, `%${q}%`), like(schema.products.description, `%${q}%`)) : undefined
  );

  const products = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      slug: schema.products.slug,
      status: schema.products.status,
      sku: schema.variants.sku,
      price: schema.variants.price,
      inventory: schema.variants.inventoryQuantity,
      createdAt: schema.products.createdAt,
    })
    .from(schema.products)
    .leftJoin(schema.variants, eq(schema.products.id, schema.variants.productId))
    .where(where)
    .limit(10000);

  let csv = 'ID,Name,Slug,Status,SKU,Price,Inventory,Created\n';
  products.forEach(p => {
    const row = [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.slug,
      p.status,
      p.sku || '',
      (p.price || 0) / 100,
      p.inventory || 0,
      p.createdAt ? new Date(p.createdAt).toISOString() : '',
    ].join(',');
    csv += row + '\n';
  });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="products.csv"'
    }
  });
}
