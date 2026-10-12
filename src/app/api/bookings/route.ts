import { actor, endpoint, jsonBody, rateLimit, sameOrigin } from '@/lib/server';
import { listBookings, saveBooking } from '@/db/repository';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  return endpoint(async () => {
    const a = await actor();
    const cursor = new URL(req.url).searchParams.get('cursor');
    if (cursor) z.uuid().parse(cursor);
    return listBookings(a, cursor || undefined);
  });
}
export async function POST(req: Request) {
  return endpoint(async () => {
    sameOrigin(req);
    const a = await actor();
    await rateLimit(a.userId);
    return saveBooking(a, await jsonBody(req));
  });
}
