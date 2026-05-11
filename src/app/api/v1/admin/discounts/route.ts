import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, like, desc, sql, count } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const createDiscountSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9-]+$/),
  type: z.enum(['percentage', 'fixed_amount', 'free_shipping']),
  value: z.number().int(),
  minOrderAmount: z.number().int().optional(),
  usageLimit: z.number().int().positive().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  isActive: z.boolean().default(true),
}).refine(data => {
  if (data.startsAt && data.endsAt) {
    return new Date(data.endsAt) > new Date(data.startsAt);
  }
  return true;
}, {
  message: "endsAt must be after startsAt",
  path: ["endsAt"]
}).refine(data => {
  if (data.type === 'percentage') return data.value >= 1 && data.value <= 10000;
  if (data.type === 'fixed_amount') return data.value > 0;
  if (data.type === 'free_shipping') return data.value === 0;
  return true;
}, {
  message: "Invalid value for discount type",
  path: ["value"]
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

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const q = searchParams.get('q');
  const isActive = searchParams.get('isActive');
  const type = searchParams.get('type') as any;

  const where = and(
    eq(schema.discounts.storeId, storeId),
    isActive !== null ? eq(schema.discounts.isActive, isActive === 'true') : undefined,
    type ? eq(schema.discounts.type, type) : undefined,
    q ? like(schema.discounts.code, `%${q.toUpperCase()}%`) : undefined
  );

  const results = await db
    .select()
    .from(schema.discounts)
    .where(where)
    .orderBy(desc(schema.discounts.id)) // Proxy for created_at
    .limit(limit)
    .offset((page - 1) * limit);

  const totalResult = await db
    .select({ count: count() })
    .from(schema.discounts)
    .where(where);

  const now = Date.now();
  const data = results.map(d => {
    const isExpired = d.endsAt && new Date(d.endsAt).getTime() < now;
    const isScheduled = d.startsAt && new Date(d.startsAt).getTime() > now;
    let effectiveStatus = 'active';
    if (!d.isActive) effectiveStatus = 'inactive';
    else if (isExpired) effectiveStatus = 'expired';
    else if (isScheduled) effectiveStatus = 'scheduled';

    return {
      ...d,
      isExpired,
      isScheduled,
      effectiveStatus
    };
  });

  return Response.json({ data, meta: { total: totalResult[0].count, page, limit } });
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
    const validated = createDiscountSchema.parse(body);

    const existing = await db
      .select({ id: schema.discounts.id })
      .from(schema.discounts)
      .where(and(
        eq(sql`LOWER(${schema.discounts.code})`, validated.code.toLowerCase()),
        eq(schema.discounts.storeId, storeId)
      ))
      .limit(1);

    if (existing.length > 0) {
      return Response.json({ error: { code: 'CODE_TAKEN', message: 'Discount code already exists' } }, { status: 409 });
    }

    const discountId = crypto.randomUUID();
    await db.insert(schema.discounts).values({
      id: discountId,
      storeId,
      code: validated.code.toUpperCase(),
      type: validated.type,
      value: validated.value,
      minOrderAmount: validated.minOrderAmount || 0,
      usageLimit: validated.usageLimit || null,
      startsAt: validated.startsAt ? new Date(validated.startsAt) : null,
      endsAt: validated.endsAt ? new Date(validated.endsAt) : null,
      isActive: validated.isActive,
    });

    await db.insert(schema.auditLogs).values({
      id: crypto.randomUUID(),
      storeId,
      actorId: authResult.userId,
      actorRole: authResult.role,
      action: 'discount.created',
      resourceType: 'discount',
      resourceId: discountId,
      createdAt: new Date(),
    });

    const created = await db.query.discounts.findFirst({
      where: eq(schema.discounts.id, discountId),
    });

    return Response.json({ data: created }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
        return Response.json({ error: { code: 'VALIDATION_ERROR', details: error.errors } }, { status: 400 });
    }
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
