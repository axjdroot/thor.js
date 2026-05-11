import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const updateVariantSchema = z.object({
  sku: z.string().optional(),
  title: z.string().optional(),
  price: z.number().int().optional(),
  compareAtPrice: z.number().int().optional(),
  costPrice: z.number().int().optional(),
  inventoryQuantity: z.number().int().optional(),
  weightGrams: z.number().int().optional(),
  option1: z.string().optional(),
  option2: z.string().optional(),
  option3: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string, variantId: string }> }) {
  const { id, variantId } = await params;
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
    const validated = updateVariantSchema.parse(body);

    const existing = await db.query.variants.findFirst({
      where: and(eq(schema.variants.id, variantId), eq(schema.variants.storeId, storeId)),
    });

    if (!existing) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Variant not found' } }, { status: 404 });
    }

    if (validated.sku && validated.sku !== existing.sku) {
      const dup = await db
        .select({ id: schema.variants.id })
        .from(schema.variants)
        .where(and(eq(schema.variants.storeId, storeId), eq(schema.variants.sku, validated.sku)))
        .limit(1);
      if (dup.length > 0) {
        return Response.json({ error: { code: 'SKU_EXISTS', message: 'SKU already in use' } }, { status: 409 });
      }
    }

    await db.transaction(async (tx) => {
      await tx.update(schema.variants).set(validated).where(eq(schema.variants.id, variantId));

      if (validated.inventoryQuantity !== undefined && validated.inventoryQuantity !== existing.inventoryQuantity) {
        const inventoryId = env.INVENTORY_DO!.idFromName(`inventory:${variantId}`);
        const stub = env.INVENTORY_DO!.get(inventoryId);
        
        await stub.fetch(new Request('http://do/setQuantity', {
          method: 'POST',
          body: JSON.stringify({ variantId: variantId, quantity: validated.inventoryQuantity }),
        }));
      }
    });

    const updated = await db.query.variants.findFirst({
      where: eq(schema.variants.id, variantId),
    });

    return Response.json({ data: updated });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string, variantId: string }> }) {
  const { id, variantId } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  // Check orders
  const hasOrders = await db
    .select({ id: schema.orderItems.id })
    .from(schema.orderItems)
    .where(eq(schema.orderItems.variantId, variantId))
    .limit(1);

  if (hasOrders.length > 0) {
    return Response.json({ error: { code: 'VARIANT_HAS_ORDERS', message: 'Cannot delete variant with orders' } }, { status: 409 });
  }

  await db.delete(schema.variants).where(and(eq(schema.variants.id, variantId), eq(schema.variants.storeId, storeId)));

  return Response.json({ data: { deleted: true } });
}
