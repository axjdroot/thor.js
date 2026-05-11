import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const statusUpdateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  note: z.string().optional(),
});

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
    const { status: newStatus, note } = statusUpdateSchema.parse(body);

    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, id), eq(schema.orders.storeId, storeId)),
    });

    if (!order) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404 });
    }

    const oldStatus = order.status;

    // Validate transitions
    const validTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered', 'refunded'],
      delivered: ['refunded'],
      cancelled: [],
      refunded: [],
    };

    if (!validTransitions[oldStatus].includes(newStatus)) {
      return Response.json({ 
        error: { 
          code: 'INVALID_TRANSITION', 
          message: `Cannot transition from ${oldStatus} to ${newStatus}` 
        } 
      }, { status: 422 });
    }

    // Cancellation checks
    if (newStatus === 'cancelled' && order.paymentStatus === 'paid') {
      return Response.json({ 
        error: { 
          code: 'CANCEL_PAID_ORDER', 
          message: 'Cannot cancel a paid order. Process a refund first.' 
        } 
      }, { status: 422 });
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      // Restore inventory if cancelled
      if (newStatus === 'cancelled') {
        const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id));
        for (const item of items) {
          if (item.variantId) {
            const inventoryId = env.INVENTORY_DO!.idFromName(`inventory:${item.variantId}`);
            const stub = env.INVENTORY_DO!.get(inventoryId);
            await stub.fetch(new Request('http://do/release', {
              method: 'POST',
              body: JSON.stringify({ variantId: item.variantId, quantity: item.quantity }),
            }));
          }
        }
      }

      await tx.update(schema.orders)
        .set({ status: newStatus, updatedAt: now })
        .where(eq(schema.orders.id, id));

      if (note) {
        await tx.insert(schema.orderNotes).values({
          id: crypto.randomUUID(),
          orderId: id,
          content: note,
          actorId: authResult.userId,
          actorRole: authResult.role,
          createdAt: now,
        });
      }

      await tx.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        storeId,
        actorId: authResult.userId,
        actorRole: authResult.role,
        action: 'order.status_changed',
        resourceType: 'order',
        resourceId: id,
        metadata: JSON.stringify({ from: oldStatus, to: newStatus, note }),
        createdAt: now,
      });

      await tx.insert(schema.notifications).values({
        id: crypto.randomUUID(),
        storeId,
        type: 'order.status_changed',
        title: `Order #${id.slice(0, 8)} → ${newStatus}`,
        body: `Status changed from ${oldStatus} to ${newStatus}`,
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
