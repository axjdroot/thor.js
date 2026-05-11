import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const refundSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer', 'other']),
  note: z.string().optional(),
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
    const validated = refundSchema.parse(body);

    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, id), eq(schema.orders.storeId, storeId)),
    });

    if (!order) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404 });
    }

    if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partially_refunded') {
      return Response.json({ 
        error: { 
          code: 'ORDER_NOT_REFUNDABLE', 
          message: 'Order must be paid to be refunded' 
        } 
      }, { status: 422 });
    }

    if (order.status === 'cancelled') {
      return Response.json({ 
        error: { 
          code: 'ORDER_CANCELLED', 
          message: 'Cannot refund a cancelled order' 
        } 
      }, { status: 422 });
    }

    const maxRefundable = order.totalAmount - order.refundedAmount;
    if (validated.amount > maxRefundable) {
      return Response.json({ 
        error: { 
          code: 'INVALID_AMOUNT', 
          message: `Amount exceeds refundable balance of $${(maxRefundable/100).toFixed(2)}` 
        } 
      }, { status: 422 });
    }

    const now = new Date();
    const refundId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(schema.refunds).values({
        id: refundId,
        orderId: id,
        storeId,
        amount: validated.amount,
        reason: validated.reason,
        note: validated.note,
        createdAt: now,
      });

      const newRefundedAmount = order.refundedAmount + validated.amount;
      const isFullyRefunded = newRefundedAmount >= order.totalAmount;

      await tx.update(schema.orders)
        .set({
          refundedAmount: newRefundedAmount,
          paymentStatus: isFullyRefunded ? 'refunded' : 'partially_refunded',
          status: isFullyRefunded ? 'refunded' : order.status,
          updatedAt: now,
        })
        .where(eq(schema.orders.id, id));

      await tx.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        storeId,
        actorId: authResult.userId,
        actorRole: authResult.role,
        action: 'order.refund_created',
        resourceType: 'order',
        resourceId: id,
        metadata: JSON.stringify({ amount: validated.amount, reason: validated.reason }),
        createdAt: now,
      });

      await tx.insert(schema.notifications).values({
        id: crypto.randomUUID(),
        storeId,
        type: 'order.refunded',
        title: `Refund of $${(validated.amount/100).toFixed(2)} issued`,
        body: `Order #${id.slice(0, 8)} has been ${isFullyRefunded ? 'fully' : 'partially'} refunded.`,
        createdAt: now,
      });
    });

    const created = await db.query.refunds.findFirst({
      where: eq(schema.refunds.id, refundId),
    });

    return Response.json({ data: created });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
