import { getRequestContext } from '@cloudflare/next-on-pages';
import { requireAdminAuth } from '@/lib/auth';

export const runtime = 'edge';

export async function POST(req: Request) {
  const authResult = await requireAdminAuth();
  if (authResult instanceof Response) return authResult;

  const { env } = getRequestContext();
  const { name, currentDescription } = await req.json() as any;

  if (!name) {
    return Response.json({ error: 'Product name is required' }, { status: 400 });
  }

  try {
    // Using Cloudflare Workers AI with Llama-3
    const response = await (env as any).AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are an expert commerce copywriter for Thor.js, a premium streetwear engine. Create compelling, high-end product descriptions that sound professional and exclusive. Keep it under 150 words.'
        },
        {
          role: 'user',
          content: `Write a product description for a streetwear item named "${name}". ${currentDescription ? `Context: ${currentDescription}` : ''}`
        }
      ]
    });

    return Response.json({ description: response.response });
  } catch (error: any) {
    console.error('AI Synthesis Error:', error);
    return Response.json({ error: 'Failed to synthesize description' }, { status: 500 });
  }
}
