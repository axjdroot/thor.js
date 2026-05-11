import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, desc } from 'drizzle-orm';

export const runtime = 'edge';

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

  const [auditLogs, orderNotes, fulfillments] = await Promise.all([
    db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.resourceId, id), eq(schema.auditLogs.resourceType, 'order'))).orderBy(desc(schema.auditLogs.createdAt)),
    db.select().from(schema.orderNotes).where(eq(schema.orderNotes.orderId, id)).orderBy(desc(schema.orderNotes.createdAt)),
    db.select().from(schema.fulfillments).where(eq(schema.fulfillments.orderId, id)).orderBy(desc(schema.fulfillments.shippedAt)),
  ]);

  const timeline: any[] = [];

  auditLogs.forEach(log => {
    let type = 'admin_action';
    let icon = 'Activity';
    let title = log.action;
    let description = '';

    if (log.action === 'order.status_changed') {
      type = 'status_change';
      icon = 'RefreshCcw';
      const meta = JSON.parse(log.metadata || '{}');
      title = `Status: ${meta.from} → ${meta.to}`;
      description = meta.note || '';
    } else if (log.action === 'order.refund_created') {
      type = 'refund';
      icon = 'RotateCcw';
      const meta = JSON.parse(log.metadata || '{}');
      title = `Refund issued: $${(meta.amount / 100).toFixed(2)}`;
      description = meta.reason || '';
    }

    timeline.push({
      type,
      icon,
      title,
      description,
      actor: log.actorId,
      createdAt: log.createdAt,
    });
  });

  orderNotes.forEach(note => {
    timeline.push({
      type: 'note',
      icon: 'MessageSquare',
      title: 'Note added',
      description: note.content,
      actor: note.actorId,
      createdAt: note.createdAt,
    });
  });

  fulfillments.forEach(f => {
    timeline.push({
      type: 'fulfillment',
      icon: 'Truck',
      title: 'Order fulfilled',
      description: f.trackingNumber ? `${f.carrier}: ${f.trackingNumber}` : 'Shipped without tracking',
      createdAt: f.shippedAt,
    });
  });

  // Sort by createdAt ASC as requested
  timeline.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return Response.json({ data: timeline });
}
