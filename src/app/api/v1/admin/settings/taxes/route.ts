import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';

export const runtime = 'edge';

const createTaxRateSchema = z.object({
  name: z.string().min(1),
  countryCode: z.string().length(2),
  stateCode: z.string().optional().nullable(),
  rate: z.string().refine(val => {
    const parsed = parseFloat(val);
    return !isNaN(parsed) && parsed >= 0 && parsed <= 1;
  }, "Rate must be between 0 and 1"),
  appliesToShipping: z.boolean().default(false),
  isActive: z.boolean().default(true),
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

  const taxRates = await db
    .select()
    .from(schema.taxRates)
    .where(eq(schema.taxRates.storeId, storeId))
    .orderBy(asc(schema.taxRates.countryCode), asc(schema.taxRates.stateCode));

  return Response.json({ data: taxRates });
}

export async function POST(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can create tax rates' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createTaxRateSchema.parse(body);

    const existing = await db.query.taxRates.findFirst({
      where: and(
        eq(schema.taxRates.storeId, storeId),
        eq(schema.taxRates.countryCode, validated.countryCode.toUpperCase()),
        validated.stateCode ? eq(schema.taxRates.stateCode, validated.stateCode.toUpperCase()) : eq(schema.taxRates.stateCode, '') // simplified check
      ),
    });

    if (existing) {
      return Response.json({ error: { code: 'CONFLICT', message: 'Tax rate for this region already exists' } }, { status: 409 });
    }

    const id = crypto.randomUUID();
    await db.insert(schema.taxRates).values({
      id,
      storeId,
      name: validated.name,
      countryCode: validated.countryCode.toUpperCase(),
      stateCode: validated.stateCode?.toUpperCase() || null,
      rate: validated.rate,
      appliesToShipping: validated.appliesToShipping,
      isActive: validated.isActive,
    });

    const created = await db.query.taxRates.findFirst({
      where: eq(schema.taxRates.id, id),
    });

    return Response.json({ data: created }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
        return Response.json({ error: { code: 'VALIDATION_ERROR', details: error.errors } }, { status: 400 });
    }
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
