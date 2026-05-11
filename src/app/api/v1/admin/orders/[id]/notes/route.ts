import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const noteSchema = z.object({
  content: z.string().min(1).max(1000),
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
    const { content } = noteSchema.parse(body);

    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, id), eq(schema.orders.storeId, storeId)),
    });

    if (!order) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, { status: 404 });
    }

    const now = new Date();
    const noteId = crypto.randomUUID();

    await db.insert(schema.orderNotes).values({
      id: noteId,
      orderId: id,
      content,
      actorId: authResult.userId,
      actorRole: authResult.role,
      createdAt: now,
    });

    const created = await db.query.orderNotes.findFirst({
      where: eq(schema.orderNotes.id, noteId),
    });

    return Response.json({ data: created });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
