import { auth } from '@clerk/nextjs/server';

export async function requireAdminAuth() {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      if (process.env.NODE_ENV === 'development') {
        return { userId: 'dev_user', role: 'admin' };
      }
      return Response.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const role = (sessionClaims?.metadata as any)?.role;
    
    if (role !== 'admin' && role !== 'staff') {
      if (process.env.NODE_ENV === 'development') {
        return { userId: userId, role: 'admin' };
      }
      return Response.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    return { userId, role };
  } catch (error) {
    console.error("Auth Error:", error);
    if (process.env.NODE_ENV === 'development') {
      console.log("Dev Mode: Bypassing Clerk auth error");
      return { userId: 'dev_user', role: 'admin' };
    }
    return Response.json({ error: "Authentication failed" }, { status: 500 });
  }
}

