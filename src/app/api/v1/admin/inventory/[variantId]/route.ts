import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const inventoryAdjustmentSchema = z.object({
  quantity: z.number().int().min(0),
  reason: z.string().min(5).max(200),
});

export async function GET(req: Request, { params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  const [variant, history] = await Promise.all([
    db.query.variants.findFirst({
      where: and(eq(schema.variants.id, variantId), eq(schema.variants.storeId, storeId)),
      with: { product: true }
    }),
    db.query.auditLogs.findMany({
      where: and(eq(schema.auditLogs.resourceType, 'inventory'), eq(schema.auditLogs.resourceId, variantId)),
      orderBy: desc(schema.auditLogs.createdAt),
      limit: 20
    })
  ]);

  if (!variant) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Variant not found' } }, { status: 404 });
  }

  const id = env.INVENTORY_DO!.idFromName(`inventory:${variantId}`);
  const stub = env.INVENTORY_DO!.get(id);
  const available = await (stub as any).getAvailable(variantId);
  const reserved = variant.inventoryQuantity - available;

  return Response.json({
    data: {
      ...variant,
      available,
      reserved,
      history
    }
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
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
    const validated = inventoryAdjustmentSchema.parse(body);

    const variant = await db.query.variants.findFirst({
      where: and(eq(schema.variants.id, variantId), eq(schema.variants.storeId, storeId)),
    });

    if (!variant) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Variant not found' } }, { status: 404 });
    }

    const id = env.INVENTORY_DO!.idFromName(`inventory:${variantId}`);
    const stub = env.INVENTORY_DO!.get(id);
    const available = await (stub as any).getAvailable(variantId);
    const reserved = variant.inventoryQuantity - available;

    if (validated.quantity < reserved) {
      return Response.json({ 
        error: { 
          code: 'BELOW_RESERVED', 
          message: `Cannot set quantity below reserved amount (${reserved} units reserved in active carts)` 
        } 
      }, { status: 422 });
    }

    const oldQuantity = variant.inventoryQuantity;
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.update(schema.variants)
        .set({ inventoryQuantity: validated.quantity })
        .where(eq(schema.variants.id, variantId));

      // RPC call to DO
      await (stub as any).setTotal(variantId, validated.quantity);

      await tx.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        storeId,
        actorId: authResult.userId,
        actorRole: authResult.role,
        action: 'inventory.adjusted',
        resourceType: 'inventory',
        resourceId: variantId,
        metadata: JSON.stringify({
          from: oldQuantity,
          to: validated.quantity,
          change: validated.quantity - oldQuantity,
          reason: validated.reason
        }),
        createdAt: now,
      });

      const store = await tx.query.stores.findFirst({ where: eq(schema.stores.id, storeId) });
      const threshold = store?.lowStockThreshold || 10;

      if (validated.quantity < threshold && validated.quantity > 0) {
        await tx.insert(schema.notifications).values({
          id: crypto.randomUUID(),
          storeId,
          type: 'inventory.low_stock',
          title: `Low stock: ${variant.sku}`,
          body: `Only ${validated.quantity} units remaining`,
          createdAt: now,
        });
      } else if (validated.quantity === 0) {
        await tx.insert(schema.notifications).values({
          id: crypto.randomUUID(),
          storeId,
          type: 'inventory.out_of_stock',
          title: `Out of stock: ${variant.sku}`,
          body: `${variant.sku} is now out of stock`,
          createdAt: now,
        });
      }
    });

    return Response.json({
      data: {
        variantId: variantId,
        oldQuantity,
        newQuantity: validated.quantity,
        reserved,
        available: validated.quantity - reserved,
        reason: validated.reason
      }
    });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
