import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  taxInclusive: z.boolean().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  weightGrams: z.number().optional(),
  categoryIds: z.array(z.string()).optional(),
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

  const product = await db.query.products.findFirst({
    where: and(eq(schema.products.id, id), eq(schema.products.storeId, storeId)),
    with: {
      variants: {
        orderBy: (variants: any, { asc }: any) => [asc(variants.id)],
      },
      images: {
        orderBy: (images: any, { asc }: any) => [asc(images.position)],
      },
    }
  });

  if (!product) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, { status: 404 });
  }

  // Get categories separately as many-to-many with Drizzle query API can be complex
  const categories = await db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      slug: schema.categories.slug,
    })
    .from(schema.productCategories)
    .innerJoin(schema.categories, eq(schema.productCategories.categoryId, schema.categories.id))
    .where(eq(schema.productCategories.productId, id));

  return Response.json({ data: { ...product, categories } });
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
    const validated = updateProductSchema.parse(body);

    const existing = await db.query.products.findFirst({
      where: and(eq(schema.products.id, id), eq(schema.products.storeId, storeId)),
    });

    if (!existing) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, { status: 404 });
    }

    let slug = existing.slug;
    if (validated.name && validated.name !== existing.name) {
      slug = validated.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let uniqueSlug = slug;
      let counter = 1;
      while (true) {
        const dup = await db
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(and(eq(schema.products.storeId, storeId), eq(schema.products.slug, uniqueSlug), eq(schema.products.id, id)))
          .limit(1);
        
        if (dup.length === 0 || dup[0].id === id) break;
        uniqueSlug = `${slug}-${++counter}`;
      }
      slug = uniqueSlug;
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.update(schema.products)
        .set({
          ...validated,
          slug,
          updatedAt: now,
        } as any)
        .where(eq(schema.products.id, id));

      if (validated.categoryIds !== undefined) {
        await tx.delete(schema.productCategories).where(eq(schema.productCategories.productId, id));
        if (validated.categoryIds.length > 0) {
          await tx.insert(schema.productCategories).values(
            validated.categoryIds.map(catId => ({
              productId: id,
              categoryId: catId,
            }))
          );
        }
      }

      await tx.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        storeId,
        actorId: authResult.userId,
        actorRole: authResult.role,
        action: 'product.updated',
        resourceType: 'product',
        resourceId: id,
        createdAt: now,
      });
    });

    // Invalidate KV cache
    await env.KV!.delete(`store:${storeId}:product:${existing.slug}`);
    if (slug !== existing.slug) {
      await env.KV!.delete(`store:${storeId}:product:${slug}`);
    }

    const updated = await db.query.products.findFirst({
      where: eq(schema.products.id, id),
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

  const existing = await db.query.products.findFirst({
    where: and(eq(schema.products.id, id), eq(schema.products.storeId, storeId)),
  });

  if (!existing) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, { status: 404 });
  }

  // Check for orders
  const ordersWithProduct = await db
    .select({ id: schema.orders.id })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .innerJoin(schema.variants, eq(schema.orderItems.variantId, schema.variants.id))
    .where(and(eq(schema.variants.productId, id), eq(schema.orders.paymentStatus, 'paid'))) 
    .limit(1);

  if (ordersWithProduct.length > 0) {
    return Response.json({ 
      error: { 
        code: 'PRODUCT_HAS_ORDERS', 
        message: 'Cannot delete product with existing orders. Archive it instead.' 
      } 
    }, { status: 409 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.products).where(eq(schema.products.id, id));
    
    await tx.insert(schema.auditLogs).values({
      id: crypto.randomUUID(),
      storeId,
      actorId: authResult.userId,
      actorRole: authResult.role,
      action: 'product.deleted',
      resourceType: 'product',
      resourceId: id,
      createdAt: new Date(),
    });
  });

  await env.KV!.delete(`store:${storeId}:product:${existing.slug}`);

  return Response.json({ data: { deleted: true } });
}
