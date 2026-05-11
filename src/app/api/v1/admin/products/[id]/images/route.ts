import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';
import { uploadProductImage } from '@/lib/storage';

export const runtime = 'edge';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  const images = await db.query.productImages.findMany({
    where: and(eq(schema.productImages.productId, id), eq(schema.productImages.storeId, storeId)),
    orderBy: (images: any, { asc }: any) => [asc(images.position)],
  });

  return Response.json({ data: images });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  // Verify product exists
  const product = await db.query.products.findFirst({
    where: and(eq(schema.products.id, id), eq(schema.products.storeId, storeId)),
  });

  if (!product) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    
    if (!file) {
      return Response.json({ error: { code: 'NO_FILE', message: 'No image file provided' } }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { key, url } = await uploadProductImage({
      r2: env.R2!,
      storeId,
      productId: id,
      file: bytes,
      contentType: file.type,
      filename: file.name
    });

    const nextPosResult = await db
      .select({ nextPos: sql<number>`COALESCE(MAX(${schema.productImages.position}), -1) + 1` })
      .from(schema.productImages)
      .where(eq(schema.productImages.productId, id));
    
    const nextPos = nextPosResult[0]?.nextPos || 0;
    const imageId = crypto.randomUUID();

    await db.insert(schema.productImages).values({
      id: imageId,
      productId: id,
      storeId,
      url,
      r2Key: key,
      alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      position: nextPos,
    });

    const created = await db.query.productImages.findFirst({
      where: eq(schema.productImages.id, imageId),
    });

    return Response.json({ data: created }, { status: 201 });
  } catch (error: any) {
    return Response.json({ error: { code: 'UPLOAD_FAILED', message: error.message } }, { status: 500 });
  }
}
