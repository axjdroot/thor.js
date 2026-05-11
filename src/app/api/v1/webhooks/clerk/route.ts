import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { createDb, schema } from '@/db';
import { eq, and } from 'drizzle-orm';

export const runtime = 'edge';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400,
    });
  }

  const { env } = getRequestContext();
  const db = createDb(env.DB!);
  const defaultStoreId = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID || 'default-store-id';

  const eventType = evt.type;

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name } = evt.data;
    const email = email_addresses[0].email_address;

    try {
      await db.insert(schema.customers).values({
        id: crypto.randomUUID(),
        storeId: defaultStoreId,
        clerkUserId: id,
        email: email,
        firstName: first_name || '',
        lastName: last_name || '',
      });
    } catch (error) {
      // If duplicate email, update instead
      await db.update(schema.customers)
        .set({
          clerkUserId: id,
          firstName: first_name || '',
          lastName: last_name || '',
        })
        .where(and(eq(schema.customers.storeId, defaultStoreId), eq(schema.customers.email, email)));
    }
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name } = evt.data;
    const email = email_addresses[0].email_address;

    await db.update(schema.customers)
      .set({
        email: email,
        firstName: first_name || '',
        lastName: last_name || '',
      })
      .where(eq(schema.customers.clerkUserId, id));
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;
    if (id) {
        await db.update(schema.customers)
          .set({
            email: `deleted-${id}@deleted.com`,
            firstName: '[Deleted]',
            lastName: '[User]',
            clerkUserId: 'deleted-' + id, 
          })
          .where(eq(schema.customers.clerkUserId, id));
    }
  }

  return new Response('', { status: 200 });
}
