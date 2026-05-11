import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  // Fetch zones and rates in one go using findMany with relations
  const zonesWithRates = await db.query.shippingZones.findMany({
    where: eq(schema.shippingZones.storeId, storeId),
    with: {
      rates: {
        orderBy: (rates: any, { asc }: any) => [asc(rates.rateValue)],
      }
    }
  });

  const formatted = zonesWithRates.map((zone: any) => ({
    ...zone,
    countryCodes: typeof zone.countryCodes === 'string' ? JSON.parse(zone.countryCodes) : zone.countryCodes,
    rates: zone.rates.map((rate: any) => ({
      ...rate,
      // isActive is already a boolean from schema
    }))
  }));

  return Response.json({ data: formatted });
}
