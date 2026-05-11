import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';

/**
 * Run this ONCE after seeding D1 data.
 * It initializes all InventoryDO instances with the total stock from D1.
 * After this, all inventory changes go through the PATCH endpoint
 * which keeps D1 and DO in sync automatically.
 */
export async function POST(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can initialize inventory' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  const variants = await db
    .select({
      id: schema.variants.id,
      inventoryQuantity: schema.variants.inventoryQuantity,
    })
    .from(schema.variants)
    .where(eq(schema.variants.storeId, storeId));

  await Promise.all(
    variants.map(async (v) => {
      const id = env.INVENTORY_DO!.idFromName(`inventory:${v.id}`);
      const stub = env.INVENTORY_DO!.get(id);
      // RPC style call
      await (stub as any).initialize(v.id, v.inventoryQuantity);
    })
  );

  return Response.json({ data: { initialized: variants.length } });
}
