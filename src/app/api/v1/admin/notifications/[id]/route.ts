import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, isNull } from 'drizzle-orm';

export const runtime = 'edge';

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

  await db.update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(
      eq(schema.notifications.id, id),
      eq(schema.notifications.storeId, storeId),
      isNull(schema.notifications.readAt)
    ));

  return Response.json({ data: { read: true } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  await db.delete(schema.notifications)
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.storeId, storeId)));

  return Response.json({ data: { deleted: true } });
}
