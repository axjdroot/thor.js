import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const updateZoneSchema = z.object({
  name: z.string().min(1).optional(),
  countryCodes: z.array(z.string().length(2)).min(1).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ zoneId: string }> }) {
  const { zoneId } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can update shipping zones' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = updateZoneSchema.parse(body);

    const existing = await db.query.shippingZones.findFirst({
      where: and(eq(schema.shippingZones.id, zoneId), eq(schema.shippingZones.storeId, storeId)),
    });

    if (!existing) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Shipping zone not found' } }, { status: 404 });
    }

    const updateData: any = { ...validated };
    if (validated.countryCodes) {
      updateData.countryCodes = JSON.stringify(validated.countryCodes.map(c => c.toUpperCase()));
    }

    await db.update(schema.shippingZones)
      .set(updateData)
      .where(eq(schema.shippingZones.id, zoneId));

    const updated = await db.query.shippingZones.findFirst({
      where: eq(schema.shippingZones.id, zoneId),
    });

    return Response.json({ data: updated });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ zoneId: string }> }) {
  const { zoneId } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can delete shipping zones' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  // Cascade delete is handled by database FK constraint
  await db.delete(schema.shippingZones).where(and(eq(schema.shippingZones.id, zoneId), eq(schema.shippingZones.storeId, storeId)));

  return Response.json({ data: { deleted: true } });
}
