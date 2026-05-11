import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { sql, eq, and, like, desc, asc, count, or } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  categoryIds: z.array(z.string()).optional(),
  taxInclusive: z.boolean().default(false),
});

export async function GET(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const q = searchParams.get('q');
  const status = searchParams.get('status') as any;
  const categorySlug = searchParams.get('category');
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortDir = searchParams.get('sortDir') || 'desc';

  const where = and(
    eq(schema.products.storeId, storeId),
    status ? eq(schema.products.status, status) : undefined,
    q ? or(like(schema.products.name, `%${q}%`), like(schema.products.description, `%${q}%`)) : undefined
  );

  // Subquery for category filtering if categorySlug is provided
  let categoryFilter: any = undefined;
  if (categorySlug) {
    const categoryIdQuery = db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(and(eq(schema.categories.storeId, storeId), eq(schema.categories.slug, categorySlug)))
      .limit(1);
    
    const categoryIds = await categoryIdQuery;
    if (categoryIds.length > 0) {
      const productIdsInCategory = db
        .select({ productId: schema.productCategories.productId })
        .from(schema.productCategories)
        .where(eq(schema.productCategories.categoryId, categoryIds[0].id));
      
      categoryFilter = sql`${schema.products.id} IN (${productIdsInCategory})`;
    } else {
      return Response.json({ data: [], meta: { total: 0, page, limit, totalPages: 0 } });
    }
  }

  const finalWhere = categoryFilter ? and(where, categoryFilter) : where;

  // Ordering
  const order = sortDir === 'asc' ? asc : desc;
  const orderByColumn = (schema.products as any)[sortBy] || schema.products.createdAt;

  const dataQuery = db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      slug: schema.products.slug,
      status: schema.products.status,
      createdAt: schema.products.createdAt,
      price: sql<number>`(SELECT MIN(price) FROM ${schema.variants} WHERE product_id = ${schema.products.id})`,
      maxPrice: sql<number>`(SELECT MAX(price) FROM ${schema.variants} WHERE product_id = ${schema.products.id})`,
      stock: sql<number>`(SELECT SUM(inventory_quantity) FROM ${schema.variants} WHERE product_id = ${schema.products.id})`,
      variantCount: sql<number>`(SELECT COUNT(*) FROM ${schema.variants} WHERE product_id = ${schema.products.id})`,
      image: sql<string>`(SELECT url FROM ${schema.productImages} WHERE product_id = ${schema.products.id} ORDER BY position ASC LIMIT 1)`,
    })
    .from(schema.products)
    .where(finalWhere)
    .orderBy(order(orderByColumn))
    .limit(limit)
    .offset((page - 1) * limit);

  const totalQuery = db
    .select({ count: count() })
    .from(schema.products)
    .where(finalWhere);

  const [results, totalResult] = await Promise.all([dataQuery, totalQuery]);
  const total = totalResult[0].count;
  const totalPages = Math.ceil(total / limit);

  return Response.json({ data: results, meta: { total, page, limit, totalPages } });
}

export async function POST(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const validated = createProductSchema.parse(body);

    const productId = crypto.randomUUID();
    let slug = validated.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Slug uniqueness check
    let uniqueSlug = slug;
    let counter = 1;
    while (true) {
      const existing = await db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(and(eq(schema.products.storeId, storeId), eq(schema.products.slug, uniqueSlug)))
        .limit(1);
      
      if (existing.length === 0) break;
      uniqueSlug = `${slug}-${++counter}`;
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(schema.products).values({
        id: productId,
        storeId,
        name: validated.name,
        slug: uniqueSlug,
        description: validated.description,
        status: validated.status,
        taxInclusive: validated.taxInclusive,
        createdAt: now,
        updatedAt: now,
      });

      if (validated.categoryIds?.length) {
        await tx.insert(schema.productCategories).values(
          validated.categoryIds.map(catId => ({
            productId,
            categoryId: catId,
          }))
        );
      }

      // Default variant
      await tx.insert(schema.variants).values({
        id: crypto.randomUUID(),
        productId,
        storeId,
        sku: `${validated.name.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: 'Default',
        price: 0,
        inventoryQuantity: 0,
      });

      // Audit log
      await tx.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        storeId,
        actorId: authResult.userId,
        actorRole: authResult.role,
        action: 'product.created',
        resourceType: 'product',
        resourceId: productId,
        createdAt: now,
      });
    });

    const createdProduct = await db.query.products.findFirst({
      where: eq(schema.products.id, productId),
    });

    return Response.json({ data: createdProduct }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 });
    }
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
