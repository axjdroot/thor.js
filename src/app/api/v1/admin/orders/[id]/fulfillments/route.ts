import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const fulfillmentSchema = z.object({
  trackingNumber: z.string().optional(),
  carrier: z.enum(['UPS', 'FedEx', 'DHL', 'USPS', 'Other']).optional(),
  shippedAt: z.string().optional(),
  notifyCustomer: z.boolean().default(true),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const validated = fulfillmentSchema.parse(body);

    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, id), eq(schema.orders.storeId, storeId)),
    });

    if (!order) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404 });
    }

    if (order.status !== 'confirmed' && order.status !== 'processing') {
      return Response.json({ 
        error: { 
          code: 'INVALID_ORDER_STATUS', 
          message: 'Order must be confirmed or processing to be fulfilled' 
        } 
      }, { status: 422 });
    }

    if (order.fulfillmentStatus === 'fulfilled') {
      return Response.json({ 
        error: { 
          code: 'ALREADY_FULFILLED', 
          message: 'Order is already fully fulfilled' 
        } 
      }, { status: 422 });
    }

    const now = new Date();
    const fulfillmentId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(schema.fulfillments).values({
        id: fulfillmentId,
        orderId: id,
        storeId,
        trackingNumber: validated.trackingNumber,
        carrier: validated.carrier,
        shippedAt: validated.shippedAt ? new Date(validated.shippedAt) : now,
        deliveredAt: null,
      });

      // Update order statuses
      const newFulfillmentStatus = 'fulfilled';
      const newStatus = 'shipped';

      await tx.update(schema.orders)
        .set({ 
          fulfillmentStatus: newFulfillmentStatus, 
          status: newStatus,
          updatedAt: now 
        })
        .where(eq(schema.orders.id, id));

      await tx.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        storeId,
        actorId: authResult.userId,
        actorRole: authResult.role,
        action: 'order.fulfilled',
        resourceType: 'order',
        resourceId: id,
        metadata: JSON.stringify({ trackingNumber: validated.trackingNumber, carrier: validated.carrier }),
        createdAt: now,
      });

      await tx.insert(schema.notifications).values({
        id: crypto.randomUUID(),
        storeId,
        type: 'order.fulfilled',
        title: `Order #${id.slice(0, 8)} fulfilled`,
        body: validated.trackingNumber ? `Tracking: ${validated.trackingNumber} (${validated.carrier})` : 'Order has been shipped.',
        createdAt: now,
      });
    });

    const created = await db.query.fulfillments.findFirst({
      where: eq(schema.fulfillments.id, fulfillmentId),
    });

    return Response.json({ data: created });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
