import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, sql, desc, count } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const updateCustomerSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

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

  // Fetch customer stats and recent orders in parallel
  const [customer, addresses, stats, recentOrders] = await Promise.all([
    db.query.customers.findFirst({
      where: and(eq(schema.customers.id, id), eq(schema.customers.storeId, storeId)),
    }),
    db.select().from(schema.addresses).where(and(eq(schema.addresses.customerId, id), eq(schema.addresses.storeId, storeId))),
    db.select({
      orderCount: sql<number>`COUNT(${schema.orders.id})`,
      totalSpent: sql<number>`COALESCE(SUM(${schema.orders.totalAmount}), 0)`,
      avgOrderValue: sql<number>`COALESCE(AVG(${schema.orders.totalAmount}), 0)`,
      lastOrderAt: sql<number>`MAX(${schema.orders.createdAt})`,
    })
    .from(schema.orders)
    .where(and(eq(schema.orders.customerId, id), eq(schema.orders.paymentStatus, 'paid'))).get(),
    db.select({
      id: schema.orders.id,
      status: schema.orders.status,
      totalAmount: schema.orders.totalAmount,
      createdAt: schema.orders.createdAt,
    })
    .from(schema.orders)
    .where(eq(schema.orders.customerId, id))
    .orderBy(desc(schema.orders.createdAt))
    .limit(5),
  ]);

  if (!customer) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, { status: 404 });
  }

  return Response.json({
    data: {
      ...customer,
      addresses,
      stats,
      recentOrders,
    }
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = updateCustomerSchema.parse(body);

    const existing = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, id), eq(schema.customers.storeId, storeId)),
    });

    if (!existing) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, { status: 404 });
    }

    await db.update(schema.customers)
      .set({
        ...validated,
      })
      .where(eq(schema.customers.id, id));

    await db.insert(schema.auditLogs).values({
      id: crypto.randomUUID(),
      storeId,
      actorId: authResult.userId,
      actorRole: authResult.role,
      action: 'customer.updated',
      resourceType: 'customer',
      resourceId: id,
      createdAt: new Date(),
    });

    const updated = await db.query.customers.findFirst({
      where: eq(schema.customers.id, id),
    });

    return Response.json({ data: updated });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
