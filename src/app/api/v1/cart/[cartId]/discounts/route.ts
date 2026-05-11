import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb } from '@/db';
import { validateDiscount } from '@/lib/discount-engine';

export const runtime = 'edge';

export async function POST(req: Request, { params }: { params: Promise<{ cartId: string }> }) {
  const { cartId: cartIdParam } = await params;
  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  try {
    const { code } = await req.json() as any;
    if (!code) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Discount code is required' } }, { status: 400 });
    }

    // Get cart from CartDO
    const cartId = env.CART_DO!.idFromString(cartIdParam);
    const cartStub = env.CART_DO!.get(cartId);
    
    const cartResponse = await cartStub.fetch(new Request('http://do/getCart'));
    const cart = await cartResponse.json() as any;

    const result = await validateDiscount({
      code,
      storeId,
      orderSubtotal: cart.subtotal,
      db
    });

    if (!result.valid) {
      const messages: Record<string, string> = {
        NOT_FOUND: 'This discount code is not valid.',
        EXPIRED: 'This discount code has expired.',
        NOT_STARTED: 'This discount code is not active yet.',
        USAGE_LIMIT_REACHED: 'This discount code has reached its usage limit.',
        MINIMUM_NOT_MET: 'Your order does not meet the minimum for this code.',
        INACTIVE: 'This discount code is not active.',
      };
      return Response.json({ 
        error: { 
          code: result.reason, 
          message: messages[result.reason] || 'Invalid discount code.' 
        } 
      }, { status: 422 });
    }

    // Apply to CartDO
    const updatedCartResponse = await cartStub.fetch(new Request('http://do/applyDiscount', {
      method: 'POST',
      body: JSON.stringify({
        code: result.discount.code,
        amount: result.amountOff,
        type: result.discount.type
      })
    }));
    const updatedCart = await updatedCartResponse.json();

    return Response.json({
      data: {
        code: result.discount.code,
        type: result.discount.type,
        amountOff: result.amountOff,
        cart: updatedCart
      }
    });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
