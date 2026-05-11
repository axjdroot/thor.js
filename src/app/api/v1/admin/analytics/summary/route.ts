import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, sql, gte } from 'drizzle-orm';

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

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Stats for the last 30 days
  const [stats, customerCount, chartData] = await Promise.all([
    db.select({
      totalRevenue: sql<number>`SUM(${schema.orders.totalAmount})`,
      orderCount: sql<number>`COUNT(${schema.orders.id})`,
    })
    .from(schema.orders)
    .where(and(
      eq(schema.orders.storeId, storeId), 
      eq(schema.orders.paymentStatus, 'paid'), 
      gte(schema.orders.createdAt, thirtyDaysAgo)
    )).get(),

    db.select({ count: sql<number>`COUNT(*)` })
    .from(schema.customers)
    .where(eq(schema.customers.storeId, storeId)).get(),

    db.select({
      date: sql<string>`strftime('%m-%d', datetime(${schema.orders.createdAt} / 1000, 'unixepoch'))`,
      revenue: sql<number>`SUM(${schema.orders.totalAmount})`,
    })
    .from(schema.orders)
    .where(and(eq(schema.orders.storeId, storeId), eq(schema.orders.paymentStatus, 'paid')))
    .groupBy(sql`date`)
    .orderBy(sql`date`)
    .limit(7)
  ]);

  const revenue = Number(stats?.totalRevenue || 0);
  const orders = Number(stats?.orderCount || 0);
  const customers = Number(customerCount?.count || 0);
  const aov = orders > 0 ? revenue / orders : 0;

  const data = [{
    revenue: { total: revenue, change: 0 },
    orders: { total: orders, change: 0 },
    customers: { total: customers, change: 0 },
    aov: { total: aov, change: 0 },
    chartData: chartData.map(d => ({ date: d.date, revenue: d.revenue })),
  }];

  return Response.json(data);
}
