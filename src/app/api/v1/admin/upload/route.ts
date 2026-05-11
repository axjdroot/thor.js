import { getRequestContext } from '@cloudflare/next-on-pages';
import { requireAdminAuth } from '@/lib/auth';

export const runtime = 'edge';

export async function POST(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const formData = await req.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  try {
    const key = `products/${crypto.randomUUID()}-${file.name}`;
    const buffer = await file.arrayBuffer();

    await (env as any).R2.put(key, buffer, {
      httpMetadata: { contentType: file.type },
    });

    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;

    return Response.json({ url: publicUrl, key });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return Response.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
