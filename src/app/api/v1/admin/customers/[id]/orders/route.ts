import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, desc, sql, count } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const status = searchParams.get('status') as any;

  const where = and(
    eq(schema.orders.customerId, id),
    eq(schema.orders.storeId, storeId),
    status ? eq(schema.orders.status, status) : undefined
  );

  const dataQuery = db
    .select({
      id: schema.orders.id,
      status: schema.orders.status,
      paymentStatus: schema.orders.paymentStatus,
      totalAmount: schema.orders.totalAmount,
      currencyCode: schema.orders.currencyCode,
      createdAt: schema.orders.createdAt,
      itemCount: sql<number>`(SELECT COUNT(*) FROM ${schema.orderItems} WHERE order_id = ${schema.orders.id})`,
    })
    .from(schema.orders)
    .where(where)
    .orderBy(desc(schema.orders.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const totalQuery = db
    .select({ count: count() })
    .from(schema.orders)
    .where(where);

  const [results, totalResult] = await Promise.all([dataQuery, totalQuery]);
  const total = totalResult[0].count;

  return Response.json({ data: results, meta: { total, page, limit } });
}
