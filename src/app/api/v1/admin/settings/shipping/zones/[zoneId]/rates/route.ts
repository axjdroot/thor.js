import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const createRateSchema = z.object({
  name: z.string().min(1),
  rateType: z.enum(['flat', 'free', 'percentage', 'per_item']),
  rateValue: z.number().int().min(0),
  minOrderAmount: z.number().int().min(0).optional(),
  maxOrderAmount: z.number().int().min(0).optional(),
  estimatedDaysMin: z.number().int().min(1).max(365).optional(),
  estimatedDaysMax: z.number().int().min(1).max(365).optional(),
  isActive: z.boolean().default(true),
}).refine(data => {
  if (data.maxOrderAmount !== undefined && data.minOrderAmount !== undefined) {
    return data.maxOrderAmount > data.minOrderAmount;
  }
  return true;
}, {
  message: "maxOrderAmount must be greater than minOrderAmount",
  path: ["maxOrderAmount"]
}).refine(data => {
  if (data.estimatedDaysMax !== undefined && data.estimatedDaysMin !== undefined) {
    return data.estimatedDaysMax >= data.estimatedDaysMin;
  }
  return true;
}, {
  message: "estimatedDaysMax must be greater than or equal to estimatedDaysMin",
  path: ["estimatedDaysMax"]
}).refine(data => {
  if (data.rateType === 'free') return data.rateValue === 0;
  if (data.rateType === 'percentage') return data.rateValue >= 0 && data.rateValue <= 10000;
  return true;
}, {
  message: "Invalid rate value for the selected rate type",
  path: ["rateValue"]
});

export async function POST(req: Request, { params }: { params: Promise<{ zoneId: string }> }) {
  const { zoneId } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can create shipping rates' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createRateSchema.parse(body);

    const zone = await db.query.shippingZones.findFirst({
      where: and(eq(schema.shippingZones.id, zoneId), eq(schema.shippingZones.storeId, storeId)),
    });

    if (!zone) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Shipping zone not found' } }, { status: 404 });
    }

    const id = crypto.randomUUID();
    await db.insert(schema.shippingRates).values({
      id,
      zoneId: zoneId,
      storeId,
      name: validated.name,
      rateType: validated.rateType,
      rateValue: validated.rateValue,
      minOrderAmount: validated.minOrderAmount || 0,
      maxOrderAmount: validated.maxOrderAmount || null,
      estimatedDaysMin: validated.estimatedDaysMin || null,
      estimatedDaysMax: validated.estimatedDaysMax || null,
      isActive: validated.isActive,
    });

    const created = await db.query.shippingRates.findFirst({
      where: eq(schema.shippingRates.id, id),
    });

    return Response.json({ data: created }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
        return Response.json({ error: { code: 'VALIDATION_ERROR', details: error.errors } }, { status: 400 });
    }
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
