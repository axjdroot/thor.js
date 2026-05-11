import { ok } from '@/lib/api';

export const runtime = 'edge';

export async function POST(req: Request) {
  // Stripe webhook logic for handling payment success, order confirmation, etc.
  return ok({ received: true });
}
