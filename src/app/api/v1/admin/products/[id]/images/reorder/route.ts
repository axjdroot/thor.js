import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, inArray, and } from 'drizzle-orm';

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

  try {
    const { orderedIds } = await req.json() as { orderedIds: string[] };

    if (!orderedIds || !Array.isArray(orderedIds)) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'orderedIds array is required' } }, { status: 400 });
    }

    // Verify all IDs belong to this product
    const existingCountResult = await db
      .select({ count: sql`count(*)` })
      .from(schema.productImages)
      .where(and(
        eq(schema.productImages.productId, id),
        eq(schema.productImages.storeId, storeId),
        inArray(schema.productImages.id, orderedIds)
      ));
    
    // sql`count(*)` returns an array with a row containing the count
    const existingCount = Number((existingCountResult[0] as any).count);

    if (existingCount !== orderedIds.length) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Some IDs do not belong to this product or store' } }, { status: 403 });
    }

    // Update positions in a batch/transaction
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.update(schema.productImages)
          .set({ position: i })
          .where(and(
            eq(schema.productImages.id, orderedIds[i]),
            eq(schema.productImages.productId, id)
          ));
      }
    });

    return Response.json({ data: { reordered: true } });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}

// Helper to make sql work in the query
import { sql } from 'drizzle-orm';
