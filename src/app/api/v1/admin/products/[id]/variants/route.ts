import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const createVariantSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  price: z.number().int(),
  compareAtPrice: z.number().int().optional(),
  costPrice: z.number().int().optional(),
  inventoryQuantity: z.number().int().default(0),
  weightGrams: z.number().int().optional(),
  option1: z.string().optional(),
  option2: z.string().optional(),
  option3: z.string().optional(),
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

  const variants = await db
    .select()
    .from(schema.variants)
    .where(and(eq(schema.variants.productId, id), eq(schema.variants.storeId, storeId)));

  return Response.json({ data: variants });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const validated = createVariantSchema.parse(body);

    // SKU uniqueness check
    const existingSku = await db
      .select({ id: schema.variants.id })
      .from(schema.variants)
      .where(and(eq(schema.variants.storeId, storeId), eq(schema.variants.sku, validated.sku)))
      .limit(1);

    if (existingSku.length > 0) {
      return Response.json({ error: { code: 'SKU_EXISTS', message: 'SKU already in use' } }, { status: 409 });
    }

    const variantId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(schema.variants).values({
        id: variantId,
        productId: id,
        storeId,
        ...validated,
      });

      // Sync InventoryDO
      const inventoryId = env.INVENTORY_DO!.idFromName(`inventory:${variantId}`);
      const stub = env.INVENTORY_DO!.get(inventoryId);
      await stub.fetch(new Request('http://do/initialize', {
        method: 'POST',
        body: JSON.stringify({ variantId, quantity: validated.inventoryQuantity }),
      }));
    });

    const created = await db.query.variants.findFirst({
      where: eq(schema.variants.id, variantId),
    });

    return Response.json({ data: created }, { status: 201 });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
