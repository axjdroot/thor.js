import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';

export const runtime = 'edge';

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new Response('Not Found', { status: 404 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID') || 'default-store-id';

  const now = new Date();
  
  const sampleNotifications = [
    { 
      id: crypto.randomUUID(),
      type: 'order.created', 
      title: 'New order received',
      body: 'Order #ABC123 for $49.99', 
      storeId, 
      createdAt: now 
    },
    { 
      id: crypto.randomUUID(),
      type: 'inventory.low_stock', 
      title: 'Low stock alert',
      body: 'SKU-001 has only 3 units remaining', 
      storeId, 
      createdAt: new Date(now.getTime() - 3600000) 
    },
    { 
      id: crypto.randomUUID(),
      type: 'customer.registered', 
      title: 'New customer',
      body: 'test@example.com just signed up', 
      storeId, 
      createdAt: new Date(now.getTime() - 7200000) 
    },
    { 
      id: crypto.randomUUID(),
      type: 'order.refunded', 
      title: 'Refund processed',
      body: '$25.00 refunded on order #DEF456', 
      storeId, 
      createdAt: new Date(now.getTime() - 86400000) 
    },
    { 
      id: crypto.randomUUID(),
      type: 'inventory.out_of_stock', 
      title: 'Out of stock',
      body: 'SKU-002 is now out of stock', 
      storeId, 
      readAt: new Date(now.getTime() - 3600000),
      createdAt: new Date(now.getTime() - 172800000) 
    },
  ];

  await db.insert(schema.notifications).values(sampleNotifications);

  return Response.json({ data: { seeded: sampleNotifications.length } });
}
