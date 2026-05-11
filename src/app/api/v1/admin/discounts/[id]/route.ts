import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const updateDiscountSchema = z.object({
  value: z.number().int().optional(),
  minOrderAmount: z.number().int().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

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

  const discount = await db.query.discounts.findFirst({
    where: and(eq(schema.discounts.id, id), eq(schema.discounts.storeId, storeId)),
  });

  if (!discount) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Discount not found' } }, { status: 404 });
  }

  return Response.json({ data: discount });
}

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
    const body = await req.json();
    const validated = updateDiscountSchema.parse(body);

    const existing = await db.query.discounts.findFirst({
      where: and(eq(schema.discounts.id, id), eq(schema.discounts.storeId, storeId)),
    });

    if (!existing) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Discount not found' } }, { status: 404 });
    }

    const updateData: any = { ...validated };
    if (validated.startsAt !== undefined) updateData.startsAt = validated.startsAt ? new Date(validated.startsAt) : null;
    if (validated.endsAt !== undefined) updateData.endsAt = validated.endsAt ? new Date(validated.endsAt) : null;

    await db.update(schema.discounts).set(updateData).where(eq(schema.discounts.id, id));

    await db.insert(schema.auditLogs).values({
      id: crypto.randomUUID(),
      storeId,
      actorId: authResult.userId,
      actorRole: authResult.role,
      action: 'discount.updated',
      resourceType: 'discount',
      resourceId: id,
      createdAt: new Date(),
    });

    const updated = await db.query.discounts.findFirst({
      where: eq(schema.discounts.id, id),
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

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  const existing = await db.query.discounts.findFirst({
    where: and(eq(schema.discounts.id, id), eq(schema.discounts.storeId, storeId)),
  });

  if (!existing) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Discount not found' } }, { status: 404 });
  }

  if ((existing.usageCount || 0) > 0) {
    return Response.json({ 
      error: { 
        code: 'DISCOUNT_USED', 
        message: 'Cannot delete a used discount. Deactivate it instead.' 
      } 
    }, { status: 409 });
  }

  await db.delete(schema.discounts).where(eq(schema.discounts.id, id));

  await db.insert(schema.auditLogs).values({
    id: crypto.randomUUID(),
    storeId,
    actorId: authResult.userId,
    actorRole: authResult.role,
    action: 'discount.deleted',
    resourceType: 'discount',
    resourceId: id,
    createdAt: new Date(),
  });

  return Response.json({ data: { deleted: true } });
}
