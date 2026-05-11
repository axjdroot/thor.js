import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, sql, count, asc } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const createCategorySchema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional().nullable(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
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

  const flatList = await db
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
    .where(eq(schema.categories.storeId, storeId))
    .orderBy(asc(schema.categories.position));

  // Build tree
  const tree: any[] = [];
  const map = new Map();

  flatList.forEach(cat => {
    map.set(cat.id, { ...cat, children: [] });
  });

  flatList.forEach(cat => {
    const node = map.get(cat.id);
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId).children.push(node);
    } else {
      tree.push(node);
    }
  });

  return Response.json({ data: { flat: flatList, tree } });
}

export async function POST(req: Request) {
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
    const validated = createCategorySchema.parse(body);

    const categoryId = crypto.randomUUID();
    let slug = validated.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Slug uniqueness check
    let uniqueSlug = slug;
    let counter = 1;
    while (true) {
      const existing = await db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(and(eq(schema.categories.storeId, storeId), eq(schema.categories.slug, uniqueSlug)))
        .limit(1);
      if (existing.length === 0) break;
      uniqueSlug = `${slug}-${++counter}`;
    }

    // Get max position for siblings
    const maxPosResult = await db
      .select({ maxPos: sql<number>`MAX(${schema.categories.position})` })
      .from(schema.categories)
      .where(and(
        eq(schema.categories.storeId, storeId),
        validated.parentId ? eq(schema.categories.parentId, validated.parentId) : sql`${schema.categories.parentId} IS NULL`
      ));
    
    const nextPosition = (maxPosResult[0]?.maxPos || 0) + 1;

    await db.insert(schema.categories).values({
      id: categoryId,
      storeId,
      name: validated.name,
      slug: uniqueSlug,
      parentId: validated.parentId,
      description: validated.description,
      imageUrl: validated.imageUrl,
      position: nextPosition,
    });

    await env.KV!.delete(`store:${storeId}:categories`);

    const created = await db.query.categories.findFirst({
      where: eq(schema.categories.id, categoryId),
    });

    return Response.json({ data: created }, { status: 201 });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
