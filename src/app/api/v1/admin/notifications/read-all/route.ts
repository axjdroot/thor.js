import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, isNull } from 'drizzle-orm';

export const runtime = 'edge';

export async function PATCH(req: Request) {
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
    .where(and(eq(schema.notifications.storeId, storeId), isNull(schema.notifications.readAt)));

  return Response.json({ data: { updated: true } });
}
