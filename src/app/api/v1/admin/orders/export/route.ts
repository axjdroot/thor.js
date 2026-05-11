import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, like, or, gte, lte, sql } from 'drizzle-orm';

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
  const status = searchParams.get('status') as any;
  const paymentStatus = searchParams.get('paymentStatus') as any;
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const q = searchParams.get('q');

  const where = and(
    eq(schema.orders.storeId, storeId),
    status ? eq(schema.orders.status, status) : undefined,
    paymentStatus ? eq(schema.orders.paymentStatus, paymentStatus) : undefined,
    dateFrom ? gte(schema.orders.createdAt, new Date(dateFrom)) : undefined,
    dateTo ? lte(schema.orders.createdAt, new Date(dateTo)) : undefined,
    q ? or(
      like(schema.orders.id, `%${q}%`),
      like(schema.orders.checkoutEmail, `%${q}%`),
      like(schema.customers.email, `%${q}%`)
    ) : undefined
  );

  const orders = await db
    .select({
      id: schema.orders.id,
      createdAt: schema.orders.createdAt,
      firstName: schema.customers.firstName,
      lastName: schema.customers.lastName,
      email: schema.orders.checkoutEmail,
      status: schema.orders.status,
      paymentStatus: schema.orders.paymentStatus,
      subtotalAmount: schema.orders.subtotalAmount,
      shippingAmount: schema.orders.shippingAmount,
      taxAmount: schema.orders.taxAmount,
      discountAmount: schema.orders.discountAmount,
      totalAmount: schema.orders.totalAmount,
      currencyCode: schema.orders.currencyCode,
      itemCount: sql<number>`(SELECT COUNT(*) FROM ${schema.orderItems} WHERE order_id = ${schema.orders.id})`,
    })
    .from(schema.orders)
    .leftJoin(schema.customers, eq(schema.orders.customerId, schema.customers.id))
    .where(where)
    .limit(10000);

  let csv = 'OrderID,Date,Customer,Email,Status,PaymentStatus,Items,Subtotal,Shipping,Tax,Discount,Total,Currency\n';
  orders.forEach(o => {
    const row = [
      o.id,
      o.createdAt ? new Date(o.createdAt).toISOString() : '',
      `"${(o.firstName || '')} ${(o.lastName || '')}".trim()`,
      o.email,
      o.status,
      o.paymentStatus,
      o.itemCount,
      o.subtotalAmount / 100,
      o.shippingAmount / 100,
      o.taxAmount / 100,
      o.discountAmount / 100,
      o.totalAmount / 100,
      o.currencyCode,
    ].join(',');
    csv += row + '\n';
  });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="orders.csv"'
    }
  });
}
