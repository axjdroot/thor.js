import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';

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

  const results = await db
    .select({
      id: schema.customers.id,
      email: schema.customers.email,
      firstName: schema.customers.firstName,
      lastName: schema.customers.lastName,
      phone: schema.customers.phone,
      isBanned: schema.customers.isBanned,
      orderCount: sql<number>`(SELECT COUNT(*) FROM ${schema.orders} WHERE customer_id = ${schema.customers.id})`,
      totalSpent: sql<number>`(SELECT COALESCE(SUM(total_amount), 0) FROM ${schema.orders} WHERE customer_id = ${schema.customers.id} AND status != 'cancelled')`,
    })
    .from(schema.customers)
    .where(eq(schema.customers.storeId, storeId))
    .limit(10000);

  let csv = 'ID,Email,FirstName,LastName,Phone,Orders,TotalSpent,Banned\n';
  results.forEach(r => {
    const row = [
      r.id,
      r.email,
      r.firstName || '',
      r.lastName || '',
      r.phone || '',
      r.orderCount,
      (r.totalSpent / 100).toFixed(2),
      r.isBanned ? 'YES' : 'NO',
    ].join(',');
    csv += row + '\n';
  });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="customers.csv"'
    }
  });
}
