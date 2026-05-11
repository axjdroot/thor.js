import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { createClerkClient } from '@clerk/backend';

export const runtime = 'edge';

export async function GET(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can view team members' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY! });

  // List all users and filter by metadata role
  // Note: For large organizations, this should use Clerk Organizations API
  const users = await clerk.users.getUserList({ limit: 100 });
  
  const teamMembers = users.data
    .filter(u => u.publicMetadata.role === 'admin' || u.publicMetadata.role === 'staff')
    .map(u => ({
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress,
      firstName: u.firstName,
      lastName: u.lastName,
      imageUrl: u.imageUrl,
      role: u.publicMetadata.role,
      lastActiveAt: u.lastActiveAt,
      createdAt: u.createdAt,
    }));

  return Response.json({ data: teamMembers });
}

export async function POST(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  if (authResult.role !== 'admin') {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Only admins can invite team members' } }, { status: 403 });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY! });
  const storeId = req.headers.get('X-Store-ID');

  try {
    const { email, role } = await req.json() as any;

    if (!email || !['admin', 'staff'].includes(role)) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Valid email and role required' } }, { status: 400 });
    }

    // Check if user exists
    const users = await clerk.users.getUserList({ emailAddress: [email] });
    
    if (users.data.length > 0) {
      const user = users.data[0];
      await clerk.users.updateUserMetadata(user.id, {
        publicMetadata: { role }
      });
    } else {
      // Create invitation
      await clerk.invitations.createInvitation({
        emailAddress: email,
        publicMetadata: { role },
        redirectUrl: `https://${req.headers.get('host')}/admin/setup`
      });
    }

    await db.insert(schema.auditLogs).values({
      id: crypto.randomUUID(),
      storeId: storeId || 'system',
      actorId: authResult.userId,
      actorRole: authResult.role,
      action: 'team.member_invited',
      resourceType: 'team',
      resourceId: email,
      createdAt: new Date(),
    });

    return Response.json({ data: { invited: true, email } });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}
