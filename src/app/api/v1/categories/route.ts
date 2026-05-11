import { getDB } from '@/lib/cf';
import { schema } from '@/db';
import { ok, err } from '@/lib/api';

export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const db = getDB();
    const categories = await db.select().from(schema.categories).all();
    return ok(categories);
  } catch (error: any) {
    return err('INTERNAL_ERROR', error.message, 500);
  }
}
