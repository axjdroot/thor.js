import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const updateTaxRateSchema = z.object({
  name: z.string().min(1).optional(),
  rate: z.string().refine(val => {
    const parsed = parseFloat(val);
    return !isNaN(parsed) && parsed >= 0 && parsed <= 1;
  }, "Rate must be between 0 and 1").optional(),
  appliesToShipping: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can update tax rates' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = updateTaxRateSchema.parse(body);

    const existing = await db.query.taxRates.findFirst({
      where: and(eq(schema.taxRates.id, id), eq(schema.taxRates.storeId, storeId)),
    });

    if (!existing) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Tax rate not found' } }, { status: 404 });
    }

    await db.update(schema.taxRates)
      .set(validated)
      .where(eq(schema.taxRates.id, id));

    const updated = await db.query.taxRates.findFirst({
      where: eq(schema.taxRates.id, id),
    });

    return Response.json({ data: updated });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can delete tax rates' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  await db.delete(schema.taxRates).where(and(eq(schema.taxRates.id, id), eq(schema.taxRates.storeId, storeId)));

  return Response.json({ data: { deleted: true } });
}
