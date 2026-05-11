import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const commonCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'SGD', 'NZD', 'HKD'];

const updateStoreSchema = z.object({
  name: z.string().min(1).optional(),
  contactEmail: z.string().email().optional(),
  logoUrl: z.string().url().nullable().optional(),
  currencyCode: z.string().length(3).refine(val => commonCurrencies.includes(val.toUpperCase())).optional(),
  timezone: z.string().optional(),
  orderPrefix: z.string().max(10).regex(/^[A-Z0-9#]+$/).optional(),
  lowStockThreshold: z.number().int().min(1).max(1000).optional(),
  guestCheckoutEnabled: z.boolean().optional(),
});

export async function GET(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  const store = await db.query.stores.findFirst({
    where: eq(schema.stores.id, storeId),
  });

  if (!store) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, { status: 404 });
  }

  return Response.json({ data: store });
}

export async function PATCH(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can update store settings' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = updateStoreSchema.parse(body);

    const existing = await db.query.stores.findFirst({
      where: eq(schema.stores.id, storeId),
    });

    if (!existing) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, { status: 404 });
    }

    const now = new Date();
    await db.update(schema.stores)
      .set({ ...validated, updatedAt: now })
      .where(eq(schema.stores.id, storeId));

    // Invalidate KV cache
    await env.KV!.delete(`store:resolve:${existing.slug}`);
    if (existing.domain) {
      await env.KV!.delete(`store:resolve:${existing.domain}`);
    }

    await db.insert(schema.auditLogs).values({
      id: crypto.randomUUID(),
      storeId,
      actorId: authResult.userId,
      actorRole: authResult.role,
      action: 'store.settings_updated',
      resourceType: 'store',
      resourceId: storeId,
      createdAt: now,
    });

    const updated = await db.query.stores.findFirst({
      where: eq(schema.stores.id, storeId),
    });

    return Response.json({ data: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
        return Response.json({ error: { code: 'VALIDATION_ERROR', details: error.errors } }, { status: 400 });
    }
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
