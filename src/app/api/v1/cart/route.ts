import { ok, err } from '@/lib/api';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const cartId = crypto.randomUUID();
    // In a real flow, we might initialize the DO here or just return the ID
    return ok({ id: cartId });
  } catch (error: any) {
    return err('CART_CREATION_FAILED', error.message);
  }
}
