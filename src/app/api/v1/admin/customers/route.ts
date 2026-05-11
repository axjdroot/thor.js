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
  const q = searchParams.get('q');
  const isBanned = searchParams.get('isBanned');
  const sortBy = searchParams.get('sortBy') || 'id'; // use id as proxy for created_at if missing
  const sortDir = searchParams.get('sortDir') || 'desc';

  const where = and(
    eq(schema.customers.storeId, storeId),
    isBanned !== null ? eq(schema.customers.isBanned, isBanned === 'true') : undefined,
    q ? or(
      like(schema.customers.email, `%${q}%`),
      like(schema.customers.firstName, `%${q}%`),
      like(schema.customers.lastName, `%${q}%`)
    ) : undefined
  );

  const order = sortDir === 'asc' ? asc : desc;
  const orderByColumn = (schema.customers as any)[sortBy] || schema.customers.id;

  const results = await db
    .select({
      id: schema.customers.id,
      clerkUserId: schema.customers.clerkUserId,
      email: schema.customers.email,
      firstName: schema.customers.firstName,
      lastName: schema.customers.lastName,
      phone: schema.customers.phone,
      isBanned: schema.customers.isBanned,
      emailVerifiedAt: schema.customers.emailVerifiedAt,
      // orderCount, totalSpent, lastOrderAt, defaultAddress
      orderCount: sql<number>`(SELECT COUNT(*) FROM ${schema.orders} WHERE customer_id = ${schema.customers.id})`,
      totalSpent: sql<number>`(SELECT COALESCE(SUM(total_amount), 0) FROM ${schema.orders} WHERE customer_id = ${schema.customers.id} AND status != 'cancelled')`,
      lastOrderAt: sql<number>`(SELECT MAX(created_at) FROM ${schema.orders} WHERE customer_id = ${schema.customers.id})`,
      defaultAddress: sql<string>`(SELECT json_object('city', city, 'countryCode', country_code) FROM ${schema.addresses} WHERE customer_id = ${schema.customers.id} AND is_default = 1 LIMIT 1)`,
    })
    .from(schema.customers)
    .where(where)
    .orderBy(order(orderByColumn))
    .limit(limit)
    .offset((page - 1) * limit);

  const totalResult = await db
    .select({ count: count() })
    .from(schema.customers)
    .where(where);

  const total = totalResult[0].count;

  const formatted = results.map(r => ({
    ...r,
    defaultAddress: typeof r.defaultAddress === 'string' ? JSON.parse(r.defaultAddress) : null
  }));

  return Response.json({ data: formatted, meta: { total, page, limit } });
}
