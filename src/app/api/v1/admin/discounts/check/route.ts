import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { eq, and, sql } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET(req: Request) {
  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Code parameter is required' } }, { status: 400 });
  }

  // Rate limiting via KV
  const clientIP = req.headers.get('CF-Connecting-IP') || 'anonymous';
  const kvKey = `rate-limit:discount-check:${clientIP}`;
  const count = parseInt(await env.KV!.get(kvKey) || '0');
  
  if (count >= 30) {
    return Response.json({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } }, { status: 429 });
  }
  
  await env.KV!.put(kvKey, (count + 1).toString(), { expirationTtl: 60 });

  const existing = await db
    .select({ id: schema.discounts.id })
    .from(schema.discounts)
    .where(and(
      eq(sql`LOWER(${schema.discounts.code})`, code.toLowerCase()),
      eq(schema.discounts.storeId, storeId)
    ))
    .limit(1);

  return Response.json({ 
    data: { 
      available: existing.length === 0, 
      code: code.toUpperCase() 
    } 
  });
}
