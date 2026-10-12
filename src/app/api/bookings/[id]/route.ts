import { actor, endpoint, jsonBody, rateLimit, sameOrigin } from '@/lib/server';
import { saveBooking, archiveBooking } from '@/db/repository';
import { z } from 'zod';
type Context = { params: Promise<{ id: string }> };
export async function PUT(req: Request, c: Context) {
  return endpoint(async () => {
    sameOrigin(req);
    const a = await actor();
    await rateLimit(a.userId);
    return saveBooking(a, await jsonBody(req), z.uuid().parse((await c.params).id));
  });
}
export async function DELETE(req: Request, c: Context) {
  return endpoint(async () => {
    sameOrigin(req);
    const a = await actor();
    await rateLimit(a.userId);
    return archiveBooking(a, z.uuid().parse((await c.params).id));
  });
}
