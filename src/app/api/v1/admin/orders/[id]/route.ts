import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const updateOrderSchema = z.object({
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
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

  // Fetch complete order with related data using Promise.all
  const [orderWithCustomer, items, fulfillments, refunds] = await Promise.all([
    db.query.orders.findFirst({
      where: and(eq(schema.orders.id, id), eq(schema.orders.storeId, storeId)),
      with: {
        customer: true,
      }
    }),
    db
      .select({
        id: schema.orderItems.id,
        quantity: schema.orderItems.quantity,
        unitPrice: schema.orderItems.unitPrice,
        totalPrice: schema.orderItems.totalPrice,
        productName: schema.orderItems.productName,
        variantTitle: schema.orderItems.variantTitle,
        sku: schema.orderItems.sku,
        variantId: schema.orderItems.variantId,
      })
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, id)),
    db
      .select()
      .from(schema.fulfillments)
      .where(eq(schema.fulfillments.orderId, id)),
    db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.orderId, id)),
  ]);

  if (!orderWithCustomer) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404 });
  }

  // Fetch addresses
  const [shippingAddress, billingAddress] = await Promise.all([
    orderWithCustomer.shippingAddressId ? db.query.addresses.findFirst({ where: eq(schema.addresses.id, orderWithCustomer.shippingAddressId) }) : Promise.resolve(null),
    orderWithCustomer.billingAddressId ? db.query.addresses.findFirst({ where: eq(schema.addresses.id, orderWithCustomer.billingAddressId) }) : Promise.resolve(null),
  ]);

  const responseData = {
    ...orderWithCustomer,
    shippingAddress,
    billingAddress,
    items,
    fulfillments,
    refunds,
  };

  return Response.json({ data: responseData });
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
    const validated = updateOrderSchema.parse(body);

    const existing = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, id), eq(schema.orders.storeId, storeId)),
    });

    if (!existing) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404 });
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.update(schema.orders)
        .set({
          notes: validated.notes !== undefined ? validated.notes : existing.notes,
          metadata: validated.metadata !== undefined ? JSON.stringify(validated.metadata) : existing.metadata,
          updatedAt: now,
        })
        .where(eq(schema.orders.id, id));

      await tx.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        storeId,
        actorId: authResult.userId,
        actorRole: authResult.role,
        action: 'order.updated',
        resourceType: 'order',
        resourceId: id,
        createdAt: now,
      });
    });

    const updated = await db.query.orders.findFirst({
      where: eq(schema.orders.id, id),
    });

    return Response.json({ data: updated });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
