import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export const runtime = 'edge';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can ban customers' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  const customer = await db.query.customers.findFirst({
    where: and(eq(schema.customers.id, id), eq(schema.customers.storeId, storeId)),
  });

  if (!customer) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, { status: 404 });
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(schema.customers).set({ isBanned: true }).where(eq(schema.customers.id, id));
    
    await tx.insert(schema.auditLogs).values({
      id: crypto.randomUUID(),
      storeId,
      actorId: authResult.userId,
      actorRole: authResult.role,
      action: 'customer.banned',
      resourceType: 'customer',
      resourceId: id,
      createdAt: now,
    });

    await tx.insert(schema.notifications).values({
      id: crypto.randomUUID(),
      storeId,
      type: 'customer.banned',
      title: 'Customer Banned',
      body: `Customer ${customer.email} has been banned by ${authResult.userId}.`,
      createdAt: now,
    });
  });

  return Response.json({ data: { banned: true } });
}
