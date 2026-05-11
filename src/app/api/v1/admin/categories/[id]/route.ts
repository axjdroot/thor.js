import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  parentId: z.string().optional().nullable(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  position: z.number().optional(),
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

  const category = await db
    .select({
      id: schema.categories.id,
      storeId: schema.categories.storeId,
      name: schema.categories.name,
      slug: schema.categories.slug,
      parentId: schema.categories.parentId,
      description: schema.categories.description,
      imageUrl: schema.categories.imageUrl,
      position: schema.categories.position,
      productCount: sql<number>`(SELECT COUNT(*) FROM ${schema.productCategories} WHERE category_id = ${schema.categories.id})`,
    })
    .from(schema.categories)
    .where(and(eq(schema.categories.id, id), eq(schema.categories.storeId, storeId)))
    .get();

  if (!category) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Category not found' } }, { status: 404 });
  }

  return Response.json({ data: category });
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
    const validated = updateCategorySchema.parse(body);

    const existing = await db.query.categories.findFirst({
      where: and(eq(schema.categories.id, id), eq(schema.categories.storeId, storeId)),
    });

    if (!existing) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Category not found' } }, { status: 404 });
    }

    let slug = existing.slug;
    if (validated.name && validated.name !== existing.name) {
      slug = validated.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let uniqueSlug = slug;
      let counter = 1;
      while (true) {
        const dup = await db
          .select({ id: schema.categories.id })
          .from(schema.categories)
          .where(and(eq(schema.categories.storeId, storeId), eq(schema.categories.slug, uniqueSlug), sql`${schema.categories.id} != ${id}`))
          .limit(1);
        if (dup.length === 0) break;
        uniqueSlug = `${slug}-${++counter}`;
      }
      slug = uniqueSlug;
    }

    if (validated.parentId) {
      if (validated.parentId === id) {
        return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Cannot set parent to self' } }, { status: 400 });
      }
      // Check for circular reference (simplified: just check if parent exists)
      const parent = await db.query.categories.findFirst({
        where: and(eq(schema.categories.id, validated.parentId), eq(schema.categories.storeId, storeId)),
      });
      if (!parent) {
        return Response.json({ error: { code: 'NOT_FOUND', message: 'Parent category not found' } }, { status: 404 });
      }
    }

    await db.update(schema.categories)
      .set({ ...validated, slug })
      .where(eq(schema.categories.id, id));

    await env.KV!.delete(`store:${storeId}:categories`);

    const updated = await db.query.categories.findFirst({
      where: eq(schema.categories.id, id),
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

  const existing = await db.query.categories.findFirst({
    where: and(eq(schema.categories.id, id), eq(schema.categories.storeId, storeId)),
  });

  if (!existing) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Category not found' } }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    // Reassign children to parent
    await tx.update(schema.categories)
      .set({ parentId: existing.parentId })
      .where(eq(schema.categories.parentId, id));

    // Delete relationships
    await tx.delete(schema.productCategories).where(eq(schema.productCategories.categoryId, id));

    // Delete category
    await tx.delete(schema.categories).where(eq(schema.categories.id, id));
  });

  await env.KV!.delete(`store:${storeId}:categories`);

  return Response.json({ data: { deleted: true } });
}
