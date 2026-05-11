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

  const addresses = await db
    .select()
    .from(schema.addresses)
    .where(and(eq(schema.addresses.customerId, id), eq(schema.addresses.storeId, storeId)))
    .orderBy(desc(schema.addresses.isDefault));

  return Response.json({ data: addresses });
}
