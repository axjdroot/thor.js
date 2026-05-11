import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const updateRateSchema = z.object({
  name: z.string().min(1).optional(),
  rateType: z.enum(['flat', 'free', 'percentage', 'per_item']).optional(),
  rateValue: z.number().int().min(0).optional(),
  minOrderAmount: z.number().int().min(0).nullable().optional(),
  maxOrderAmount: z.number().int().min(0).nullable().optional(),
  estimatedDaysMin: z.number().int().min(1).max(365).nullable().optional(),
  estimatedDaysMax: z.number().int().min(1).max(365).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ zoneId: string, rateId: string }> }) {
  const { zoneId, rateId } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can update shipping rates' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = updateRateSchema.parse(body);

    const existing = await db.query.shippingRates.findFirst({
      where: and(
        eq(schema.shippingRates.id, rateId),
        eq(schema.shippingRates.zoneId, zoneId),
        eq(schema.shippingRates.storeId, storeId)
      ),
    });

    if (!existing) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Shipping rate not found' } }, { status: 404 });
    }

    await db.update(schema.shippingRates)
      .set(validated)
      .where(eq(schema.shippingRates.id, rateId));

    const updated = await db.query.shippingRates.findFirst({
      where: eq(schema.shippingRates.id, rateId),
    });

    return Response.json({ data: updated });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ zoneId: string, rateId: string }> }) {
  const { zoneId, rateId } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can delete shipping rates' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  await db.delete(schema.shippingRates).where(and(
    eq(schema.shippingRates.id, rateId),
    eq(schema.shippingRates.zoneId, zoneId),
    eq(schema.shippingRates.storeId, storeId)
  ));

  return Response.json({ data: { deleted: true } });
}
