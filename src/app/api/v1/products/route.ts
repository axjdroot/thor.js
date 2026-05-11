import { getDB } from '@/lib/cf';
import { schema } from '@/db';
import { ok, err } from '@/lib/api';
import { eq, and } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId') || 'default-store-id';
    
    const db = getDB();
    const products = await db.select().from(schema.products).where(
      and(
        eq(schema.products.storeId, storeId),
        eq(schema.products.status, 'active')
      )
    ).all();

    // In a real scenario, we'd use db.query.products.findMany if schema is fully loaded
    // For now, let's just return what we have
    return ok(products);
  } catch (error: any) {
    return err('INTERNAL_ERROR', error.message, 500);
  }
}
