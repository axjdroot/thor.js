import { getDB } from '@/lib/cf';
import { schema } from '@/db';
import { ok, err } from '@/lib/api';
import { like, or } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    
    if (!q) return ok([]);

    const db = getDB();
    const results = await db.select().from(schema.products).where(
      or(
        like(schema.products.name, `%${q}%`),
        like(schema.products.description, `%${q}%`)
      )
    ).all();

    return ok(results);
  } catch (error: any) {
    return err('SEARCH_FAILED', error.message);
  }
}
