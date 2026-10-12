import { actor, endpoint, jsonBody, rateLimit, sameOrigin } from '@/lib/server';
import { recordTransaction } from '@/db/repository';
import { z } from 'zod';
export async function POST(req: Request, c: { params: Promise<{ id: string }> }) {
  return endpoint(async () => {
    sameOrigin(req);
    const a = await actor();
    await rateLimit(a.userId);
    return recordTransaction(a, z.uuid().parse((await c.params).id), await jsonBody(req));
  });
}
