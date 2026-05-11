import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { createClerkClient } from '@clerk/backend';

export const runtime = 'edge';

export async function DELETE(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can remove team members' } }, { status: 403 });
  }

  if (authResult.userId === memberId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'You cannot remove yourself' } }, { status: 400 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY! });
  const storeId = req.headers.get('X-Store-ID');

  try {
    await clerk.users.updateUserMetadata(memberId, {
      publicMetadata: { role: null }
    });

    await db.insert(schema.auditLogs).values({
      id: crypto.randomUUID(),
      storeId: storeId || 'system',
      actorId: authResult.userId,
      actorRole: authResult.role,
      action: 'team.member_removed',
      resourceType: 'team',
      resourceId: memberId,
      createdAt: new Date(),
    });

    return Response.json({ data: { removed: true } });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can change team roles' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY! });
  const storeId = req.headers.get('X-Store-ID');

  try {
    const { role } = await req.json() as any;
    if (!['admin', 'staff'].includes(role)) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Valid role required' } }, { status: 400 });
    }

    await clerk.users.updateUserMetadata(memberId, {
      publicMetadata: { role }
    });

    await db.insert(schema.auditLogs).values({
      id: crypto.randomUUID(),
      storeId: storeId || 'system',
      actorId: authResult.userId,
      actorRole: authResult.role,
      action: 'team.member_role_changed',
      resourceType: 'team',
      resourceId: memberId,
      metadata: JSON.stringify({ newRole: role }),
      createdAt: new Date(),
    });

    return Response.json({ data: { updated: true } });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
