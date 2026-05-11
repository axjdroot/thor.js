export async function uploadProductImage(params: {
  r2: R2Bucket;
  storeId: string;
  productId: string;
  file: Uint8Array;
  contentType: string;
  filename: string;
}): Promise<{ key: string; url: string }> {
  const { r2, storeId, productId, file, contentType, filename } = params;

  // Validate content type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (!allowedTypes.includes(contentType)) {
    throw new Error('INVALID_FILE_TYPE');
  }

  // Validate size (5MB)
  if (file.length > 5 * 1024 * 1024) {
    throw new Error('FILE_TOO_LARGE');
  }

  // Generate unique key
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  const key = `stores/${storeId}/products/${productId}/${crypto.randomUUID()}.${ext}`;

  // Upload to R2
  await r2.put(key, file, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      storeId,
      productId,
      originalFilename: filename,
    },
  });

  // Generate public URL
  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? `https://assets.thor.com`;
  return { key, url: `${publicUrl}/${key}` };
}

export async function deleteProductImage(params: {
  r2: R2Bucket;
  key: string;
}): Promise<void> {
  await params.r2.delete(params.key);
}
