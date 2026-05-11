import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { requireAdminAuth } from '@/lib/auth';
import { eq, and, asc } from 'drizzle-orm';
import { deleteProductImage } from '@/lib/storage';

export const runtime = 'edge';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string, imageId: string }> }) {
  const { id, imageId } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  try {
    const { alt } = await req.json() as any;

    const existing = await db.query.productImages.findFirst({
      where: and(
        eq(schema.productImages.id, imageId),
        eq(schema.productImages.productId, id),
        eq(schema.productImages.storeId, storeId)
      ),
    });

    if (!existing) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Image not found' } }, { status: 404 });
    }

    await db.update(schema.productImages)
      .set({ alt })
      .where(eq(schema.productImages.id, imageId));

    const updated = await db.query.productImages.findFirst({
      where: eq(schema.productImages.id, imageId),
    });

    return Response.json({ data: updated });
  } catch (error: any) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string, imageId: string }> }) {
  const { id, imageId } = await params;
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const storeId = req.headers.get('X-Store-ID');

  if (!storeId) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'X-Store-ID header is required' } }, { status: 400 });
  }

  const image = await db.query.productImages.findFirst({
    where: and(
      eq(schema.productImages.id, imageId),
      eq(schema.productImages.productId, id),
      eq(schema.productImages.storeId, storeId)
    ),
  });

  if (!image) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'Image not found' } }, { status: 404 });
  }

  // Delete from R2 if applicable
  if (image.r2Key) {
    try {
      await deleteProductImage({ r2: env.R2!, key: image.r2Key });
    } catch (error) {
      console.error('Failed to delete image from R2:', error);
    }
  }

  // Delete from D1
  await db.delete(schema.productImages).where(eq(schema.productImages.id, imageId));

  // Reorder remaining images
  const remaining = await db.query.productImages.findMany({
    where: eq(schema.productImages.productId, id),
    orderBy: asc(schema.productImages.position),
  });

  if (remaining.length > 0) {
    await db.transaction(async (tx) => {
      for (let i = 0; i < remaining.length; i++) {
        await tx.update(schema.productImages)
          .set({ position: i })
          .where(eq(schema.productImages.id, remaining[i].id));
      }
    });
  }

  return Response.json({ data: { deleted: true } });
}
