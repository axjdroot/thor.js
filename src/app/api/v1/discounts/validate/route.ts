import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb } from '@/db';
import { validateDiscount } from '@/lib/discount-engine';

export const runtime = 'edge';

export async function POST(req: Request) {
  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  try {
    const { code, cartTotal } = await req.json() as any;
    
    if (!code || cartTotal === undefined) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Code and cartTotal are required' } }, { status: 400 });
    }

    const result = await validateDiscount({
      code,
      storeId,
      orderSubtotal: cartTotal,
      db
    });

    return Response.json({ data: result });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
