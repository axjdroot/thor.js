import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { z } from 'zod';

export const runtime = 'edge';

const createZoneSchema = z.object({
  name: z.string().min(1),
  countryCodes: z.array(z.string().length(2)).min(1),
});

export async function POST(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can create shipping zones' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validated = createZoneSchema.parse(body);

    const id = crypto.randomUUID();
    await db.insert(schema.shippingZones).values({
      id,
      storeId,
      name: validated.name,
      countryCodes: JSON.stringify(validated.countryCodes.map(c => c.toUpperCase())),
    });

    const created = await db.query.shippingZones.findFirst({
      where: (zones: any, { eq }: any) => eq(zones.id, id),
    });

    return Response.json({ data: created }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
        return Response.json({ error: { code: 'VALIDATION_ERROR', details: error.errors } }, { status: 400 });
    }
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
