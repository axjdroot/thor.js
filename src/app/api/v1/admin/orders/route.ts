import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { sql, eq, and, like, desc, asc, count, or, gte, lte } from 'drizzle-orm';

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
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const status = searchParams.get('status') as any;
  const paymentStatus = searchParams.get('paymentStatus') as any;
  const fulfillmentStatus = searchParams.get('fulfillmentStatus') as any;
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const q = searchParams.get('q');
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortDir = searchParams.get('sortDir') || 'desc';

  const where = and(
    eq(schema.orders.storeId, storeId),
    status ? eq(schema.orders.status, status) : undefined,
    paymentStatus ? eq(schema.orders.paymentStatus, paymentStatus) : undefined,
    fulfillmentStatus ? eq(schema.orders.fulfillmentStatus, fulfillmentStatus) : undefined,
    dateFrom ? gte(schema.orders.createdAt, new Date(dateFrom)) : undefined,
    dateTo ? lte(schema.orders.createdAt, new Date(dateTo)) : undefined,
    q ? or(
      like(schema.orders.id, `%${q}%`),
      like(schema.orders.checkoutEmail, `%${q}%`),
      like(schema.customers.email, `%${q}%`)
    ) : undefined
  );

  const order = sortDir === 'asc' ? asc : desc;
  const orderByColumn = (schema.orders as any)[sortBy] || schema.orders.createdAt;

  const dataQuery = db
    .select({
      id: schema.orders.id,
      createdAt: schema.orders.createdAt,
      status: schema.orders.status,
      paymentStatus: schema.orders.paymentStatus,
      fulfillmentStatus: schema.orders.fulfillmentStatus,
      totalAmount: schema.orders.totalAmount,
      currencyCode: schema.orders.currencyCode,
      checkoutEmail: schema.orders.checkoutEmail,
      customer: {
        id: schema.customers.id,
        email: schema.customers.email,
        firstName: schema.customers.firstName,
        lastName: schema.customers.lastName,
      },
      itemCount: sql<number>`(SELECT COUNT(*) FROM ${schema.orderItems} WHERE order_id = ${schema.orders.id})`,
    })
    .from(schema.orders)
    .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
    .where(where)
    .orderBy(order(orderByColumn))
    .limit(limit)
    .offset((page - 1) * limit);

  const totalQuery = db
    .select({ count: count() })
    .from(schema.orders)
    .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
    .where(where);

  const [results, totalResult] = await Promise.all([dataQuery, totalQuery]);
  const total = totalResult[0].count;
  const totalPages = Math.ceil(total / limit);

  return Response.json({ data: results, meta: { total, page, limit, totalPages } });
}
