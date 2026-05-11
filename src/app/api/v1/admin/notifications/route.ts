import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, isNull, desc, count } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const authResult = await requireAdminAuth();
    if (authResult instanceof Response) return authResult;

    const { env } = getRequestContext();
    const db = createDb(env.DB!);
    const storeId = req.headers.get('X-Store-ID');

    if (!storeId) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where = and(
      eq(schema.notifications.storeId, storeId),
      unreadOnly ? isNull(schema.notifications.readAt) : undefined
    );

    const [notifications, unreadResult] = await Promise.all([
      db.query.notifications.findMany({
        where,
        orderBy: desc(schema.notifications.createdAt),
        limit,
      }),
      db.select({ count: count() })
        .from(schema.notifications)
        .where(and(eq(schema.notifications.storeId, storeId), isNull(schema.notifications.readAt)))
    ]);

    return Response.json({
      data: notifications,
      meta: { unreadCount: unreadResult[0].count }
    });
  } catch (error: any) {
    console.error("Notifications API Error:", error);
    return Response.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
