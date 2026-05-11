import { Db, schema } from '@/db';
import { eq, and, sql } from 'drizzle-orm';

export type DiscountError =
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'NOT_STARTED'
  | 'USAGE_LIMIT_REACHED'
  | 'MINIMUM_NOT_MET'
  | 'INACTIVE';

export type DiscountValidationResult =
  | { valid: true; discount: any; amountOff: number; type: string }
  | { valid: false; code: string; reason: DiscountError };

export async function validateDiscount(params: {
  code: string;
  storeId: string;
  orderSubtotal: number; // cents
  db: Db;
}): Promise<DiscountValidationResult> {
  const { code, storeId, orderSubtotal, db } = params;

  // 1. Find discount
  const discount = await db.query.discounts.findFirst({
    where: and(
      eq(sql`LOWER(${schema.discounts.code})`, code.toLowerCase()),
      eq(schema.discounts.storeId, storeId)
    ),
  });

  if (!discount) {
    return { valid: false, code, reason: 'NOT_FOUND' };
  }

  // 2. Check is_active
  if (!discount.isActive) {
    return { valid: false, code, reason: 'INACTIVE' };
  }

  const now = Date.now();

  // 3. Check starts_at
  if (discount.startsAt && new Date(discount.startsAt).getTime() > now) {
    return { valid: false, code, reason: 'NOT_STARTED' };
  }

  // 4. Check ends_at
  if (discount.endsAt && new Date(discount.endsAt).getTime() < now) {
    return { valid: false, code, reason: 'EXPIRED' };
  }

  // 5. Check usage_limit
  if (discount.usageLimit !== null && (discount.usageCount || 0) >= discount.usageLimit) {
    return { valid: false, code, reason: 'USAGE_LIMIT_REACHED' };
  }

  // 6. Check min_order_amount
  if (discount.minOrderAmount !== null && orderSubtotal < discount.minOrderAmount) {
    return { valid: false, code, reason: 'MINIMUM_NOT_MET' };
  }

  // 7. Calculate amount off
  let amountOff = 0;
  if (discount.type === 'percentage') {
    // value is basis points: 1000 = 10%
    amountOff = Math.floor((orderSubtotal * discount.value) / 10000);
  } else if (discount.type === 'fixed_amount') {
    amountOff = Math.min(discount.value, orderSubtotal);
  } else if (discount.type === 'free_shipping') {
    amountOff = 0;
  }

  // 8. Return success
  return {
    valid: true,
    discount,
    amountOff,
    type: discount.type,
  };
}

export async function incrementUsage(discountId: string, db: Db): Promise<void> {
  await db
    .update(schema.discounts)
    .set({
      usageCount: sql`${schema.discounts.usageCount} + 1`,
    })
    .where(eq(schema.discounts.id, discountId));
}
